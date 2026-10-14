import type {
  CapabilityExecutionContext,
  CapabilityProvider,
} from "@assistant/capability-contracts";

const MAX_RESPONSE_BYTES = 1_048_576;

export interface HttpCapabilityDriverOptions {
  readonly baseUrl: string;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export class HttpCapabilityDriver {
  readonly #baseUrl: URL;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: HttpCapabilityDriverOptions) {
    this.#baseUrl = new URL(options.baseUrl);
    if (this.#baseUrl.username || this.#baseUrl.password) {
      throw new Error("HTTP plugin URLs cannot contain credentials.");
    }
    if (!options.allowedOrigins.has(this.#baseUrl.origin)) {
      throw new Error(`HTTP plugin origin '${this.#baseUrl.origin}' is not approved.`);
    }
    if (this.#baseUrl.protocol !== "https:" && this.#baseUrl.protocol !== "http:") {
      throw new Error("HTTP plugins require an HTTP(S) URL.");
    }
    if (
      this.#baseUrl.protocol === "http:" &&
      !["127.0.0.1", "localhost", "::1"].includes(this.#baseUrl.hostname)
    ) {
      throw new Error("Plain HTTP is restricted to loopback hosts.");
    }
    this.#timeoutMs = options.timeoutMs ?? 5_000;
    this.#fetch = options.fetchImplementation ?? fetch;
  }

  async invoke(
    capabilityId: string,
    contractVersion: string,
    input: unknown,
    context: CapabilityExecutionContext,
  ): Promise<unknown> {
    const endpoint = new URL(
      `capabilities/${encodeURIComponent(capabilityId)}/invoke`,
      this.#baseUrl.href.endsWith("/") ? this.#baseUrl : new URL(`${this.#baseUrl.href}/`),
    );
    const response = await this.#fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(this.#timeoutMs),
      body: JSON.stringify({
        contractVersion,
        input,
        traceId: context.traceId,
        contextSnapshotId: context.contextSnapshotId,
      }),
    });
    if (!response.ok)
      throw new Error(`HTTP capability provider returned status ${response.status}.`);
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("HTTP capability provider response exceeded the configured limit.");
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new Error("HTTP capability provider returned invalid JSON.");
    }
  }
}

export class HttpCapabilityProvider implements CapabilityProvider {
  readonly id: string;
  readonly contractVersion: string;
  readonly #driver: HttpCapabilityDriver;

  constructor(options: { id: string; contractVersion: string; driver: HttpCapabilityDriver }) {
    this.id = options.id;
    this.contractVersion = options.contractVersion;
    this.#driver = options.driver;
  }

  execute(input: unknown, context: CapabilityExecutionContext): Promise<unknown> {
    return this.#driver.invoke(this.id, this.contractVersion, input, context);
  }
}
