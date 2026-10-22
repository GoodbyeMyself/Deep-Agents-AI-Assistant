import type { AgentRuntimePolicyInput } from "@assistant/agent-runtime";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";

import { createApiHandler } from "../http/api.js";
import { ContextService, MockContextAuthorizer } from "../modules/context/context-service.js";
import { EmbedTicketService } from "../modules/embed/embed-ticket.js";
import { MockIdentityProvider } from "../modules/identity/identity.js";
import { AgentRunner, type StreamingAgent } from "../modules/session/runner.js";
import { AgentService } from "../modules/session/service.js";
import { InMemoryAgentStore } from "../modules/session/store.js";
import { createAgentPlatformRuntime } from "./runtime-bootstrap.js";

export async function createAgentApplication(options: {
  model: BaseLanguageModel;
  tools?: readonly StructuredToolInterface[];
  mcpServers?: readonly Record<string, unknown>[];
  mcpTools?: readonly Record<string, unknown>[];
  modelConfig?: {
    readonly id: string;
    readonly provider: string;
    readonly model: string;
    readonly version: string;
  };
  runtimePolicy?: AgentRuntimePolicyInput;
}) {
  const modelConfig = options.modelConfig ?? {
    id: "default",
    provider: "test",
    model: "configured-model",
    version: "1",
  };
  const store = new InMemoryAgentStore(`${modelConfig.id}@${modelConfig.version}`);
  const checkpointer = new MemorySaver();
  const boot = createAgentPlatformRuntime({
    model: options.model,
    checkpointer,
    ...(options.tools === undefined ? {} : { tools: options.tools }),
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
  });
  const identity = new MockIdentityProvider();
  const embedTickets = new EmbedTicketService(identity);
  const handler = createApiHandler({ identity, service, embedTickets });
  return {
    ...boot,
    checkpointer,
    dispose: () => Promise.resolve(),
    embedTickets,
    handler,
    identity,
    runner,
    service,
    store,
  };
}
