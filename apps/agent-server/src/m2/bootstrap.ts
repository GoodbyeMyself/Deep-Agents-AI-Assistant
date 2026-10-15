import { enterpriseCapabilityPolicy } from "@assistant/policy";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { MemorySaver } from "@langchain/langgraph";

import { createAgentFromInstalledPlugins } from "../m1-bootstrap.js";
import { createApiHandler } from "./api.js";
import { ContextService, MockContextAuthorizer } from "./context-service.js";
import { EmbedTicketService } from "./embed-ticket.js";
import { MockIdentityProvider } from "./identity.js";
import { AgentRunner, type StreamingAgent } from "./runner.js";
import { AgentService } from "./service.js";
import { InMemoryAgentStore } from "./store.js";

export async function createM2Application(options: {
  model: BaseLanguageModel;
  installDir: string;
  approvedPluginIds: ReadonlySet<string>;
  modelConfig?: {
    readonly id: string;
    readonly provider: string;
    readonly model: string;
    readonly version: string;
  };
}) {
  const modelConfig = options.modelConfig ?? {
    id: "default",
    provider: "test",
    model: "configured-model",
    version: "1",
  };
  const store = new InMemoryAgentStore(`${modelConfig.id}@${modelConfig.version}`);
  const checkpointer = new MemorySaver();
  const boot = await createAgentFromInstalledPlugins({
    ...options,
    policy: enterpriseCapabilityPolicy,
    audit: store,
    checkpointer,
  });
  const runner = new AgentRunner(boot.agent as unknown as StreamingAgent, store);
  const service = new AgentService(store, new ContextService(new MockContextAuthorizer()), runner, {
    models: [
      {
        ...modelConfig,
        enabled: true,
      },
    ],
    plugins: boot.pluginRecords.map((record) => ({
      pluginId: record.pluginId,
      pluginVersion: record.pluginVersion,
      status: record.status,
    })),
    capabilities: boot.registry.list().map((binding) => ({
      id: binding.capabilityId,
      version: binding.contractVersion,
      pluginId: binding.pluginId,
    })),
  });
  const identity = new MockIdentityProvider();
  const embedTickets = new EmbedTicketService(identity);
  const handler = createApiHandler({ identity, service, embedTickets });
  return { ...boot, checkpointer, embedTickets, handler, identity, runner, service, store };
}
