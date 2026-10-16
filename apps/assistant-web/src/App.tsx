import { AssistantApiError, AssistantApiTransport } from "@assistant/assistant-transport";
import { ChatWorkspace, type SelectedBusinessObject } from "@assistant/assistant-ui";
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  MessageOutlined,
  SettingOutlined,
} from "@ant-design/icons";
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

const recentTopics = [
  "订单数据集质量趋势分析",
  "客户数据集完整性复核",
  "治理规则执行摘要",
] as const;

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
    <main className="codex-admin-page" id="main-content">
      <div className="codex-admin-heading">
        <h1>运行状态</h1>
        <p>仅显示安全的部署元数据；插件明细需要平台管理员权限。</p>
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      <div className="status-grid">
        <Card title="模型配置" bordered={false}>
          <Descriptions column={1}>
            {models.map((item, index) => (
              <Descriptions.Item key={index} label={displayValue(item["provider"], "provider")}>
                {displayValue(item["model"], displayValue(item["id"]))}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
        <Card title="标准能力" bordered={false}>
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
        <Card title="插件状态" bordered={false}>
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
    <main className="codex-admin-page" id="main-content">
      <div className="codex-admin-heading">
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

function CodexListPane({
  page,
  profileLabel,
  onNavigate,
  onProfileChange,
  profile,
}: {
  page: Page;
  profile: Profile;
  profileLabel: string;
  onNavigate: (page: Page) => void;
  onProfileChange: (profile: Profile) => void;
}) {
  return (
    <aside className="codex-list-pane" aria-label="工作区导航">
      <div className="codex-list-head">
        <button className="codex-app-title" type="button" onClick={() => onNavigate("assistant")}>
          Enterprise Assistant
        </button>
      </div>
      <Button
        block
        className="codex-new-chat"
        icon={<MessageOutlined />}
        type="default"
        onClick={() => onNavigate("assistant")}
      >
        新聊天
      </Button>
      <div className="codex-list-section">
        <span className="codex-list-label">项目</span>
        <button
          className={page === "assistant" ? "codex-list-item active" : "codex-list-item"}
          type="button"
          onClick={() => onNavigate("assistant")}
        >
          <strong>Deep agents 通用 AI 智能助手</strong>
          <small>{profileLabel} · 订单数据集</small>
        </button>
      </div>
      <div className="codex-list-section">
        <span className="codex-list-label">最近</span>
        {recentTopics.map((topic) => (
          <button
            key={topic}
            className="codex-list-item"
            type="button"
            onClick={() => onNavigate("assistant")}
          >
            {topic}
          </button>
        ))}
      </div>
      <div className="codex-list-section">
        <span className="codex-list-label">管理</span>
        <button
          className={page === "sessions" ? "codex-list-item active" : "codex-list-item"}
          type="button"
          onClick={() => onNavigate("sessions")}
        >
          会话
        </button>
        <button
          className={page === "runtime" ? "codex-list-item active" : "codex-list-item"}
          type="button"
          onClick={() => onNavigate("runtime")}
        >
          运行状态
        </button>
      </div>
      <IdentitySelect profile={profile} onChange={onProfileChange} />
    </aside>
  );
}

function IdentitySelect({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  return (
    <label className="codex-identity">
      <span>本地模拟身份</span>
      <Select
        aria-label="本地模拟身份"
        value={profile}
        onChange={onChange}
        options={Object.entries(profileConfig).map(([value, config]) => ({
          value,
          label: config.label,
        }))}
      />
    </label>
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
    <div className="codex-shell">
      <nav className="codex-rail" aria-label="全局导航">
        <button
          aria-label="助手"
          className={page === "assistant" ? "codex-rail-btn active" : "codex-rail-btn"}
          type="button"
          onClick={() => setPage("assistant")}
        >
          <HomeOutlined />
        </button>
        <button
          aria-label="会话"
          className={page === "sessions" ? "codex-rail-btn active" : "codex-rail-btn"}
          type="button"
          onClick={() => setPage("sessions")}
        >
          <MessageOutlined />
        </button>
        <button
          aria-label="历史"
          className="codex-rail-btn"
          type="button"
          onClick={() => setPage("assistant")}
        >
          <ClockCircleOutlined />
        </button>
        <button
          aria-label="运行状态"
          className={page === "runtime" ? "codex-rail-btn active" : "codex-rail-btn"}
          type="button"
          onClick={() => setPage("runtime")}
        >
          <AppstoreOutlined />
        </button>
        <div className="codex-rail-spacer" />
        <button aria-label="设置" className="codex-rail-btn" type="button">
          <SettingOutlined />
        </button>
      </nav>

      <div className={page === "assistant" ? "codex-stage codex-stage--chat" : "codex-stage"}>
        {page === "assistant" && (
          <ChatWorkspace
            key={profile}
            transport={transport}
            selectedObject={current.object}
            workspaceClassName="codex-workspace"
            sidebarFooter={<IdentitySelect profile={profile} onChange={setProfile} />}
          />
        )}
        {page !== "assistant" && (
          <>
            <CodexListPane
              page={page}
              profile={profile}
              profileLabel={current.label}
              onNavigate={setPage}
              onProfileChange={setProfile}
            />
            {page === "sessions" && <SessionsPage transport={transport} />}
            {page === "runtime" && (
              <RuntimeStatus transport={transport} isAdmin={profile === "admin"} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
