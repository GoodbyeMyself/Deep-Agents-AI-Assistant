import { createAgentRuntime, createCapabilityTools } from "@assistant/agent-runtime";
import {
  CapabilityExecutor,
  CapabilityRegistry,
  createStandardCapabilityCatalog,
} from "@assistant/capability-contracts";
import { PluginRuntime } from "@assistant/plugin-runtime";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import type { CapabilityAuditSink, CapabilityPolicy } from "@assistant/capability-contracts";

export async function createAgentFromInstalledPlugins(options: {
  model: BaseLanguageModel;
  installDir: string;
  approvedPluginIds: ReadonlySet<string>;
  approvedNamespaces?: ReadonlySet<string>;
  approvedPermissions?: ReadonlySet<string>;
  checkpointer?: BaseCheckpointSaver;
  policy?: CapabilityPolicy;
  audit?: CapabilityAuditSink;
}) {
  const catalog = createStandardCapabilityCatalog();
  const registry = new CapabilityRegistry();
  const pluginRuntime = new PluginRuntime({
    installDir: options.installDir,
    approvedPluginIds: options.approvedPluginIds,
    ...(options.approvedNamespaces === undefined
      ? {}
      : { approvedNamespaces: options.approvedNamespaces }),
    ...(options.approvedPermissions === undefined
      ? {}
      : { approvedPermissions: options.approvedPermissions }),
    catalog,
    capabilityRegistry: registry,
  });
  const pluginRecords = await pluginRuntime.start();
  const executor = new CapabilityExecutor({
    catalog,
    registry,
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.audit === undefined ? {} : { audit: options.audit }),
  });
  const tools = createCapabilityTools({ catalog, registry, executor });
  const agent = createAgentRuntime({
    model: options.model,
    tools,
    ...(options.checkpointer === undefined ? {} : { checkpointer: options.checkpointer }),
  });

  return { agent, catalog, executor, pluginRecords, registry, tools };
}
