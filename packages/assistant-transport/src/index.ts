import {
  agUiEventSchema,
  assistantEventSchema,
  getAgUiEventCursor,
  type AgUiEvent,
  type AssistantEvent,
  type ResumeRunRequest,
} from "@assistant/contracts";

export interface SessionDto {
  id: string;
  title: string;
  mode: "assistant" | "standalone";
  status: "active" | "archived" | "deleted";
  createdAt: string;
}

export interface MessageDto {
  id: string;
  sessionId: string;
  runId: string;
  role: "user" | "assistant";
  content: string;
  evidenceRefs: readonly string[];
  createdAt: string;
}

export interface PendingInterruptDto {
  id: string;
  runId: string;
  reason: string;
  message?: string;
  expiresAt?: string;
}

export interface MessageListDto {
  items: MessageDto[];
  pendingInterrupts?: PendingInterruptDto[];
}

export interface RunDto {
  id?: string;
  runId?: string;
  sessionId: string;
  status: "queued" | "running" | "interrupted" | "completed" | "failed" | "cancelled";
  eventsUrl?: string;
  agUiEventsUrl?: string;
  errorCode?: string;
}

export interface EvidenceDto {
  referenceId: string;
  source: { type: string; id?: string; name?: string };
  scope?: Record<string, unknown>;
  timeRange?: Record<string, unknown>;
  methodology?: string;
  retrievedAt?: string;
}

export class AssistantApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly traceId?: string,
  ) {
    super(message);
  }
}

export interface AssistantTransportOptions {
  apiBaseUrl?: string;
  getAccessCredential: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
  reconnectAttempts?: number;
}

/** Chat Shell 所需的最小端口；管理页面 API 不进入该边界。 */
export interface ChatAgentPort<TEvent> {
  listSessions(): Promise<{ items: SessionDto[] }>;
  createSession(input: { title?: string; mode: "assistant" | "standalone" }): Promise<SessionDto>;
  listMessages(sessionId: string): Promise<MessageListDto>;
  createContextSnapshot(
    context: JsonObject,
    mode?: "assistant" | "standalone",
  ): Promise<{ id: string; version: string; capturedAt: string }>;
  createRun(
    sessionId: string,
    input: { message: string; contextSnapshotId: string; clientRequestId: string },
  ): Promise<RunDto>;
  getRun(runId: string): Promise<RunDto>;
  cancelRun(runId: string): Promise<{ status: string }>;
  resumeRun(runId: string, input: ResumeRunRequest): Promise<RunDto>;
  resolveEvidence(referenceId: string): Promise<EvidenceDto>;
  watchRun(runId: string, signal?: AbortSignal): AsyncGenerator<TEvent>;
}

export type AssistantChatAgentPort = ChatAgentPort<AssistantEvent>;

type JsonObject = Record<string, unknown>;

const terminalStatuses = new Set(["interrupted", "completed", "failed", "cancelled"]);

export class AssistantApiTransport implements ChatAgentPort<AssistantEvent> {
  readonly #baseUrl: string;
  readonly #credential: AssistantTransportOptions["getAccessCredential"];
  readonly #fetch: typeof fetch;
  readonly #reconnectAttempts: number;

  constructor(options: AssistantTransportOptions) {
    this.#baseUrl = (options.apiBaseUrl ?? "/api/v1").replace(/\/$/, "");
    this.#credential = options.getAccessCredential;
    this.#fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.#reconnectAttempts = options.reconnectAttempts ?? 2;
  }

  listSessions(): Promise<{ items: SessionDto[] }> {
    return this.#request("/sessions");
  }

  createSession(input: { title?: string; mode: "assistant" | "standalone" }): Promise<SessionDto> {
    return this.#request("/sessions", { method: "POST", body: JSON.stringify(input) });
  }

  updateSession(id: string, input: { title?: string; archived?: boolean }): Promise<SessionDto> {
    return this.#request(`/sessions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteSession(id: string): Promise<void> {
    return this.#request(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  listMessages(sessionId: string): Promise<MessageListDto> {
    return this.#request(`/sessions/${encodeURIComponent(sessionId)}/messages`);
  }

