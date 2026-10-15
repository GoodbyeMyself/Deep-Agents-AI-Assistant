import type { AssistantApiTransport, MessageDto, SessionDto } from "@assistant/assistant-transport";
import type { RawHostContext } from "@assistant/context";
import { PlusOutlined } from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Alert, Button, Spin } from "antd";
import { useCallback, useEffect, useReducer, useState } from "react";

import { ChatComposer } from "./ChatComposer.js";
import { ExecutionTimeline } from "./ExecutionTimeline.js";
import { MessageList } from "./MessageList.js";
import { chatReducer, initialChatState } from "./store.js";
import type { ChatMessage } from "./types.js";

export interface SelectedBusinessObject {
  id: string;
  type: string;
  name: string;
}

const toMessage = (message: MessageDto): ChatMessage => ({
  id: message.id,
  role: message.role,
  content: message.content,
  status: "success",
  evidenceIds: [...message.evidenceRefs],
  views: [],
});

export function ChatWorkspace({
  transport,
  selectedObject,
  getContext,
  mode = "standalone",
}: {
  transport: AssistantApiTransport;
  selectedObject?: SelectedBusinessObject;
  getContext?: () => RawHostContext | Promise<RawHostContext>;
  mode?: "assistant" | "standalone";
}) {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  const refreshSessions = useCallback(async () => {
    const result = await transport.listSessions();
    setSessions(result.items.filter((item) => item.status === "active"));
    return result.items;
  }, [transport]);

  const createSession = useCallback(async () => {
    const session = await transport.createSession({ title: "数据质量分析", mode });
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    dispatch({ type: "reset", messages: [] });
    return session.id;
  }, [mode, transport]);

  useEffect(() => {
    let disposed = false;
    void refreshSessions()
      .then(async (items) => {
        if (disposed) return;
        const active = items.find((item) => item.status === "active");
        const id = active?.id ?? (await createSession());
        if (!disposed) setActiveSessionId(id);
      })
      .catch(() => setError("无法加载会话，请检查 Agent Server。"))
      .finally(() => setLoading(false));
    return () => {
      disposed = true;
    };
  }, [createSession, refreshSessions]);

  useEffect(() => {
    if (activeSessionId === undefined) return;
    let disposed = false;
    setLoading(true);
    void transport
      .listMessages(activeSessionId)
      .then(({ items }) => !disposed && dispatch({ type: "reset", messages: items.map(toMessage) }))
      .catch(() => !disposed && setError("无法读取此会话。"))
      .finally(() => !disposed && setLoading(false));
    return () => {
      disposed = true;
    };
  }, [activeSessionId, transport]);

  const submit = async (message: string) => {
    if (selectedObject === undefined) return;
    setError(undefined);
    try {
      const sessionId = activeSessionId ?? (await createSession());
      const localId = crypto.randomUUID();
      dispatch({
        type: "submit",
        user: {
          id: `user:${localId}`,
          role: "user",
          content: message,
          status: "success",
          evidenceIds: [],
          views: [],
        },
        assistant: {
          id: `assistant:${localId}`,
          role: "assistant",
          content: "",
          status: "loading",
          evidenceIds: [],
          views: [],
        },
      });
      const capturedContext =
        getContext === undefined
          ? {
              page: { type: "standalone-assistant", route: "/assistant", title: "企业数据助手" },
              object: {
                type: selectedObject.type,
                rawId: selectedObject.id,
                name: selectedObject.name,
              },
              business: { domain: "data-governance", module: "quality" },
            }
          : await getContext();
      const snapshot = await transport.createContextSnapshot(capturedContext, mode);
      const run = await transport.createRun(sessionId, {
        message,
        contextSnapshotId: snapshot.id,
        clientRequestId: localId,
      });
      const runId = run.runId ?? run.id;
      if (runId === undefined) throw new Error("Missing run ID");
      dispatch({ type: "run-bound", runId });
      for await (const event of transport.watchRun(runId)) dispatch({ type: "event", event });
      const final = await transport.getRun(runId);
      if (final.status === "failed")
        dispatch({ type: "failed", message: "Agent 执行失败，请重试。" });
      if (final.status === "cancelled") dispatch({ type: "cancelled" });
    } catch {
      dispatch({ type: "failed", message: "连接中断，已保留当前结果；请稍后重试。" });
    }
  };

  const cancel = () => {
    if (state.activeRunId !== undefined) void transport.cancelRun(state.activeRunId);
  };

  return (
    <div className="assistant-workspace">
      <aside className="assistant-conversations" aria-label="会话列表">
        <div className="assistant-sidebar-heading">
          <span>分析会话</span>
          <Button
            type="text"
            icon={<PlusOutlined />}
            aria-label="新建会话"
            onClick={() => void createSession()}
          />
        </div>
        <Conversations
          {...(activeSessionId === undefined ? {} : { activeKey: activeSessionId })}
          items={sessions.map((session) => ({ key: session.id, label: session.title }))}
          onActiveChange={setActiveSessionId}
        />
      </aside>
      <section className="assistant-chat" aria-label="智能助手对话">
        <header className="assistant-chat-header">
          <div>
            <span className="assistant-eyebrow">TRUSTED BUSINESS AI</span>
            <h1>数据证据工作台</h1>
          </div>
          <div className="assistant-context-chip">
            <span>当前对象</span>
            <strong>{selectedObject?.name ?? "未选择"}</strong>
          </div>
        </header>
        {error && (
          <Alert closable onClose={() => setError(undefined)} type="error" showIcon title={error} />
        )}
        <div className="assistant-live-region" aria-live="polite">
          {state.activeRunId ? "助手正在执行" : "助手已就绪"}
        </div>
        <div className="assistant-chat-scroll">
          {loading ? <Spin /> : <MessageList messages={state.messages} transport={transport} />}
          <ExecutionTimeline steps={state.steps} />
        </div>
        <ChatComposer
          loading={state.activeRunId !== undefined}
          disabled={selectedObject === undefined}
          objectName={selectedObject?.name ?? "业务对象"}
          onSubmit={(value) => void submit(value)}
          onCancel={cancel}
        />
      </section>
    </div>
  );
}
