import { assistantViewSchema } from "@assistant/contracts";
import { Alert, Card, Statistic, Table, Tag } from "antd";

import { SafeContent } from "./SafeContent.js";

function displayScalar(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "—";
}

export function AssistantViewRenderer({ value }: { value: unknown }) {
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

  const rows = view.data.rows;
  const values = rows.map((row) => row.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const points = rows
    .map((row, index) => {
      const x = rows.length < 2 ? 50 : (index / (rows.length - 1)) * 100;
      const y = 92 - ((row.value - min) / Math.max(max - min, 1)) * 80;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <figure className="assistant-line-chart">
      <figcaption>{view.title}</figcaption>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${view.title}，共 ${rows.length} 个数据点`}
      >
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
      <details>
        <summary>查看图表数据</summary>
        <ol>
          {rows.map((row) => (
            <li key={row.time}>
              {row.time}：{row.value}
            </li>
          ))}
        </ol>
      </details>
    </figure>
  );
}
