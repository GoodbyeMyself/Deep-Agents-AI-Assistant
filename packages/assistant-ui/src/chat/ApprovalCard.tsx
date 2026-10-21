import { SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Space, Tag } from "antd";

import type { ApprovalRequest } from "./types.js";

export function ApprovalCard({
  approval,
  onDecision,
}: {
  approval: ApprovalRequest;
  onDecision: (approval: ApprovalRequest, decision: "approved" | "rejected") => void;
}) {
  const expired =
    approval.expiresAt !== undefined && Date.parse(approval.expiresAt) <= Date.now();
  const actionable = approval.status === "pending";
  const statusLabel = expired
    ? "已过期"
    : approval.status === "approved"
      ? "已确认"
      : approval.status === "rejected"
        ? "已拒绝"
        : approval.status === "submitting"
          ? "正在提交"
          : "等待确认";

  return (
    <section className="assistant-approval" aria-label="业务操作二次确认">
      <div className="assistant-approval-heading">
        <SafetyCertificateOutlined aria-hidden />
        <strong>需要你的确认</strong>
        <Tag color={actionable ? "warning" : "default"}>{statusLabel}</Tag>
      </div>
      <p>{approval.message ?? "Agent 请求在继续执行前确认此业务操作。"}</p>
      <Alert
        type="warning"
        showIcon
        title="确认只对本次受控操作有效；服务端仍会重新校验身份、权限和业务对象。"
      />
      {approval.expiresAt !== undefined ? (
        <small>有效期至：{new Date(approval.expiresAt).toLocaleString()}</small>
      ) : null}
      {actionable ? (
        <Space>
          {!expired ? (
            <Button
              danger
              type="primary"
              onClick={() => onDecision(approval, "approved")}
            >
              确认并继续
            </Button>
          ) : null}
          <Button onClick={() => onDecision(approval, "rejected")}>
            {expired ? "关闭并拒绝" : "拒绝"}
          </Button>
        </Space>
      ) : null}
    </section>
  );
}
