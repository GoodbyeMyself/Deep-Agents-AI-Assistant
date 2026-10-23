import { assistantViewSchema, type HostNavigationAction } from "@assistant/contracts";
import { ArrowRightOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Statistic, Table, Tag } from "antd";

import { LineChartView } from "./LineChartView.js";
import { SafeContent } from "./SafeContent.js";

function displayScalar(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "—";
}

export function AssistantViewRenderer({
  value,
  onHostAction,
}: {
  value: unknown;
  onHostAction?: (action: HostNavigationAction) => void;
}) {
  const parsed = assistantViewSchema.safeParse(value);
  if (!parsed.success) return <Alert type="warning" showIcon title="此结构化结果无法安全显示" />;
  const view = parsed.data;
  if (view.viewType === "text") return <SafeContent content={view.data.content} />;
  if (view.viewType === "metric")
    return (
      <Card size="small" className="assistant-view-card">
        <Statistic
          title={view.data.label}
          value={view.data.value === null ? "—" : String(view.data.value)}
          suffix={view.data.unit}
        />
        {view.data.trend && (
          <Tag color={view.data.trend === "down" ? "red" : "cyan"}>{view.data.trend}</Tag>
        )}
      </Card>
    );
  if (view.viewType === "table")
    return (
      <Table
        size="small"
        pagination={false}
        rowKey={(_, index) => String(index)}
        dataSource={view.data.rows}
        columns={view.data.columns.map((column) => ({
          key: column.key,
          dataIndex: column.key,
          title: column.label,
          render: displayScalar,
        }))}
        scroll={{ x: true }}
      />
    );
  if (view.viewType === "references")
    return (
      <ul className="assistant-reference-list">
        {view.data.items.map((item) => (
          <li key={item.referenceId}>{item.title ?? item.referenceId}</li>
        ))}
      </ul>
    );
  if (view.viewType === "action.navigate")
    return (
      <Card size="small" className="assistant-view-card assistant-navigation-action">
        <div className="assistant-navigation-copy">
          <strong>{view.title ?? "在业务系统中继续"}</strong>
          <small>跳转由当前业务系统确认并执行</small>
        </div>
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          iconPosition="end"
          disabled={onHostAction === undefined}
          onClick={() => onHostAction?.(view.data)}
        >
          {view.data.label}
        </Button>
      </Card>
    );

  return <LineChartView title={view.title} rows={view.data.rows} />;
}
