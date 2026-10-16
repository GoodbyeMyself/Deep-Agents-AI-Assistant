import type { AssistantApiTransport } from "@assistant/assistant-transport";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Bubble } from "@ant-design/x";
import { Avatar, Empty, Space } from "antd";

import { AssistantViewRenderer } from "./AssistantViewRenderer.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { ExecutionTimeline } from "./ExecutionTimeline.js";
import { SafeContent } from "./SafeContent.js";
import type { ChatMessage } from "./types.js";

export function MessageList({
  messages,
  transport,
  objectName,
}: {
  messages: ChatMessage[];
  transport: AssistantApiTransport;
  objectName?: string;
}) {
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
      role={{
        user: { placement: "end", variant: "filled", avatar: <Avatar icon={<UserOutlined />} /> },
        ai: {
          placement: "start",
          variant: "borderless",
          avatar: <Avatar icon={<RobotOutlined />} />,
        },
      }}
      items={messages.map((message) => ({
        key: message.id,
        role: message.role === "assistant" ? "ai" : "user",
        status: message.status,
        streaming: message.status === "loading",
        content: (
          <Space orientation="vertical" size={12} className="assistant-message-content">
            {message.role === "assistant" ? (
              <ExecutionTimeline steps={message.executionSteps} status={message.status} />
            ) : null}
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
        ),
      }))}
    />
  );
}
