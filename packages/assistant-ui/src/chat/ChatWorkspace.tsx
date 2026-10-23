import type {
  ChatAgentPort,
  MessageListDto,
  MessageDto,
  SessionDto,
} from "@assistant/assistant-transport";
import type { AgUiEvent, HostNavigationAction } from "@assistant/contracts";
import type { RawHostContext } from "@assistant/context";
import {
  FolderOutlined,
  MoreOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Alert, Button, Divider, Popover, Spin } from "antd";
import { useCallback, useEffect, useReducer, useState, type ReactNode } from "react";

import { ChatComposer } from "./ChatComposer.js";
import { MessageList } from "./MessageList.js";
import { chatReducer, initialChatState } from "./store.js";
import type { ApprovalRequest, ChatMessage } from "./types.js";

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
  approvals: [],
});

function toMessages(result: MessageListDto): ChatMessage[] {
  const messages = result.items.map(toMessage);
  const pending = result.pendingInterrupts ?? [];
  if (pending.length === 0) return messages;
  const approvals: ApprovalRequest[] = pending.map((interrupt) => ({
    id: interrupt.id,
    runId: interrupt.runId,
    reason: interrupt.reason,
    ...(interrupt.message === undefined ? {} : { message: interrupt.message }),
    ...(interrupt.expiresAt === undefined ? {} : { expiresAt: interrupt.expiresAt }),
    status: "pending",
  }));
  const lastAssistantIndex = messages.findLastIndex((message) => message.role === "assistant");
  if (lastAssistantIndex >= 0)
    return messages.map((message, index) =>
      index === lastAssistantIndex ? { ...message, approvals } : message,
    );
  return [
    ...messages,
    {
      id: `approval:${approvals[0]!.id}`,
      role: "assistant",
      content: "",
      status: "success",
      executionSteps: [{ key: "run", title: "等待你的确认", status: "pending" }],
      evidenceIds: [],
      views: [],
      approvals,
    },
  ];
}

