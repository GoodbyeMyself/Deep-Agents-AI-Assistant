import type { SessionDto } from "@assistant/assistant-transport";
import { AssistantApiError } from "@assistant/assistant-transport";
import { Alert, Input, Modal, Typography } from "antd";
import { useState } from "react";

export interface SessionAction {
  readonly type: "rename" | "delete";
  readonly session: SessionDto;
}

/** Explicit user confirmation is required before the existing soft-delete API is called. */
export function SessionActionDialog({ action, onRename, onDelete, onClose }: {
  action: SessionAction;
  onRename: (sessionId: string, title: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(action.session.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const renaming = action.type === "rename";
  const confirm = async () => {
    if (saving) return;
    const trimmed = title.trim();
    if (renaming && (trimmed.length === 0 || trimmed.length > 200)) {
      setError("请输入 1–200 个字符的会话名称。");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      if (renaming) await onRename(action.session.id, trimmed);
      else await onDelete(action.session.id);
      onClose();
    } catch (failure) {
      setError(failure instanceof AssistantApiError && failure.code === "RUN_CONFLICT"
        ? "会话仍在执行，请先停止当前任务后再删除。"
        : `无法${renaming ? "重命名" : "删除"}会话，请稍后重试。`);
    } finally { setSaving(false); }
  };
  return (
    <Modal
      open
      title={renaming ? "重命名会话" : "删除会话？"}
      okText={renaming ? "保存" : "确认删除"}
      cancelText="取消"
      confirmLoading={saving}
      closable={!saving}
      mask={{ closable: !saving }}
      keyboard={!saving}
      okButtonProps={{ danger: !renaming }}
      cancelButtonProps={{ disabled: saving, autoFocus: !renaming }}
      onOk={() => void confirm()}
      onCancel={() => { if (!saving) onClose(); }}
    >
      {renaming ? (
        <label className="assistant-session-name-field">
          <span>会话名称</span>
          <Input autoFocus value={title} maxLength={200} showCount disabled={saving}
            {...(error === undefined ? {} : { status: "error" as const })}
            aria-invalid={error !== undefined}
            aria-describedby={error === undefined ? undefined : "assistant-session-action-error"}
            onChange={(event) => { setTitle(event.target.value); setError(undefined); }}
            onPressEnter={(event) => { if (!event.nativeEvent.isComposing) void confirm(); }} />
        </label>
      ) : (
        <Typography.Paragraph>
          确定删除会话“<strong>{action.session.title}</strong>”吗？删除后将从会话列表移除，无法在当前界面恢复。
        </Typography.Paragraph>
      )}
      {error !== undefined && <Alert id="assistant-session-action-error" role="alert" type="error" showIcon title={error} />}
    </Modal>
  );
}
