import { AssistantApiError, AssistantApiTransport } from "@assistant/assistant-transport";
import { ChatWorkspace, type SelectedBusinessObject } from "@assistant/assistant-ui";
import { DatabaseOutlined, MessageOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty, Select, Space, Table, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";

type Profile = "user-a" | "user-b" | "admin";
type Page = "assistant" | "sessions" | "runtime";

function displayValue(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : fallback;
}

const profileConfig: Record<
  Profile,
  { token: string; label: string; object: SelectedBusinessObject }
> = {
  "user-a": {
    token: "mock-token-user-a",
    label: "业务用户 A",
    object: { id: "orders", type: "dataset", name: "订单数据集" },
  },
  "user-b": {
    token: "mock-token-user-b",
    label: "业务用户 B",
    object: { id: "customers", type: "dataset", name: "客户数据集" },
  },
  admin: {
    token: "mock-token-admin",
    label: "平台管理员",
    object: { id: "orders", type: "dataset", name: "订单数据集" },
  },
};

function RuntimeStatus({
  transport,
  isAdmin,
}: {
  transport: AssistantApiTransport;
  isAdmin: boolean;
}) {
  const [models, setModels] = useState<Record<string, unknown>[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, unknown>[]>([]);
  const [plugins, setPlugins] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let disposed = false;
    void Promise.all([
      transport.listModels(),
      transport.listCapabilities(),
      isAdmin ? transport.listPlugins() : Promise.resolve({ items: [] }),
    ])
      .then(([modelResult, capabilityResult, pluginResult]) => {
        if (disposed) return;
        setModels(modelResult.items);
        setCapabilities(capabilityResult.items);
        setPlugins(pluginResult.items);
      })
      .catch((cause: unknown) => {
        if (!disposed)
          setError(
            cause instanceof AssistantApiError
              ? `${cause.message}（${cause.code}）`
              : "状态读取失败",
          );
      });
    return () => {
      disposed = true;
    };
  }, [transport, isAdmin]);
  return (
    <main className="web-page" id="main-content">
      <div className="web-page-heading">
        <span>DEPLOYMENT HEALTH</span>
        <h1>运行状态</h1>
        <p>仅显示安全的部署元数据；插件明细需要平台管理员权限。</p>
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      <div className="status-grid">
        <Card title="模型配置">
          <Descriptions column={1}>
            {models.map((item, index) => (
              <Descriptions.Item key={index} label={displayValue(item["provider"], "provider")}>
                {displayValue(item["model"], displayValue(item["id"]))}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
        <Card title="标准能力">
          <Table
            rowKey={(row) => displayValue(row["id"], "unknown-capability")}
            pagination={false}
            dataSource={capabilities}
            columns={[
              { title: "能力", dataIndex: "id" },
              { title: "版本", dataIndex: "version" },
            ]}
          />
        </Card>
        <Card title="插件状态">
          {isAdmin ? (
            <Table
              rowKey={(row) => displayValue(row["pluginId"], "unknown-plugin")}
              pagination={false}
              dataSource={plugins}
              columns={[
                { title: "插件", dataIndex: "pluginId" },
                {
                  title: "状态",
                  dataIndex: "status",
                  render: (value) => (
                    <Tag color={value === "active" ? "cyan" : "gold"}>{String(value)}</Tag>
                  ),
                },
              ]}
            />
          ) : (
            <Empty description="管理员可查看插件运行明细" />
          )}
        </Card>
      </div>
    </main>
  );
}

function SessionsPage({ transport }: { transport: AssistantApiTransport }) {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; status: string; createdAt: string }>
  >([]);
  const load = () => void transport.listSessions().then((result) => setSessions(result.items));
  useEffect(load, [transport]);
  return (
    <main className="web-page" id="main-content">
      <div className="web-page-heading">
        <span>YOUR THREADS</span>
        <h1>会话管理</h1>
        <p>会话始终按当前身份和租户隔离。</p>
      </div>
      <Table
        rowKey="id"
        dataSource={sessions}
        columns={[
          { title: "名称", dataIndex: "title" },
          { title: "状态", dataIndex: "status" },
          {
            title: "创建时间",
            dataIndex: "createdAt",
            render: (value) => new Date(String(value)).toLocaleString(),
          },
          {
            title: "操作",
            render: (_, row) => (
              <Space>
                <Button
                  onClick={() =>
                    void transport
                      .updateSession(row.id, { archived: row.status !== "archived" })
                      .then(load)
                  }
                >
                  {row.status === "archived" ? "恢复" : "归档"}
                </Button>
                <Button danger onClick={() => void transport.deleteSession(row.id).then(load)}>
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </main>
  );
}

export function App() {
  const [profile, setProfile] = useState<Profile>("user-a");
  const [page, setPage] = useState<Page>("assistant");
  const current = profileConfig[profile];
  const transport = useMemo(
    () => new AssistantApiTransport({ getAccessCredential: () => current.token }),
    [current.token],
  );
  return (
    <div className="web-shell">
      <header className="web-topbar">
        <button className="web-brand" onClick={() => setPage("assistant")}>
          <span>EA</span>
          <strong>Enterprise Assistant</strong>
        </button>
        <nav aria-label="主导航">
          <Button
            type={page === "assistant" ? "primary" : "text"}
            icon={<MessageOutlined />}
            onClick={() => setPage("assistant")}
          >
            助手
          </Button>
          <Button
            type={page === "sessions" ? "primary" : "text"}
            icon={<DatabaseOutlined />}
            onClick={() => setPage("sessions")}
          >
            会话
          </Button>
          <Button
            type={page === "runtime" ? "primary" : "text"}
            icon={<SafetyCertificateOutlined />}
            onClick={() => setPage("runtime")}
          >
            运行状态
          </Button>
        </nav>
        <label className="identity-control">
          <span>本地模拟身份</span>
          <Select
            aria-label="本地模拟身份"
            value={profile}
            onChange={setProfile}
            options={Object.entries(profileConfig).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />
        </label>
      </header>
      {page === "assistant" && (
        <main id="main-content" className="web-assistant-page">
          <ChatWorkspace key={profile} transport={transport} selectedObject={current.object} />
        </main>
      )}
      {page === "sessions" && <SessionsPage transport={transport} />}
      {page === "runtime" && <RuntimeStatus transport={transport} isAdmin={profile === "admin"} />}
    </div>
  );
}
