import { AssistantApiError, type AssistantApiTransport } from "@assistant/assistant-transport";
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { Alert, Button, Empty, Space, Spin, Table, Tag } from "antd";
import { useEffect, useState, type ReactNode } from "react";

type Resource = "models" | "servers" | "tools" | "extensions";
type Row = Record<string, unknown>;

function value(input: unknown): string {
  return typeof input === "string" || typeof input === "number" || typeof input === "boolean"
    ? String(input) : "—";
}

/** Each panel owns its request; identity changes immediately hide stale privileged data. */
function ResourcePanel({ title, resource, transport, allowed = true, children }: {
  title: string;
  resource: Resource;
  transport: AssistantApiTransport;
  allowed?: boolean;
  children: (rows: Row[]) => ReactNode;
}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    owner: AssistantApiTransport;
    revision: number;
    rows: Row[];
    error?: string;
    updatedAt?: string;
  }>();
  const current = state?.owner === transport && state.revision === revision ? state : undefined;
  const loading = allowed && current === undefined;
  useEffect(() => {
    if (!allowed) return;
    let disposed = false;
    const load = async () => {
      try {
        const result = resource === "models" ? await transport.listModels()
          : resource === "servers" ? await transport.listMcpServers()
          : resource === "tools" ? await transport.listMcpTools()
          : await transport.listPlatformExtensions();
        if (!disposed) setState({ owner: transport, revision, rows: result.items,
          updatedAt: new Date().toLocaleString() });
      } catch (error: unknown) {
        if (!disposed) setState({ owner: transport, revision, rows: [],
          error: error instanceof AssistantApiError ? `${error.message}（${error.code}）` : "数据加载失败，请稍后重试。" });
      }
    };
    void load();
    return () => { disposed = true; };
  }, [allowed, resource, revision, transport]);
  return (
    <ProCard title={title} extra={allowed ? (
      <Space wrap>
        {current?.updatedAt && <span className="assistant-web-read-time">最近读取：{current.updatedAt}</span>}
        <Button aria-label={`刷新${title}`} loading={loading} onClick={() => setRevision((n) => n + 1)}>刷新</Button>
      </Space>
    ) : undefined}>
      {!allowed ? <Alert type="info" showIcon title="需要平台管理员权限" description="当前身份不能查看此区域，请使用有权限的管理员身份。" />
        : loading ? <div role="status" aria-label={`正在加载${title}`}><Spin /><span> 正在加载…</span></div>
        : current?.error ? <Alert role="alert" type="error" showIcon title={current.error} />
        : current?.rows.length === 0 ? <Empty description="当前部署未返回相关配置" />
        : children(current?.rows ?? [])}
    </ProCard>
  );
}

function status(input: unknown) {
  const known = input === "ready" || input === "approved";
  return <Tag color={known ? "green" : "gold"}>{value(input)}</Tag>;
}

export function ModelsPage({ transport }: { transport: AssistantApiTransport }) {
  return <PageContainer header={{ title: "模型配置", subTitle: "查看当前部署的模型配置；修改配置仍通过部署环境变量完成。" }}>
    <main id="main-content">
      <ResourcePanel title="当前模型" resource="models" transport={transport}>
        {(rows) => <Table dataSource={rows} rowKey={(row) => `${value(row["provider"])}:${value(row["model"] ?? row["id"])}`}
          pagination={false} scroll={{ x: "max-content" }} columns={[
            { title: "供应商", dataIndex: "provider", render: value },
            { title: "模型", render: (_, row) => value(row["model"] ?? row["id"]) },
          ]} />}
      </ResourcePanel>
    </main>
  </PageContainer>;
}

export function McpPage({ transport, isAdmin }: { transport: AssistantApiTransport; isAdmin: boolean }) {
  return <PageContainer header={{ title: "MCP 管理", subTitle: "展示部署接入状态和批准的工具；接入状态不代表持续探活结果。" }}>
    <main id="main-content" className="assistant-web-runtime-sections">
      <ResourcePanel key={`servers:${isAdmin}`} title="MCP 状态监控" resource="servers" transport={transport} allowed={isAdmin}>
        {(rows) => <Table dataSource={rows} rowKey={(row) => value(row["serverId"])} pagination={false}
          scroll={{ x: "max-content" }} columns={[
            { title: "MCP Server", dataIndex: "serverId", render: value },
            { title: "接入状态", dataIndex: "status", render: status },
            { title: "传输方式", dataIndex: "transport", render: value },
            { title: "批准工具数", dataIndex: "approvedToolCount", render: value },
            { title: "本地演示", dataIndex: "localDemo", render: (input) => input === true ? "是" : input === false ? "否" : "—" },
          ]} />}
      </ResourcePanel>
      <ResourcePanel title="工具列表" resource="tools" transport={transport}>
        {(rows) => <Table dataSource={rows} rowKey={(row) => `${value(row["serverId"])}:${value(row["name"])}`}
          pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: "max-content" }} columns={[
            { title: "工具名称", dataIndex: "name", render: value },
            { title: "MCP Server", dataIndex: "serverId", render: value },
          ]} />}
      </ResourcePanel>
    </main>
  </PageContainer>;
}

export function PlatformExtensionsPage({ transport, isAdmin }: { transport: AssistantApiTransport; isAdmin: boolean }) {
  return <PageContainer header={{ title: "平台扩展", subTitle: "查看当前部署批准的平台扩展，需要平台管理员权限。" }}>
    <main id="main-content">
      <ResourcePanel key={`extensions:${isAdmin}`} title="平台扩展列表" resource="extensions" transport={transport} allowed={isAdmin}>
        {(rows) => <Table dataSource={rows} rowKey={(row) => value(row["id"])} pagination={false}
          scroll={{ x: "max-content" }} columns={[
            { title: "扩展名称", dataIndex: "id", render: value },
            { title: "版本", dataIndex: "version", render: value },
            { title: "批准状态", dataIndex: "status", render: status },
            { title: "工具数量", dataIndex: "toolCount", render: value },
            { title: "Skill 数量", dataIndex: "skillCount", render: value },
          ]} />}
      </ResourcePanel>
    </main>
  </PageContainer>;
}
