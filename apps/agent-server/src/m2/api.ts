import { apiErrorSchema, openApiDocument } from "@assistant/contracts";
import { randomUUID } from "node:crypto";

import { ServiceError } from "./errors.js";
import type { EmbedTicketService } from "./embed-ticket.js";
import type { IdentityProvider } from "./identity.js";
import type { AgentService } from "./service.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

async function body(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > 64 * 1024)
    throw new ServiceError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
  const text = await request.text();
  if (text.length > 64 * 1024)
    throw new ServiceError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
  if (text.length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ServiceError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
}

function sseEvent(event: { eventId: string; type: string }): string {
  return `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export class FixedWindowRateLimiter {
  readonly #counts = new Map<string, { window: number; count: number }>();
  constructor(
    private readonly limit = 100,
    private readonly windowMs = 60_000,
  ) {}
  check(key: string): boolean {
    const window = Math.floor(Date.now() / this.windowMs);
    const current = this.#counts.get(key);
    if (current === undefined || current.window !== window) {
      this.#counts.set(key, { window, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= this.limit;
  }
}

export function createApiHandler(options: {
  identity: IdentityProvider;
  service: AgentService;
  embedTickets?: EmbedTicketService;
  rateLimiter?: FixedWindowRateLimiter;
}) {
  const limiter = options.rateLimiter ?? new FixedWindowRateLimiter();
  return async (request: Request): Promise<Response> => {
    const traceId = randomUUID();
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/openapi.json")
        return json(openApiDocument);
      if (!url.pathname.startsWith("/api/v1/"))
        throw new ServiceError("NOT_FOUND", "Resource not found.", 404);
      if (url.pathname === "/api/v1/embed/exchange" && request.method === "POST") {
        if (options.embedTickets === undefined)
          throw new ServiceError("NOT_FOUND", "Resource not found.", 404);
        const payload = await body(request);
        const ticket =
          typeof payload === "object" && payload !== null && "ticket" in payload
            ? (payload as { ticket?: unknown }).ticket
            : undefined;
        if (typeof ticket !== "string")
          throw new ServiceError("INVALID_EMBED_TICKET", "Embed ticket is required.", 400);
        return json(options.embedTickets.exchange(ticket, request.headers.get("origin")), 200, {
          "cache-control": "no-store",
        });
      }
      const principal = await options.identity.authenticate(request.headers.get("authorization"));
      if (!limiter.check(principal.id))
        throw new ServiceError("RATE_LIMITED", "Too many requests.", 429);

      if (url.pathname === "/api/v1/context/snapshots" && request.method === "POST") {
        const mode =
          request.headers.get("x-assistant-mode") === "standalone" ? "standalone" : "assistant";
        const snapshot = await options.service.createSnapshot(await body(request), mode, principal);
        return json(
          { id: snapshot.id, version: snapshot.version, capturedAt: snapshot.capturedAt },
          201,
        );
      }
      if (url.pathname === "/api/v1/embed/tickets" && request.method === "POST") {
        if (options.embedTickets === undefined)
          throw new ServiceError("NOT_FOUND", "Resource not found.", 404);
        const payload = await body(request);
        const targetOrigin =
          typeof payload === "object" && payload !== null && "targetOrigin" in payload
            ? (payload as { targetOrigin?: unknown }).targetOrigin
            : undefined;
        if (typeof targetOrigin !== "string")
          throw new ServiceError("INVALID_ORIGIN", "Target origin is required.", 400);
        return json(options.embedTickets.create(principal, targetOrigin), 201, {
          "cache-control": "no-store",
        });
      }
      if (url.pathname === "/api/v1/sessions" && request.method === "POST")
        return json(options.service.createSession(await body(request), principal), 201);
      if (url.pathname === "/api/v1/sessions" && request.method === "GET")
        return json({ items: options.service.store.listSessions(principal) });
      if (url.pathname === "/api/v1/models" && request.method === "GET")
        return json({ items: options.service.runtimeInfo.models });
      if (url.pathname === "/api/v1/plugins" && request.method === "GET") {
        if (!principal.permissionScopes.includes("platform:admin"))
          throw new ServiceError("FORBIDDEN", "Access denied.", 403);
        return json({ items: options.service.runtimeInfo.plugins });
      }
      if (url.pathname === "/api/v1/capabilities" && request.method === "GET")
        return json({ items: options.service.runtimeInfo.capabilities });

      const sessionMatch = url.pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)$/i);
      if (sessionMatch?.[1] !== undefined) {
        const id = sessionMatch[1];
        if (request.method === "GET")
          return json(options.service.store.requireSession(id, principal));
        if (request.method === "PATCH")
          return json(options.service.patchSession(id, await body(request), principal));
        if (request.method === "DELETE") {
          options.service.store.deleteSession(id, principal);
          return new Response(null, { status: 204 });
        }
      }
      const messagesMatch = url.pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)\/messages$/i);
      if (messagesMatch?.[1] !== undefined && request.method === "GET")
        return json({ items: options.service.store.listMessages(messagesMatch[1], principal) });
      const createRunMatch = url.pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)\/runs$/i);
      if (createRunMatch?.[1] !== undefined && request.method === "POST") {
        const run = options.service.createRun(createRunMatch[1], await body(request), principal);
        return json(
          {
            runId: run.id,
            sessionId: run.sessionId,
            status: run.status,
            eventsUrl: `/api/v1/runs/${run.id}/events`,
          },
          202,
        );
      }
      const runMatch = url.pathname.match(/^\/api\/v1\/runs\/([0-9a-f-]+)$/i);
      if (runMatch?.[1] !== undefined && request.method === "GET")
        return json(options.service.store.requireRun(runMatch[1], principal));
      const eventsMatch = url.pathname.match(/^\/api\/v1\/runs\/([0-9a-f-]+)\/events$/i);
      if (eventsMatch?.[1] !== undefined && request.method === "GET") {
        const cursor =
          request.headers.get("last-event-id") ?? url.searchParams.get("cursor") ?? undefined;
        options.service.store.listEvents(eventsMatch[1], principal, cursor);
        const events = options.service.store.streamEvents(eventsMatch[1], principal, cursor);
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const event of events) controller.enqueue(encoder.encode(sseEvent(event)));
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
          async cancel() {
            await events.return(undefined);
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        });
      }
      const cancelMatch = url.pathname.match(/^\/api\/v1\/runs\/([0-9a-f-]+)\/cancel$/i);
      if (cancelMatch?.[1] !== undefined && request.method === "POST") {
        options.service.runner.cancel(cancelMatch[1], principal);
        return json({ status: "cancelled" }, 202);
      }
      const evidenceMatch = url.pathname.match(/^\/api\/v1\/evidence\/(.+)$/);
      if (evidenceMatch?.[1] !== undefined && request.method === "GET")
        return json(
          options.service.store.getEvidence(decodeURIComponent(evidenceMatch[1]), principal),
        );
      throw new ServiceError("NOT_FOUND", "Resource not found.", 404);
    } catch (error) {
      const safe =
        error instanceof ServiceError
          ? error
          : new ServiceError("INTERNAL_ERROR", "An internal error occurred.", 500);
      return json(
        apiErrorSchema.parse({ code: safe.code, message: safe.message, traceId }),
        safe.status,
      );
    }
  };
}
