import type { ChatAgentPort } from "@assistant/assistant-transport";
import type { AgUiEvent, HostNavigationAction } from "@assistant/contracts";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Actions, Bubble, Think } from "@ant-design/x";
import { Avatar, Empty, Space } from "antd";
import { useState } from "react";

import { EvidencePanel } from "../evidence/EvidencePanel.js";
import { ExecutionTimeline } from "../execution/ExecutionTimeline.js";
import { AssistantViewRenderer } from "../view/AssistantViewRenderer.js";
import { SafeContent } from "../view/SafeContent.js";
import { ApprovalCard } from "./ApprovalCard.js";
import type { ApprovalRequest, ChatMessage } from "./types.js";

const bubbleRoles = {
  user: {
    placement: "end" as const,
    variant: "filled" as const,
    shape: "corner" as const,
    avatar: (
      <Avatar style={{ backgroundColor: "#91caff", color: "#0958d9" }} icon={<UserOutlined />} />
    ),
    styles: {
      content: {
        backgroundColor: "#e6f4ff",
        color: "rgba(0, 0, 0, 0.88)",
      },
    },
  },
  ai: {
    placement: "start" as const,
    variant: "shadow" as const,
    shape: "corner" as const,
    footerPlacement: "outer-start" as const,
    avatar: (
      <Avatar style={{ backgroundColor: "#fde3cf", color: "#f56a00" }} icon={<RobotOutlined />} />
    ),
    styles: {
      content: {
        backgroundColor: "#ffffff",
      },
    },
  },
};

function AssistantMessageActions({ content }: { content: string }) {
  const [feedback, setFeedback] = useState<"default" | "dislike" | "like">("default");
  const text = content.trim();
  if (text.length === 0) return null;
  return (
    <Actions
      className="assistant-message-actions"
      items={[
        { key: "copy", actionRender: <Actions.Copy text={text} /> },
        {
          key: "feedback",
          actionRender: <Actions.Feedback value={feedback} onChange={setFeedback} />,
        },
      ]}
    />
  );
}

function AssistantMessageBody({
  message,
  transport,
  onApproval,
  onHostAction,
}: {
  message: ChatMessage;
  transport: ChatAgentPort<AgUiEvent>;
  onApproval: (approval: ApprovalRequest, decision: "approved" | "rejected") => void;
  onHostAction?: (action: HostNavigationAction) => void;
}) {
  const answerText = message.content.trim();
  const isStreaming = message.status === "loading";
  const showStructuredResults = !isStreaming;

  return (
    <Space orientation="vertical" size={12} className="assistant-message-content">
      {isStreaming ? (
        <Think
          className="assistant-think"
          title="思考中"
          loading={answerText.length === 0}
          blink={answerText.length > 0}
          defaultExpanded
        >
          {answerText.length === 0
            ? "正在理解你的问题并编排可信业务能力…"
            : "正在整理结论，请稍候…"}
        </Think>
      ) : null}
      <ExecutionTimeline steps={message.executionSteps} status={message.status} />
      {answerText.length > 0 ? (
        <SafeContent streaming={isStreaming} content={message.content} />
      ) : null}
      {showStructuredResults
        ? message.views.map((view) => (
            <AssistantViewRenderer
              key={view.viewId}
              value={view}
              {...(onHostAction === undefined ? {} : { onHostAction })}
            />
          ))
        : null}
      {message.approvals.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval} onDecision={onApproval} />
      ))}
      {showStructuredResults ? (
        <EvidencePanel referenceIds={message.evidenceIds} transport={transport} />
      ) : null}
    </Space>
  );
}

export function MessageList({
  messages,
  transport,
  objectName,
  prompts,
  onPrompt,
  onApproval,
  onHostAction,
}: {
  messages: ChatMessage[];
  transport: ChatAgentPort<AgUiEvent>;
  objectName?: string;
  prompts?: readonly string[];
  onPrompt?: (value: string) => void;
  onApproval: (approval: ApprovalRequest, decision: "approved" | "rejected") => void;
  onHostAction?: (action: HostNavigationAction) => void;
}) {
  if (messages.length === 0 && prompts !== undefined && onPrompt !== undefined)
    return (
      <div className="assistant-panel-welcome">
        <h2>有什么我能帮你的吗？</h2>
        {objectName ? <p className="assistant-panel-object">当前对象 · {objectName}</p> : null}
        <div className="assistant-suggest">
          <span>为你推荐</span>
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  if (messages.length === 0)
    return (
      <div className="assistant-welcome">
        <Empty
          className="assistant-empty"
          description={<span>选择业务对象后，询问数据质量、趋势或异常。</span>}
        />
        {objectName ? (
          <div className="assistant-context-chip assistant-context-chip--welcome">
            <span>当前对象</span>
            <strong>{objectName}</strong>
          </div>
        ) : null}
      </div>
    );
  return (
    <Bubble.List
      className="assistant-message-list"
      autoScroll
      role={bubbleRoles}
      items={messages.map((message) => {
        const isAssistant = message.role === "assistant";
        const showActions =
          isAssistant && message.status !== "loading" && message.content.trim().length > 0;
        return {
          key: message.id,
          role: isAssistant ? "ai" : "user",
          status: message.status,
          streaming: message.status === "loading",
          ...(showActions ? { footer: <AssistantMessageActions content={message.content} /> } : {}),
          content: isAssistant ? (
            <AssistantMessageBody
              message={message}
              transport={transport}
              onApproval={onApproval}
              {...(onHostAction === undefined ? {} : { onHostAction })}
            />
          ) : (
            message.content
          ),
        };
      })}
    />
  );
}
