import {
  AgUiChatAgentPort,
  AssistantApiError,
  AssistantApiTransport,
} from "@assistant/assistant-transport";
import { ChatWorkspace, type SelectedBusinessObject } from "@assistant/assistant-ui";
import { AppstoreOutlined, HomeOutlined, MessageOutlined } from "@ant-design/icons";
import { PageContainer, ProCard, ProLayout } from "@ant-design/pro-components";
import { Alert, Button, Descriptions, Empty, Select, Space, Table, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useOutletContext,
} from "react-router-dom";

type Profile = "user-a" | "user-b" | "admin";

const PAGE_PATHS = ["/assistant", "/sessions", "/runtime"] as const;
type PagePath = (typeof PAGE_PATHS)[number];

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

const shellRoute = {
  path: "/",
  routes: [
    { path: "/assistant", name: "智能对话", icon: <HomeOutlined /> },
    { path: "/sessions", name: "会话管理", icon: <MessageOutlined /> },
    { path: "/runtime", name: "运行状态", icon: <AppstoreOutlined /> },
  ],
};

function normalizePathname(pathname: string): PagePath {
  if (PAGE_PATHS.includes(pathname as PagePath)) return pathname as PagePath;
  return "/assistant";
}

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
    <PageContainer
      header={{
        title: "运行状态",
        subTitle: "仅显示安全的部署元数据；插件明细需要平台管理员权限。",
      }}
    >
      <main id="main-content">
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <div className="assistant-web-status-grid">
          <ProCard title="模型配置">
            <Descriptions column={1}>
              {models.map((item, index) => (
                <Descriptions.Item key={index} label={displayValue(item["provider"], "provider")}>
                  {displayValue(item["model"], displayValue(item["id"]))}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </ProCard>
          <ProCard title="标准能力">
            <Table
              rowKey={(row) => displayValue(row["id"], "unknown-capability")}
              pagination={false}
              dataSource={capabilities}
              columns={[
                { title: "能力", dataIndex: "id" },
                { title: "版本", dataIndex: "version" },
              ]}
            />
          </ProCard>
          <ProCard title="插件状态">
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
          </ProCard>
        </div>
      </main>
    </PageContainer>
  );
}

function SessionsPage({ transport }: { transport: AssistantApiTransport }) {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; status: string; createdAt: string }>
  >([]);
  const load = () => void transport.listSessions().then((result) => setSessions(result.items));
  useEffect(load, [transport]);

  return (
    <PageContainer
      header={{
        title: "会话管理",
        subTitle: "会话始终按当前身份和租户隔离。",
      }}
    >
      <main id="main-content">
        <ProCard>
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
        </ProCard>
      </main>
    </PageContainer>
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
    <label className="assistant-web-identity">
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

function AssistantChatPage({
  transport,
  selectedObject,
  profileKey,
}: {
  transport: AssistantApiTransport;
  selectedObject: SelectedBusinessObject;
  profileKey: Profile;
}) {
  const chatTransport = useMemo(() => new AgUiChatAgentPort(transport), [transport]);
  return (
    <div className="assistant-web-chat-host">
      <ChatWorkspace
        key={profileKey}
        transport={chatTransport}
        selectedObject={selectedObject}
        workspaceClassName="codex-workspace"
      />
    </div>
  );
}

type AppOutletContext = {
  transport: AssistantApiTransport;
  profile: Profile;
  isAdmin: boolean;
  selectedObject: SelectedBusinessObject;
};

function useAppOutletContext(): AppOutletContext {
  const context = useOutletContext<AppOutletContext>();
  if (context === undefined) {
    throw new Error("App routes must render inside AppLayout.");
  }
  return context;
}

function AssistantRoute() {
  const { transport, profile, selectedObject } = useAppOutletContext();
  return (
    <AssistantChatPage
      transport={transport}
      selectedObject={selectedObject}
      profileKey={profile}
    />
  );
}

function SessionsRoute() {
  const { transport } = useAppOutletContext();
  return <SessionsPage transport={transport} />;
}

function RuntimeRoute() {
  const { transport, isAdmin } = useAppOutletContext();
  return <RuntimeStatus transport={transport} isAdmin={isAdmin} />;
}

function AppLayout() {
  const location = useLocation();
  const [profile, setProfile] = useState<Profile>("user-a");
  const [collapsed, setCollapsed] = useState(true);
  const current = profileConfig[profile];
  const transport = useMemo(
    () => new AssistantApiTransport({ getAccessCredential: () => current.token }),
    [current.token],
  );
  const pathname = normalizePathname(location.pathname);
  const isChatPage = pathname === "/assistant";
  const outletContext = useMemo<AppOutletContext>(
    () => ({
      transport,
      profile,
      isAdmin: profile === "admin",
      selectedObject: current.object,
    }),
    [transport, profile, current.object],
  );

  return (
    <ProLayout
      className={
        isChatPage ? "assistant-web-layout assistant-web-layout--chat" : "assistant-web-layout"
      }
      title="Enterprise Assistant"
      logo={
        <div className="assistant-web-logo" aria-hidden>
          EA
        </div>
      }
      layout="mix"
      fixSiderbar
      defaultCollapsed
      collapsed={collapsed}
      onCollapse={setCollapsed}
      breakpoint={false}
      location={{ pathname }}
      route={shellRoute}
      menuItemRender={(item, dom) => {
        const target = typeof item.path === "string" ? item.path : "/assistant";
        return <Link to={target}>{dom}</Link>;
      }}
      siderWidth={220}
      contentStyle={
        isChatPage
          ? { padding: 0, height: "calc(100vh - 56px)", overflow: "hidden" }
          : { minHeight: "calc(100vh - 56px)" }
      }
      actionsRender={() => [
        <IdentitySelect key="identity" profile={profile} onChange={setProfile} />,
      ]}
    >
      <Outlet context={outletContext} />
    </ProLayout>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/assistant" replace />} />
        <Route path="/assistant" element={<AssistantRoute />} />
        <Route path="/sessions" element={<SessionsRoute />} />
        <Route path="/runtime" element={<RuntimeRoute />} />
        <Route path="*" element={<Navigate to="/assistant" replace />} />
      </Route>
    </Routes>
  );
}
