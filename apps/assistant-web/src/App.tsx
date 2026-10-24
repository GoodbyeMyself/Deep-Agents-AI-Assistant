import { ModelsPage, McpPage, PlatformExtensionsPage } from "./RuntimePages.js";
import { assistantAppName } from "./brand.js";
import {
  AgUiChatAgentPort,
  AssistantApiTransport,
  type SessionDto,
} from "@assistant/assistant-transport";
import { AssistantBrandIcon, ChatWorkspace, SessionActionDialog, type SessionAction, type SelectedBusinessObject } from "@assistant/assistant-ui";
import { AppstoreOutlined, ApiOutlined, HomeOutlined, MessageOutlined, SettingOutlined } from "@ant-design/icons";
import { PageContainer, ProCard, ProLayout } from "@ant-design/pro-components";
import { Alert, Button, Select, Space, Table } from "antd";
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
const externalIdentity = import.meta.env["VITE_IDENTITY_MODE"] === "external";

const PAGE_PATHS = ["/assistant", "/sessions", "/models", "/mcp", "/platform-extensions"] as const;
type PagePath = (typeof PAGE_PATHS)[number];

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
    { path: "/models", name: "模型配置", icon: <SettingOutlined /> },
    { path: "/mcp", name: "MCP 管理", icon: <ApiOutlined /> },
    { path: "/platform-extensions", name: "平台扩展", icon: <AppstoreOutlined /> },
  ],
};

function normalizePathname(pathname: string): PagePath {
  if (PAGE_PATHS.includes(pathname as PagePath)) return pathname as PagePath;
  return "/assistant";
}

function SessionsPage({ transport }: { transport: AssistantApiTransport }) {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [sessionAction, setSessionAction] = useState<SessionAction>();
  const [error, setError] = useState<string>();
  const load = () => void transport.listSessions().then((result) => setSessions(result.items))
    .catch(() => setError("无法加载会话，请稍后重试。"));
  useEffect(load, [transport]);

  return (
    <PageContainer
      header={{
        title: "会话管理",
        subTitle: "会话始终按当前身份和租户隔离。",
      }}
    >
      <main id="main-content">
        {error !== undefined && <Alert type="error" showIcon title={error} />}
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
                    <Button onClick={() => setSessionAction({ type: "rename", session: row })}>
                      重命名
                    </Button>
                    <Button
                      onClick={() =>
                        void transport
                          .updateSession(row.id, { archived: row.status !== "archived" })
                          .then(load)
                      }
                    >
                      {row.status === "archived" ? "恢复" : "归档"}
                    </Button>
                    <Button danger onClick={() => setSessionAction({ type: "delete", session: row })}>
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </ProCard>
        {sessionAction !== undefined && (
          <SessionActionDialog key={`${sessionAction.type}:${sessionAction.session.id}`}
            action={sessionAction} onClose={() => setSessionAction(undefined)}
            onRename={async (id, title) => {
              const updated = await transport.updateSession(id, { title });
              setSessions((current) => current.map((session) => session.id === id ? updated : session));
            }}
            onDelete={async (id) => {
              await transport.deleteSession(id);
              setSessions((current) => current.filter((session) => session.id !== id));
            }} />
        )}
      </main>
    </PageContainer>
  );
}

function HeaderIdentity({
  externalIdentity,
  identityDisplayName,
  profile,
  onProfileChange,
}: {
  externalIdentity: boolean;
  identityDisplayName: string | undefined;
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}) {
  if (externalIdentity) {
    return (
      <span className="assistant-web-header-user" title={identityDisplayName}>
        {identityDisplayName}
      </span>
    );
  }

  return (
    <label className="assistant-web-header-user assistant-web-header-user--select">
      <span>本地模拟身份</span>
      <Select
        aria-label="本地模拟身份"
        value={profile}
        onChange={onProfileChange}
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
  selectedObject: SelectedBusinessObject | undefined;
  profileKey: Profile;
}) {
  const chatTransport = useMemo(() => new AgUiChatAgentPort(transport), [transport]);
  return (
    <div className="assistant-web-chat-host">
      <ChatWorkspace
        key={profileKey}
        transport={chatTransport}
        {...(selectedObject === undefined ? {} : { selectedObject })}
        {...(externalIdentity ? { getContext: () => ({ page: { route: "/assistant", title: "智能助手", type: "assistant" } }) } : {})}
        workspaceClassName="codex-workspace"
      />
    </div>
  );
}

