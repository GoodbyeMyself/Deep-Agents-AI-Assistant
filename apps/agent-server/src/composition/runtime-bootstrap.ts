import {
  createAgentRuntime,
  resolveAgentRuntimePolicy,
  type AgentRuntimePolicyInput,
} from "@assistant/agent-runtime";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

/** Platform composition boundary. Business tools enter only through the MCP client runtime. */
export function createAgentPlatformRuntime(options: {
  model: BaseLanguageModel;
  tools?: readonly StructuredToolInterface[];
  checkpointer?: BaseCheckpointSaver;
  runtimePolicy?: AgentRuntimePolicyInput;
}) {
  const runtimePolicy = resolveAgentRuntimePolicy(options.runtimePolicy);
  const tools = [...(options.tools ?? [])];
  const agent = createAgentRuntime({
    model: options.model,
    tools,
    runtimePolicy,
    ...(options.checkpointer === undefined ? {} : { checkpointer: options.checkpointer }),
  });
  return { agent, runtimePolicy, tools };
}
