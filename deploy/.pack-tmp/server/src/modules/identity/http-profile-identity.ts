import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { VerifiedPrincipal } from "@assistant/context";
import type { EmbedIdentityProvider } from "./identity.js";
import { ServiceError } from "../../shared/errors.js";

const configSchema = z.object({
  endpoint: z.string().url(), allowedOrigin: z.string().url(), cookieName: z.string().regex(/^[A-Za-z0-9_]+$/),
  tenantId: z.string().min(1).max(100), localHttp: z.boolean().default(false),
  idPath: z.string(), displayNamePath: z.string(), rolePath: z.string(), statusPath: z.string(),
  activeStatus: z.string(), adminRoles: z.array(z.string()).default([]),
  browserOrigins: z.array(z.string().url()).default([]),
}).strict();

function valueAt(raw: unknown, path: string): unknown {
  let value = raw;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Deployment-configured trusted profile endpoint; credentials remain in server memory only. */
export class HttpProfileIdentityProvider implements EmbedIdentityProvider {
  readonly #credentials = new Map<string, { token: string; principal: VerifiedPrincipal; expiresAt: number }>();
  readonly #temporary = new Map<string, { ref: string; expiresAt: number }>();
  readonly config: z.infer<typeof configSchema>;

  constructor(raw: unknown) {
    this.config = configSchema.parse(raw);
    const url = new URL(this.config.endpoint);
    if (url.origin !== this.config.allowedOrigin || url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && this.config.localHttp)))
      throw new Error("Invalid approved identity endpoint.");
  }

  #denied(): never { throw new ServiceError("UNAUTHENTICATED", "Authentication required.", 401); }

  async #profile(token: string): Promise<VerifiedPrincipal> {
    try {
      const response = await fetch(this.config.endpoint, { headers: { Authorization: `Bearer ${token}` },
        redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!response.ok || !response.body) return this.#denied();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          const chunk: unknown = part.value;
          if (!(chunk instanceof Uint8Array)) return this.#denied();
          bytes += chunk.byteLength;
          if (bytes > 65536) return this.#denied();
          chunks.push(chunk);
        }
      } finally { await reader.cancel(); }
      const profile: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const rawId = valueAt(profile, this.config.idPath);
      const displayName = valueAt(profile, this.config.displayNamePath);
      const role = valueAt(profile, this.config.rolePath);
      if ((typeof rawId !== "string" && typeof rawId !== "number") || !String(rawId) ||
          typeof displayName !== "string" || !displayName ||
          valueAt(profile, this.config.statusPath) !== this.config.activeStatus) return this.#denied();
      const authorizationRef = `http:${createHash("sha256").update(token).digest("hex")}`;
      const principal: VerifiedPrincipal = { id: String(rawId), displayName, tenantId: this.config.tenantId,
        permissionScopes: typeof role === "string" && this.config.adminRoles.includes(role) ? ["platform:admin"] : [],
        authorizedObjectIds: [], authorizationRef };
      // Bound memory, independent of client-controlled identities or JWT claims.
      const now = Date.now();
      for (const [key, entry] of this.#credentials) if (entry.expiresAt <= now) this.#credentials.delete(key);
      if (this.#credentials.size >= 2000 && !this.#credentials.has(authorizationRef)) return this.#denied();
      this.#credentials.set(authorizationRef, { token, principal, expiresAt: now + 5 * 60_000 });
      return principal;
    } catch { return this.#denied(); }
  }

  async authenticate(authorization: string | null, request?: Request): Promise<VerifiedPrincipal> {
    let token = authorization?.match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];
    if (token?.startsWith("embed_")) {
      const ticket = this.#temporary.get(token);
      const credential = ticket && ticket.expiresAt > Date.now() ? this.#credentials.get(ticket.ref) : undefined;
      if (!credential || credential.expiresAt <= Date.now()) return this.#denied();
      return this.#profile(credential.token);
    }
    if (!token && request) {
      // Cookie authentication is same-origin only, including mutations such as embed ticket creation.
      const origin = request.headers.get("origin");
      const hostOrigin = new URL(request.url).origin;
      if (origin !== null && origin !== hostOrigin && !this.config.browserOrigins.includes(origin)) return this.#denied();
      if (request.headers.get("sec-fetch-site") === "cross-site") return this.#denied();
      const cookies = request.headers.get("cookie")?.split(";").map((part) => part.trim()) ?? [];
      const matches = cookies.filter((part) => part.startsWith(`${this.config.cookieName}=`));
      if (matches.length !== 1) return this.#denied();
      token = matches[0]!.slice(this.config.cookieName.length + 1);
    }
    if (!token || !/^[A-Za-z0-9._-]{1,8192}$/.test(token)) return this.#denied();
    return this.#profile(token);
  }

  issueTemporaryCredential(principal: VerifiedPrincipal, ttlMs = 5 * 60_000): string {
    if (!this.#credentials.has(principal.authorizationRef)) return this.#denied();
    for (const [key, entry] of this.#temporary) if (entry.expiresAt <= Date.now()) this.#temporary.delete(key);
    if (this.#temporary.size >= 2000) return this.#denied();
    const token = `embed_${randomUUID().replaceAll("-", "")}`;
    this.#temporary.set(token, { ref: principal.authorizationRef, expiresAt: Date.now() + Math.min(ttlMs, 300000) });
    return token;
  }

  async credentialFor(context: { principalId: string; tenantId: string; authorizationRef?: string | undefined }): Promise<string> {
    const entry = this.#credentials.get(context.authorizationRef ?? "");
    if (!entry || entry.expiresAt <= Date.now() || entry.principal.id !== context.principalId ||
      entry.principal.tenantId !== context.tenantId) return this.#denied();
    const current = await this.#profile(entry.token);
    if (current.id !== context.principalId || current.tenantId !== context.tenantId) return this.#denied();
    return entry.token;
  }
}
