import { ThoughtChain } from "@ant-design/x";

import type { PublicExecutionStep } from "./types.js";

export function ExecutionTimeline({ steps }: { steps: PublicExecutionStep[] }) {
  if (steps.length === 0) return null;
  return (
    <section className="assistant-execution" aria-label="执行进度">
      <div className="assistant-eyebrow">公开执行进度</div>
      <ThoughtChain
        line="solid"
        items={steps.map((step) => ({
          key: step.key,
          title: step.title,
          ...(step.detail === undefined ? {} : { description: step.detail }),
          status: step.status === "pending" ? "loading" : step.status,
        }))}
      />
      <span className="assistant-private-note">仅展示工具与协作状态，不展示模型私有推理。</span>
    </section>
  );
}
