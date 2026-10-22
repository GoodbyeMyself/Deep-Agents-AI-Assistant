import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import {
  modelCallLimitMiddleware,
  summarizationMiddleware,
  toolCallLimitMiddleware,
  type AgentMiddleware,
} from "langchain";
import { z } from "zod";

interface SummarizationMiddlewareOptions {
  readonly model: BaseLanguageModel;
  readonly trigger: { readonly tokens: number };
  readonly keep: { readonly messages: number };
  readonly trimTokensToSummarize: number;
}

interface CallLimitMiddlewareOptions {
  readonly runLimit: number;
  readonly exitBehavior: "error";
}

type MiddlewareFactory<Options> = (options: Options) => AgentMiddleware;

// langchain@1.5.10 builds these option types through its Zod v3/v4 interop
// helpers. With this workspace's verified Zod 4 override and
// exactOptionalPropertyTypes, the published declarations collapse the three
// parameters to never/undefined. Keep the workaround at this third-party
// boundary and describe only the options confirmed in the locked source tag.
const createSummarizationMiddleware = summarizationMiddleware as unknown as MiddlewareFactory<
  SummarizationMiddlewareOptions
>;
const createToolCallLimitMiddleware = toolCallLimitMiddleware as unknown as MiddlewareFactory<
  CallLimitMiddlewareOptions
>;
const createModelCallLimitMiddleware = modelCallLimitMiddleware as unknown as MiddlewareFactory<
  CallLimitMiddlewareOptions
>;

const contextCompressionPolicySchema = z
  .object({
    triggerTokens: z.number().int().positive().default(40_000),
    keepRecentMessages: z.number().int().positive().default(24),
    trimTokensToSummarize: z.number().int().positive().default(32_000),
  })
  .strict()
  .default({
    triggerTokens: 40_000,
    keepRecentMessages: 24,
    trimTokensToSummarize: 32_000,
  });

const runtimeLimitPolicySchema = z
  .object({
    recursionLimit: z.number().int().positive().default(50),
    maxToolCallsPerRun: z.number().int().positive().default(12),
    maxModelCallsPerRun: z.number().int().positive().default(10),
    runTimeoutMs: z.number().int().positive().default(120_000),
  })
  .strict()
  .default({
    recursionLimit: 50,
    maxToolCallsPerRun: 12,
    maxModelCallsPerRun: 10,
    runTimeoutMs: 120_000,
  });

const answerValidationPolicySchema = z
  .object({
    maxAnswerCharacters: z.number().int().positive().default(50_000),
    requireEvidenceForBusinessResults: z.boolean().default(true),
    appendPartialDisclosure: z.boolean().default(true),
  })
  .strict()
  .default({
    maxAnswerCharacters: 50_000,
    requireEvidenceForBusinessResults: true,
    appendPartialDisclosure: true,
  });

export const agentRuntimePolicySchema = z
  .object({
    contextCompression: contextCompressionPolicySchema,
    limits: runtimeLimitPolicySchema,
    answerValidation: answerValidationPolicySchema,
  })
  .strict();

type DeepReadonly<T> = {
  readonly [Key in keyof T]: T[Key] extends object ? DeepReadonly<T[Key]> : T[Key];
};

export type AgentRuntimePolicy = DeepReadonly<z.output<typeof agentRuntimePolicySchema>>;
export type AgentRuntimePolicyInput = z.input<typeof agentRuntimePolicySchema>;

function freezePolicy(value: z.output<typeof agentRuntimePolicySchema>): AgentRuntimePolicy {
  Object.freeze(value.contextCompression);
  Object.freeze(value.limits);
  Object.freeze(value.answerValidation);
  return Object.freeze(value);
}

export const defaultAgentRuntimePolicy: AgentRuntimePolicy = freezePolicy(
  agentRuntimePolicySchema.parse({}),
);

export function resolveAgentRuntimePolicy(
  input?: AgentRuntimePolicyInput,
): AgentRuntimePolicy {
  return freezePolicy(agentRuntimePolicySchema.parse(input ?? {}));
}

/**
 * Builds the project-governed middleware stack from public LangChain APIs.
 *
 * Deep Agents 1.14.2 already installs a middleware named
 * `SummarizationMiddleware`. Supplying the same named LangChain middleware is
 * intentional: Deep Agents replaces its auto-configured instance rather than
 * stacking a second summarizer, giving non-OpenAI-compatible models explicit
 * token thresholds.
 */
export function createRuntimePolicyMiddleware(
  model: BaseLanguageModel,
  policy: AgentRuntimePolicy,
): readonly AgentMiddleware[] {
  return [
    createSummarizationMiddleware({
      model,
      trigger: { tokens: policy.contextCompression.triggerTokens },
      keep: { messages: policy.contextCompression.keepRecentMessages },
      trimTokensToSummarize: policy.contextCompression.trimTokensToSummarize,
    }),
    createToolCallLimitMiddleware({
      runLimit: policy.limits.maxToolCallsPerRun,
      exitBehavior: "error",
    }),
    createModelCallLimitMiddleware({
      runLimit: policy.limits.maxModelCallsPerRun,
      exitBehavior: "error",
    }),
  ];
}