export function ChatWorkspace({
  transport,
  selectedObject,
  getContext,
  mode = "standalone",
  headingTitle,
  workspaceClassName,
  sidebarFooter,
  layout = "default",
  onHostAction,
}: {
  transport: ChatAgentPort<AgUiEvent>;
  selectedObject?: SelectedBusinessObject;
  getContext?: () => RawHostContext | Promise<RawHostContext>;
  mode?: "assistant" | "standalone";
  headingTitle?: string;
  workspaceClassName?: string;
  sidebarFooter?: ReactNode;
  layout?: "default" | "panel";
  onHostAction?: (action: HostNavigationAction) => void;
}) {
  const resolvedHeading =
    headingTitle ?? (mode === "standalone" ? "数据证据工作台" : "业务智能助手");
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [sessionListOpen, setSessionListOpen] = useState(false);
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
      .then((result) => !disposed && dispatch({ type: "reset", messages: toMessages(result) }))
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
          approvals: [],
        },
        assistant: {
          id: `assistant:${localId}`,
          role: "assistant",
          content: "",
          status: "loading",
          executionSteps: [],
          evidenceIds: [],
          views: [],
          approvals: [],
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

  const resolveApproval = async (approval: ApprovalRequest, decision: "approved" | "rejected") => {
    setError(undefined);
    dispatch({ type: "approval-status", interruptId: approval.id, status: "submitting" });
    try {
      const localId = crypto.randomUUID();
      const response =
        decision === "approved"
          ? {
              interruptId: approval.id,
              status: "resolved" as const,
              payload: { approved: true as const },
              clientRequestId: localId,
            }
          : {
              interruptId: approval.id,
              status: "cancelled" as const,
              payload: { approved: false as const },
              clientRequestId: localId,
            };
      const run = await transport.resumeRun(approval.runId, response);
      const runId = run.runId ?? run.id;
      if (runId === undefined) throw new Error("Missing resumed run ID");
      dispatch({
        type: "resume-bound",
        interruptId: approval.id,
        decision,
        runId,
        assistant: {
          id: `assistant:${localId}`,
          role: "assistant",
          content: "",
          status: "loading",
          executionSteps: [],
          evidenceIds: [],
          views: [],
          approvals: [],
        },
      });
      for await (const event of transport.watchRun(runId)) dispatch({ type: "event", event });
      const final = await transport.getRun(runId);
      if (final.status === "failed")
        dispatch({ type: "failed", message: "Agent 恢复执行失败，请重试。" });
      if (final.status === "cancelled") dispatch({ type: "cancelled" });
    } catch {
      dispatch({ type: "approval-status", interruptId: approval.id, status: "pending" });
      setError("无法提交确认结果；操作尚未继续，请重试。");
    }
  };

  const useSessionHeader = workspaceClassName?.includes("codex-workspace") ?? false;
  const panelLayout = layout === "panel";
  const prompts = [
    selectedObject === undefined
      ? "看看当前对象最近的质量趋势"
      : `看看${selectedObject.name}最近的质量趋势`,
    "有哪些异常需要优先处理？",
    "根据已授权数据说明当前质量情况",
  ];
  const activeSessionTitle =
    sessions.find((session) => session.id === activeSessionId)?.title ?? "新会话";
  const hasPendingApproval = state.messages.some((message) =>
    message.approvals.some(
      (approval) => approval.status === "pending" || approval.status === "submitting",
    ),
  );

  return (
    <div
      className={[
        "assistant-workspace",
        panelLayout ? "assistant-workspace--panel" : "",
        workspaceClassName ?? "",
      ]
        .filter((name) => name.length > 0)
        .join(" ")}
    >
      {panelLayout ? null : (
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
      )}
      <section className="assistant-chat" aria-label="智能助手对话">
        <header
          className={
            panelLayout
              ? "assistant-chat-header assistant-chat-header--panel"
              : useSessionHeader
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
          ) : panelLayout ? (
            <>
              <h1 className="assistant-sr-only">{resolvedHeading}</h1>
              <span className="assistant-heading-mark" aria-hidden="true">
                AI
              </span>
              <div className="assistant-header-actions">
                <Button
                  type="text"
                  className="assistant-header-icon"
                  icon={<PlusOutlined />}
                  aria-label="新建会话"
                  onClick={() => void createSession()}
                />
                <Popover
                  trigger="click"
                  placement="bottomRight"
                  open={sessionListOpen}
                  onOpenChange={setSessionListOpen}
                  classNames={{ root: "assistant-session-popover" }}
                  content={
                    <div className="assistant-session-menu">
                      {sessions.length === 0 ? (
                        <p className="assistant-session-menu-empty">还没有会话</p>
                      ) : (
                        <Conversations
                          {...(activeSessionId === undefined ? {} : { activeKey: activeSessionId })}
                          items={sessions.map((session) => ({
                            key: session.id,
                            label: session.title,
                          }))}
                          onActiveChange={(key) => {
                            setActiveSessionId(key);
                            setSessionListOpen(false);
                          }}
                        />
                      )}
                    </div>
                  }
                >
                  <Button
                    type="text"
                    className="assistant-header-icon"
                    icon={<UnorderedListOutlined />}
                    aria-label="会话列表"
                    aria-expanded={sessionListOpen}
                  />
                </Popover>
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
              {...(panelLayout ? { prompts, onPrompt: (value) => void submit(value) } : {})}
              onApproval={(approval, decision) => void resolveApproval(approval, decision)}
              {...(onHostAction === undefined ? {} : { onHostAction })}
            />
          )}
        </div>
        <ChatComposer
          loading={state.activeRunId !== undefined}
          disabled={selectedObject === undefined || hasPendingApproval}
          objectName={selectedObject?.name ?? "业务对象"}
          {...(panelLayout ? { placeholder: "发消息..." } : {})}
          onSubmit={(value) => void submit(value)}
          onCancel={cancel}
        />
      </section>
    </div>
  );
}
