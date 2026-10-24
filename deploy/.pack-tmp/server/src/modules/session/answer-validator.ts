import type { AgentRuntimePolicy } from "@assistant/agent-runtime";

export type AnswerValidationErrorCode =
  | "ANSWER_EMPTY"
  | "ANSWER_TOO_LARGE"
  | "EVIDENCE_REQUIRED"
  | "EVIDENCE_INVALID";

export class AnswerValidationError extends Error {
  constructor(readonly code: AnswerValidationErrorCode) {
    super("The generated answer did not satisfy the trusted answer contract.");
    this.name = "AnswerValidationError";
  }
}

export interface AnswerValidationInput {
  readonly text: string;
  readonly evidenceRefs: readonly string[];
  readonly capabilityStatuses: readonly ("success" | "partial" | "error")[];
}

export interface ValidatedAnswer {
  readonly text: string;
  readonly evidenceRefs: readonly string[];
  readonly partial: boolean;
}

const PARTIAL_DISCLOSURE =
  "> Data limitation / 数据限制：至少一个业务能力返回了部分结果，请结合证据、范围和警告解读。";

/**
 * Validates only server-verifiable answer properties. It deliberately does not
 * ask another model to decide whether its own prose is authorized or factual.
 */
export function validateAnswer(
  input: AnswerValidationInput,
  policy: AgentRuntimePolicy["answerValidation"],
  validateEvidenceRef: (referenceId: string) => void,
): ValidatedAnswer {
  const text = input.text.trim();
  if (text.length === 0) throw new AnswerValidationError("ANSWER_EMPTY");
  if (text.length > policy.maxAnswerCharacters)
    throw new AnswerValidationError("ANSWER_TOO_LARGE");

  const evidenceRefs = [...new Set(input.evidenceRefs)];
  try {
    for (const referenceId of evidenceRefs) validateEvidenceRef(referenceId);
  } catch {
    throw new AnswerValidationError("EVIDENCE_INVALID");
  }

  const hasBusinessResult = input.capabilityStatuses.some(
    (status) => status === "success" || status === "partial",
  );
  if (
    policy.requireEvidenceForBusinessResults &&
    hasBusinessResult &&
    evidenceRefs.length === 0
  )
    throw new AnswerValidationError("EVIDENCE_REQUIRED");

  const partial = input.capabilityStatuses.includes("partial");
  const releasedText =
    partial && policy.appendPartialDisclosure ? `${text}\n\n${PARTIAL_DISCLOSURE}` : text;
  if (releasedText.length > policy.maxAnswerCharacters)
    throw new AnswerValidationError("ANSWER_TOO_LARGE");

  return { text: releasedText, evidenceRefs, partial };
}
