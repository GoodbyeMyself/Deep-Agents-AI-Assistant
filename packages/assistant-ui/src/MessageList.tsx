import type { AssistantApiTransport } from "@assistant/assistant-transport";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Bubble } from "@ant-design/x";
import { Avatar, Empty, Space } from "antd";

import { AssistantViewRenderer } from "./AssistantViewRenderer.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { ExecutionTimeline } from "./ExecutionTimeline.js";
import { SafeContent } from "./SafeContent.js";
import type { ChatMessage } from "./types.js";

const bubbleRoles = {
  user: {
    placement: "end" as const,
    variant: "filled" as const,
    shape: "corner" as const,
    avatar: <Avatar style={{ backgroundColor: "#91caff", color: "#0958d9" }} icon={<UserOutlined />} />,
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

function AssistantMessageBody({
  message,
  transport,
}: {
  message: ChatMessage;
  transport: AssistantApiTransport;
}) {
  return (
    <Space orientation="vertical" size={12} className="assistant-message-content">
      <ExecutionTimeline steps={message.executionSteps} status={message.status} />
      <SafeContent
        streaming={message.status === "loading"}
        content={
          message.content || (message.status === "loading" ? "正在连接可信业务能力…" : "")
        }
      />
      {message.views.map((view) => (
        <AssistantViewRenderer key={view.viewId} value={view} />
      ))}
      <EvidencePanel referenceIds={message.evidenceIds} transport={transport} />
    </Space>
  );
}

export function MessageList({
  messages,
  transport,
  objectName,
  prompts,
  onPrompt,
}: {
  messages: ChatMessage[];
  transport: AssistantApiTransport;
  objectName?: string;
  prompts?: readonly string[];
  onPrompt?: (value: string) => void;
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
        const waitingForContent = isAssistant && message.status === "loading" && !message.content;
        return {
          key: message.id,
          role: isAssistant ? "ai" : "user",
          status: message.status,
          streaming: message.status === "loading",
          loading: waitingForContent,
          content: isAssistant ? (
            <AssistantMessageBody message={message} transport={transport} />
          ) : (
            message.content
          ),
        };
      })}
    />
  );
}