  createContextSnapshot(
    context: JsonObject,
    mode: "assistant" | "standalone" = "standalone",
  ): Promise<{ id: string; version: string; capturedAt: string }> {
    return this.#request("/context/snapshots", {
      method: "POST",
      headers: { "x-assistant-mode": mode },
      body: JSON.stringify(context),
    });
  }

  createRun(
    sessionId: string,
    input: { message: string; contextSnapshotId: string; clientRequestId: string },
  ): Promise<RunDto> {
    return this.#request(`/sessions/${encodeURIComponent(sessionId)}/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getRun(runId: string): Promise<RunDto> {
    return this.#request(`/runs/${encodeURIComponent(runId)}`);
  }

  cancelRun(runId: string): Promise<{ status: string }> {
    return this.#request(`/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
  }

  resumeRun(runId: string, input: ResumeRunRequest): Promise<RunDto> {
    return this.#request(`/runs/${encodeURIComponent(runId)}/resume`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  resolveEvidence(referenceId: string): Promise<EvidenceDto> {
    return this.#request(`/evidence/${encodeURIComponent(referenceId)}`);
  }

  listModels(): Promise<{ items: JsonObject[] }> {
    return this.#request("/models");
  }

  listMcpServers(): Promise<{ items: JsonObject[] }> {
    return this.#request("/mcp/servers");
  }

  listMcpTools(): Promise<{ items: JsonObject[] }> {
    return this.#request("/mcp/tools");
  }

  listPlatformExtensions(): Promise<{ items: JsonObject[] }> {
    return this.#request("/platform/extensions");
  }

  createEmbedTicket(targetOrigin: string): Promise<{ ticket: string; expiresAt: string }> {
    return this.#request("/embed/tickets", {
      method: "POST",
      body: JSON.stringify({ targetOrigin }),
    });
  }

  async exchangeEmbedTicket(
    ticket: string,
    origin?: string,
  ): Promise<{ accessCredential: string; expiresIn: number }> {
    const response = await this.#fetch(`${this.#baseUrl}/embed/exchange`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(origin === undefined ? {} : { origin }),
      },
      body: JSON.stringify({ ticket }),
    });
    if (!response.ok) await this.#throwResponse(response);
    return (await response.json()) as { accessCredential: string; expiresIn: number };
  }

  async *watchRun(runId: string, signal?: AbortSignal): AsyncGenerator<AssistantEvent> {
    let cursor: string | undefined;
    let attempt = 0;
    const seen = new Set<string>();
    while (!signal?.aborted) {
      try {
        for await (const event of this.#stream(
          runId,
          "events",
          cursor,
          assistantEventSchema,
          signal,
        )) {
          cursor = event.eventId;
          if (seen.has(event.eventId)) continue;
          seen.add(event.eventId);
          yield event;
          if (event.type.startsWith("run.") && event.type !== "run.started") return;
        }
        return;
      } catch (error) {
        if (signal?.aborted) return;
        const run = await this.getRun(runId);
        if (terminalStatuses.has(run.status)) return;
        if (attempt >= this.#reconnectAttempts) throw error;
        attempt += 1;
      }
    }
  }

  async *watchRunAgUi(runId: string, signal?: AbortSignal): AsyncGenerator<AgUiEvent> {
    let cursor: string | undefined;
    let attempt = 0;
    const seen = new Set<string>();
    while (!signal?.aborted) {
      try {
        for await (const event of this.#stream(
          runId,
          "ag-ui/events",
          cursor,
          agUiEventSchema,
          signal,
        )) {
          cursor = getAgUiEventCursor(event);
          if (seen.has(cursor)) continue;
          seen.add(cursor);
          yield event;
          const eventType = String(event.type);
          if (eventType === "RUN_FINISHED" || eventType === "RUN_ERROR") return;
        }
        return;
      } catch (error) {
        if (signal?.aborted) return;
        const run = await this.getRun(runId);
        if (terminalStatuses.has(run.status)) return;
        if (attempt >= this.#reconnectAttempts) throw error;
        attempt += 1;
      }
    }
  }

  async *#stream<T>(
    runId: string,
    path: "events" | "ag-ui/events",
    cursor: string | undefined,
    schema: { parse(value: unknown): T },
    signal: AbortSignal | undefined,
  ): AsyncGenerator<T> {
    const token = await this.#credential();
    const response = await this.#fetch(
      `${this.#baseUrl}/runs/${encodeURIComponent(runId)}/${path}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "text/event-stream",
          ...(cursor === undefined ? {} : { "last-event-id": cursor }),
        },
        ...(signal === undefined ? {} : { signal }),
      },
    );
    if (!response.ok || response.body === null) await this.#throwResponse(response);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data.length > 0) yield schema.parse(JSON.parse(data) as unknown);
      }
      if (done) break;
    }
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.#credential();
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...init.headers,
      },
    });
    if (!response.ok) await this.#throwResponse(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async #throwResponse(response: Response): Promise<never> {
    const payload = (await response.json().catch(() => ({}))) as JsonObject;
    throw new AssistantApiError(
      response.status,
      typeof payload["code"] === "string" ? payload["code"] : "HTTP_ERROR",
      typeof payload["message"] === "string" ? payload["message"] : "Request failed.",
      typeof payload["traceId"] === "string" ? payload["traceId"] : undefined,
    );
  }
}

/** AG-UI 事件版本的 Chat 端口；REST 资源操作继续复用同一受控 Transport。 */
export class AgUiChatAgentPort implements ChatAgentPort<AgUiEvent> {
  constructor(private readonly transport: AssistantApiTransport) {}

  listSessions(): Promise<{ items: SessionDto[] }> {
    return this.transport.listSessions();
  }

  createSession(input: { title?: string; mode: "assistant" | "standalone" }): Promise<SessionDto> {
    return this.transport.createSession(input);
  }

  listMessages(sessionId: string): Promise<MessageListDto> {
    return this.transport.listMessages(sessionId);
  }

  createContextSnapshot(
    context: JsonObject,
    mode?: "assistant" | "standalone",
  ): Promise<{ id: string; version: string; capturedAt: string }> {
    return this.transport.createContextSnapshot(context, mode);
  }

  createRun(
    sessionId: string,
    input: { message: string; contextSnapshotId: string; clientRequestId: string },
  ): Promise<RunDto> {
    return this.transport.createRun(sessionId, input);
  }

  getRun(runId: string): Promise<RunDto> {
    return this.transport.getRun(runId);
  }

  cancelRun(runId: string): Promise<{ status: string }> {
    return this.transport.cancelRun(runId);
  }

  resumeRun(runId: string, input: ResumeRunRequest): Promise<RunDto> {
    return this.transport.resumeRun(runId, input);
  }

  resolveEvidence(referenceId: string): Promise<EvidenceDto> {
    return this.transport.resolveEvidence(referenceId);
  }

  watchRun(runId: string, signal?: AbortSignal): AsyncGenerator<AgUiEvent> {
    return this.transport.watchRunAgUi(runId, signal);
  }
}
