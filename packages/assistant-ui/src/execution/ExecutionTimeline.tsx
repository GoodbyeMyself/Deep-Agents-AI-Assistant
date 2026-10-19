import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { ThoughtChain } from "@ant-design/x";
import { useEffect, useId, useState } from "react";

import type { PublicExecutionStep } from "../chat/types.js";

export function ExecutionTimeline({
  steps,
  status,
}: {
  steps: PublicExecutionStep[];
  status: "loading" | "success" | "error" | "abort";
}) {
  const shouldExpand = status === "loading" || status === "error";
  const [expanded, setExpanded] = useState(shouldExpand);
  const detailsId = useId();

  useEffect(() => {
    setExpanded(shouldExpand);
  }, [shouldExpand]);

  if (steps.length === 0) return null;
  const completedCount = steps.filter((step) => step.status === "success").length;
  const summary =
    status === "loading"
      ? "正在执行"
      : status === "error"
        ? "执行遇到问题"
        : status === "abort"
          ? "执行已取消"
          : `执行完成 · ${completedCount} 个步骤`;

  return (
    <section className="assistant-execution" aria-label="执行过程">
      <button
        type="button"
        className="assistant-execution-toggle"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={`assistant-execution-status is-${status}`} aria-hidden="true">
          {status === "loading" ? (
            <LoadingOutlined spin />
          ) : status === "success" ? (
            <CheckCircleFilled />
          ) : (
            <CloseCircleFilled />
          )}
        </span>
        <span className="assistant-execution-summary">
          <strong>{summary}</strong>
          {status === "loading" ? <small>工具与协作状态将实时更新</small> : null}
        </span>
        <RightOutlined className={expanded ? "is-expanded" : undefined} aria-hidden="true" />
      </button>
      {expanded ? (
        <div id={detailsId} className="assistant-execution-details">
          <ThoughtChain
            line="solid"
            items={steps.map((step) => ({
              key: step.key,
              title: step.title,
              ...(step.detail === undefined ? {} : { description: step.detail }),
              status: step.status === "pending" ? "loading" : step.status,
            }))}
          />
          <span className="assistant-private-note">
            仅展示可公开的工具与协作状态，不展示模型私有推理。
          </span>
        </div>
      ) : null}
    </section>
  );
}
