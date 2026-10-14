import type { AssistantApiTransport } from "@assistant/assistant-transport";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Bubble } from "@ant-design/x";
import { Avatar, Empty, Space } from "antd";

import { AssistantViewRenderer } from "./AssistantViewRenderer.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { SafeContent } from "./SafeContent.js";
import type { ChatMessage } from "./types.js";

export function MessageList({
  messages,
  transport,
}: {
  messages: ChatMessage[];
  transport: AssistantApiTransport;
}) {
  if (messages.length === 0)
    return (
      <Empty
        className="assistant-empty"
        description={<span>选择业务对象后，询问数据质量、趋势或异常。</span>}
      />
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
            <SafeContent
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