type AppOutletContext = {
  transport: AssistantApiTransport;
  profile: Profile;
  isAdmin: boolean;
  selectedObject: SelectedBusinessObject | undefined;
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
    <AssistantChatPage transport={transport} selectedObject={selectedObject} profileKey={profile} />
  );
}

function SessionsRoute() {
  const { transport } = useAppOutletContext();
  return <SessionsPage transport={transport} />;
}

function DeploymentRoute({ page }: { page: "models" | "mcp" | "extensions" }) {
  const { transport, isAdmin } = useAppOutletContext();
  if (page === "models") return <ModelsPage transport={transport} />;
  if (page === "mcp") return <McpPage transport={transport} isAdmin={isAdmin} />;
  return <PlatformExtensionsPage transport={transport} isAdmin={isAdmin} />;
}

function AppLayout() {
  const location = useLocation();
  const [profile, setProfile] = useState<Profile>("user-a");
  const [collapsed, setCollapsed] = useState(true);
  const [identity, setIdentity] = useState<{ displayName: string; isAdmin: boolean }>();
  const [identityError, setIdentityError] = useState(false);
  useEffect(() => {
    if (!externalIdentity) return;
    const abort = new AbortController();
    void fetch("/api/v1/identity", { credentials: "same-origin", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Authentication required.");
        const value = await response.json() as { displayName?: unknown; isAdmin?: unknown };
        if (typeof value.displayName !== "string" || typeof value.isAdmin !== "boolean") throw new Error("Invalid identity.");
        setIdentity({ displayName: value.displayName, isAdmin: value.isAdmin });
      }).catch(() => { if (!abort.signal.aborted) setIdentityError(true); });
    return () => abort.abort();
  }, []);
  const current = profileConfig[profile];
  const transport = useMemo(
    () => new AssistantApiTransport({ getAccessCredential: () => externalIdentity ? "" : current.token }),
    [current.token],
  );
  const pathname = normalizePathname(location.pathname);
  const isChatPage = pathname === "/assistant";
  const outletContext = useMemo<AppOutletContext>(
    () => ({
      transport,
      profile,
      isAdmin: externalIdentity ? identity?.isAdmin === true : profile === "admin",
      selectedObject: externalIdentity ? undefined : current.object,
    }),
    [transport, profile, current.object, identity],
  );

  if (externalIdentity && !identity) return <Alert type={identityError ? "warning" : "info"}
    title={identityError ? "请先登录业务系统，再刷新此页面。" : "正在验证登录身份…"}
    action={identityError ? <a href={String(import.meta.env["VITE_IDENTITY_LOGIN_URL"] ?? "/")}>前往登录</a> : undefined} />;

  return (
    <ProLayout
      className={
        isChatPage ? "assistant-web-layout assistant-web-layout--chat" : "assistant-web-layout"
      }
      title={assistantAppName}
      logo={
        <div className="assistant-web-logo" aria-hidden>
          <AssistantBrandIcon />
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
          : ["/models", "/mcp", "/platform-extensions"].includes(pathname)
            ? {
                height: "calc(100dvh - 56px)",
                minHeight: 0,
                margin: 0,
                padding: "24px 24px 32px",
                boxSizing: "border-box",
                overflowY: "auto",
                scrollbarGutter: "stable",
              }
            : { minHeight: "calc(100vh - 56px)" }
      }
      actionsRender={() => [
        <HeaderIdentity
          key="identity"
          externalIdentity={externalIdentity}
          identityDisplayName={identity?.displayName}
          profile={profile}
          onProfileChange={setProfile}
        />,
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
        <Route path="/models" element={<DeploymentRoute page="models" />} />
        <Route path="/mcp" element={<DeploymentRoute page="mcp" />} />
        <Route path="/platform-extensions" element={<DeploymentRoute page="extensions" />} />
        <Route path="/runtime" element={<Navigate to="/mcp" replace />} />
        <Route path="*" element={<Navigate to="/assistant" replace />} />
      </Route>
    </Routes>
  );
}
