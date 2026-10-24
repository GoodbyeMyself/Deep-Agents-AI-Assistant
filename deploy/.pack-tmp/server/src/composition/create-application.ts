import type { AgentRuntimePolicyInput } from "@assistant/agent-runtime";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import type { FilesystemPermission } from "deepagents";

import { createApiHandler } from "../http/api.js";
import { ContextService, MockContextAuthorizer } from "../modules/context/context-service.js";
import { EmbedTicketService } from "../modules/embed/embed-ticket.js";
import { MockIdentityProvider, type EmbedIdentityProvider } from "../modules/identity/identity.js";
import { AgentRunner, type StreamingAgent } from "../modules/session/runner.js";
import { AgentService } from "../modules/session/service.js";
import { InMemoryAgentStore } from "../modules/session/store.js";
import { createAgentPlatformRuntime } from "./runtime-bootstrap.js";
import { createPostgresStorage } from "./postgres-storage.js";
import type { AgentStore } from "../modules/session/agent-store.js";

export async function createAgentApplication(options: {
  model: BaseLanguageModel;
  tools?: readonly StructuredToolInterface[];
  workspaceRoot?: string;
  skills?: string[];
  permissions?: readonly FilesystemPermission[];
  mcpServers?: readonly Record<string, unknown>[];
  mcpTools?: readonly Record<string, unknown>[];
  platformExtensions?: readonly Record<string, unknown>[];
  modelConfig?: {
    readonly id: string;
    readonly provider: string;
    readonly model: string;
    readonly version: string;
  };
  runtimePolicy?: AgentRuntimePolicyInput;
  databaseUrl?: string;
  identity?: EmbedIdentityProvider;
}) {
  const modelConfig = options.modelConfig ?? {
    id: "default",
    provider: "test",
    model: "configured-model",
    version: "1",
  };
  const storage = options.databaseUrl === undefined ? undefined
    : await createPostgresStorage(options.databaseUrl, `${modelConfig.id}@${modelConfig.version}`);
  const store: AgentStore = storage?.store ?? new InMemoryAgentStore(`${modelConfig.id}@${modelConfig.version}`);
  const checkpointer = storage?.checkpointer ?? new MemorySaver();
  try {
  const boot = createAgentPlatformRuntime({
    model: options.model,
    checkpointer,
    ...(options.tools === undefined ? {} : { tools: options.tools }),
    ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
    ...(options.skills === undefined ? {} : { skills: options.skills }),
    ...(options.permissions === undefined ? {} : { permissions: options.permissions }),
    ...(options.runtimePolicy === undefined ? {} : { runtimePolicy: options.runtimePolicy }),
  });
  const runner = new AgentRunner(
    boot.agent as unknown as StreamingAgent,
    store,
    boot.runtimePolicy,
  );
  const service = new AgentService(store, new ContextService(new MockContextAuthorizer()), runner, {
    models: [{ ...modelConfig, enabled: true }],
    mcpServers: options.mcpServers ?? [],
    mcpTools: options.mcpTools ?? [],
    platformExtensions: options.platformExtensions ?? [],
  });
  const identity = options.identity ?? new MockIdentityProvider();
  const embedTickets = new EmbedTicketService(identity);
  const handler = createApiHandler({ identity, service, embedTickets });
  return Promise.resolve({
    ...boot,
    checkpointer,
    dispose: async () => { await runner.close(); await storage?.close(); },
    embedTickets,
    handler,
    identity,
    runner,
    service,
    store,
  });
  } catch (error) { await storage?.close(); throw error; }
}
