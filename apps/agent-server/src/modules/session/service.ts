import type { ContextSnapshot, VerifiedPrincipal } from "@assistant/context";
import {
  createRunRequestSchema,
  createSessionRequestSchema,
  patchSessionRequestSchema,
} from "@assistant/contracts";

import type { ContextService } from "../context/context-service.js";
import { ServiceError } from "../../shared/errors.js";
import type { AgentRunner } from "./runner.js";
import type { InMemoryAgentStore } from "./store.js";

function parseOrThrow<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ServiceError("INVALID_INPUT", "Request does not satisfy the API contract.", 400);
  return parsed.data;
}

export class AgentService {
  constructor(
    readonly store: InMemoryAgentStore,
    private readonly contexts: ContextService,
    readonly runner: AgentRunner,
    readonly runtimeInfo: {
      readonly models: readonly Record<string, unknown>[];
      readonly plugins: readonly Record<string, unknown>[];
      readonly capabilities: readonly Record<string, unknown>[];
      readonly skills?: readonly Record<string, unknown>[];
    } = { models: [], plugins: [], capabilities: [] },
  ) {}

  async createSnapshot(
    body: unknown,
    mode: "assistant" | "standalone",
    principal: VerifiedPrincipal,
  ): Promise<ContextSnapshot> {
    const snapshot = await this.contexts.create(body, mode, principal);
    this.store.saveSnapshot(snapshot);
    return snapshot;
  }

  createSession(body: unknown, principal: VerifiedPrincipal) {
    const input = parseOrThrow(createSessionRequestSchema, body);
    return this.store.createSession(principal, input.mode, input.title);
  }

  patchSession(id: string, body: unknown, principal: VerifiedPrincipal) {
    const input = parseOrThrow(patchSessionRequestSchema, body);
    return this.store.patchSession(id, principal, {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.archived === undefined ? {} : { archived: input.archived }),
    });
  }

  createRun(sessionId: string, body: unknown, principal: VerifiedPrincipal) {
    const input = parseOrThrow(createRunRequestSchema, body);
    const result = this.store.createRun({ principal, sessionId, ...input });
    if (result.created) this.runner.start(result.run, principal);
    return result.run;
  }
}
