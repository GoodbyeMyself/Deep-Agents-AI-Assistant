import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuntimePolicyMiddleware,
  defaultAgentRuntimePolicy,
  resolveAgentRuntimePolicy,
} from "../../packages/agent-runtime/dist/index.js";
import {
  AnswerValidationError,
  validateAnswer,
} from "../../apps/agent-server/dist/index.js";

test("builds one summarizer and independent tool/model call guards", () => {
  const middleware = createRuntimePolicyMiddleware({}, defaultAgentRuntimePolicy);

  assert.deepEqual(
    middleware.map((entry) => entry.name),
    ["SummarizationMiddleware", "ToolCallLimitMiddleware", "ModelCallLimitMiddleware"],
  );
});

test("resolves one immutable runtime policy with governed defaults", () => {
  const policy = resolveAgentRuntimePolicy({
    limits: { maxToolCallsPerRun: 4 },
  });

  assert.equal(policy.limits.maxToolCallsPerRun, 4);
  assert.equal(policy.limits.maxModelCallsPerRun, 10);
  assert.equal(policy.contextCompression.triggerTokens, 40_000);
  assert.equal(policy.answerValidation.requireEvidenceForBusinessResults, true);
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(policy.limits), true);
});

test("rejects unknown runtime policy fields", () => {
  assert.throws(
    () => resolveAgentRuntimePolicy({ limits: { unexpectedLimit: 1 } }),
    /unrecognized|unexpectedLimit/i,
  );
});

test("releases a validated evidence-backed answer", () => {
  const checked = [];
  const answer = validateAnswer(
    {
      text: "The observed quality score is supported by the attached evidence.",
      evidenceRefs: ["ev-1", "ev-1"],
      capabilityStatuses: ["success"],
    },
    defaultAgentRuntimePolicy.answerValidation,
    (referenceId) => checked.push(referenceId),
  );

  assert.deepEqual(checked, ["ev-1"]);
  assert.deepEqual(answer.evidenceRefs, ["ev-1"]);
  assert.equal(answer.partial, false);
});

test("fails closed when a business result has no evidence", () => {
  assert.throws(
    () =>
      validateAnswer(
        {
          text: "A factual business answer without evidence.",
          evidenceRefs: [],
          capabilityStatuses: ["success"],
        },
        defaultAgentRuntimePolicy.answerValidation,
        () => undefined,
      ),
    (error) => error instanceof AnswerValidationError && error.code === "EVIDENCE_REQUIRED",
  );
});

test("fails closed when an evidence reference is not authorized for the run", () => {
  assert.throws(
    () =>
      validateAnswer(
        {
          text: "An answer with a forged evidence reference.",
          evidenceRefs: ["ev-other-run"],
          capabilityStatuses: ["success"],
        },
        defaultAgentRuntimePolicy.answerValidation,
        () => {
          throw new Error("not found");
        },
      ),
    (error) => error instanceof AnswerValidationError && error.code === "EVIDENCE_INVALID",
  );
});

test("adds a server-controlled disclosure to partial results", () => {
  const answer = validateAnswer(
    {
      text: "Only part of the requested period was returned.",
      evidenceRefs: ["ev-2"],
      capabilityStatuses: ["partial"],
    },
    defaultAgentRuntimePolicy.answerValidation,
    () => undefined,
  );

  assert.equal(answer.partial, true);
  assert.match(answer.text, /Data limitation \/ 数据限制/);
});
