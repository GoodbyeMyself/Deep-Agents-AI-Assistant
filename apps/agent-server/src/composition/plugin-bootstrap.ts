import {
  createAgentRuntime,
  createCapabilityTools,
  createSkillSnapshot,
} from "@assistant/agent-runtime";
import {
  CapabilityCatalog,
  CapabilityExecutor,
  CapabilityRegistry,
} from "@assistant/capability-core";
import type { CapabilityAuditSink, CapabilityPolicy } from "@assistant/capability-core";
import {
  DATA_MAP_CAPABILITY_SOURCE,
  dataMapCapabilityContracts,
} from "@assistant/capability-data-map";
import {
  DATA_QUALITY_CAPABILITY_SOURCE,
  dataQualityCapabilityContracts,
} from "@assistant/capability-data-quality";
import { PluginRuntime } from "@assistant/plugin-runtime";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

export async function createAgentFromInstalledPlugins(options: {
  model: BaseLanguageModel;
  installDir: string;
  approvedPluginIds: ReadonlySet<string>;
  approvedNamespaces?: ReadonlySet<string>;
  approvedPermissions?: ReadonlySet<string>;
  checkpointer?: BaseCheckpointSaver;
  policy?: CapabilityPolicy;
  audit?: CapabilityAuditSink;
  pluginConfigs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  hasCredential?: (pluginId: string, reference: string) => Promise<boolean>;
  approvedSkillDependencies?: ReadonlySet<string>;
}) {
  const catalog = new CapabilityCatalog();
  catalog.registerMany(dataMapCapabilityContracts, DATA_MAP_CAPABILITY_SOURCE);
  catalog.registerMany(dataQualityCapabilityContracts, DATA_QUALITY_CAPABILITY_SOURCE);
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
    ...(options.pluginConfigs === undefined ? {} : { pluginConfigs: options.pluginConfigs }),
    ...(options.hasCredential === undefined ? {} : { hasCredential: options.hasCredential }),
    ...(options.approvedSkillDependencies === undefined
      ? {}
      : { approvedSkillDependencies: options.approvedSkillDependencies }),
  });
  const pluginRecords = await pluginRuntime.start();
  const executor = new CapabilityExecutor({
    catalog,
    registry,
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.audit === undefined ? {} : { audit: options.audit }),
  });
  const tools = createCapabilityTools({ catalog, registry, executor });
  const skillSnapshot = await createSkillSnapshot(pluginRuntime.skillRegistry.list());
  const agent = createAgentRuntime({
    model: options.model,
    tools,
    ...(skillSnapshot.workspaceRoot === undefined
      ? {}
      : {
          workspaceRoot: skillSnapshot.workspaceRoot,
          skills: [...skillSnapshot.skillPaths],
          permissions: [
            { operations: ["read"], paths: ["/skills/**"], mode: "allow" },
            { operations: ["write"], paths: ["/**"], mode: "deny" },
            { operations: ["read"], paths: ["/**"], mode: "deny" },
          ],
        }),
    ...(options.checkpointer === undefined ? {} : { checkpointer: options.checkpointer }),
  });

  return {
    agent,
    catalog,
    executor,
    pluginRecords,
    registry,
    skillSnapshot,
    skills: pluginRuntime.skillRegistry.list(),
    tools,
  };
}
