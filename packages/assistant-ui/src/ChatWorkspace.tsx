import type { AssistantApiTransport, MessageDto, SessionDto } from "@assistant/assistant-transport";
import type { RawHostContext } from "@assistant/context";
import {
  FolderOutlined,
  MoreOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Alert, Button, Divider, Spin } from "antd";
import { useCallback, useEffect, useReducer, useState, type ReactNode } from "react";

import { ChatComposer } from "./ChatComposer.js";
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
  executionSteps: [],
  evidenceIds: [...message.evidenceRefs],
  views: [],
});

export function ChatWorkspace({
  transport,
  selectedObject,
  getContext,
  mode = "standalone",
  headingTitle,
  workspaceClassName,
  sidebarFooter,
}: {
  transport: AssistantApiTransport;
  selectedObject?: SelectedBusinessObject;
  getContext?: () => RawHostContext | Promise<RawHostContext>;
  mode?: "assistant" | "standalone";
  headingTitle?: string;
  workspaceClassName?: string;
  sidebarFooter?: ReactNode;
}) {
  const resolvedHeading =
    headingTitle ?? (mode === "standalone" ? "数据证据工作台" : "业务智能助手");
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
          executionSteps: [],
          evidenceIds: [],
          views: [],
        },
        assistant: {
          id: `assistant:${localId}`,
          role: "assistant",
          content: "",
          status: "loading",
          executionSteps: [],
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

  const useSessionHeader = workspaceClassName?.includes("codex-workspace") ?? false;
  const activeSessionTitle =
    sessions.find((session) => session.id === activeSessionId)?.title ?? "新会话";

  return (
    <div
      className={
        workspaceClassName ? `assistant-workspace ${workspaceClassName}` : "assistant-workspace"
      }
    >
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
        <div className="assistant-conversations-body">
          <Conversations
            {...(activeSessionId === undefined ? {} : { activeKey: activeSessionId })}
            items={sessions.map((session) => ({ key: session.id, label: session.title }))}
            onActiveChange={setActiveSessionId}
          />
        </div>
        {sidebarFooter !== undefined ? (
          <div className="assistant-sidebar-footer">{sidebarFooter}</div>
        ) : null}
      </aside>
      <section className="assistant-chat" aria-label="智能助手对话">
        <header
          className={
            useSessionHeader
              ? "assistant-chat-header assistant-chat-header--session"
              : "assistant-chat-header"
          }
        >
          {useSessionHeader ? (
            <>
              <h1 className="assistant-sr-only">{resolvedHeading}</h1>
              <div className="assistant-session-title">
                <FolderOutlined aria-hidden />
                <span className="assistant-session-title-text" title={activeSessionTitle}>
                  {activeSessionTitle}
                </span>
              </div>
              <div className="assistant-session-actions">
                <Button type="text" icon={<MoreOutlined />} aria-label="更多操作" />
                <Button type="text" icon={<UnorderedListOutlined />} aria-label="会话概要" />
                <Divider orientation="vertical" />
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  aria-label="新建会话"
                  onClick={() => void createSession()}
                />
              </div>
            </>
          ) : (
            <div className="assistant-heading">
              <span className="assistant-heading-mark" aria-hidden="true">
                AI
              </span>
              <div>
                <span className="assistant-eyebrow">DEEPSEEK · TRUSTED BUSINESS AI</span>
                <h1>{resolvedHeading}</h1>
                <small>基于当前页面上下文提供可信回答</small>
              </div>
            </div>
          )}
        </header>
        {error && (
          <Alert closable onClose={() => setError(undefined)} type="error" showIcon title={error} />
        )}
        <div className="assistant-live-region" aria-live="polite">
          {state.activeRunId ? "助手正在执行" : "助手已就绪"}
        </div>
        <div className="assistant-chat-scroll">
          {loading ? (
            <Spin />
          ) : (
            <MessageList
              messages={state.messages}
              transport={transport}
              {...(selectedObject?.name ? { objectName: selectedObject.name } : {})}
            />
          )}
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
