import { enterpriseCapabilityPolicy } from "@assistant/policy";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { MemorySaver } from "@langchain/langgraph";

import { createApiHandler } from "../http/api.js";
import { EmbedTicketService } from "../modules/embed/embed-ticket.js";
import { ContextService, MockContextAuthorizer } from "../modules/context/context-service.js";
import { MockIdentityProvider } from "../modules/identity/identity.js";
import { AgentRunner, type StreamingAgent } from "../modules/session/runner.js";
import { AgentService } from "../modules/session/service.js";
import { InMemoryAgentStore } from "../modules/session/store.js";
import { createAgentFromInstalledPlugins } from "./plugin-bootstrap.js";

export async function createAgentApplication(options: {
  model: BaseLanguageModel;
  installDir: string;
  approvedPluginIds: ReadonlySet<string>;
  approvedNamespaces?: ReadonlySet<string>;
  approvedPermissions?: ReadonlySet<string>;
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
      manifestVersion: record.manifestVersion,
      status: record.status,
      ...(record.namespace === undefined ? {} : { namespace: record.namespace }),
      ...(record.capabilities === undefined ? {} : { capabilities: record.capabilities }),
      ...(record.failureStage === undefined ? {} : { failureStage: record.failureStage }),
      ...(record.errorCode === undefined ? {} : { errorCode: record.errorCode }),
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
