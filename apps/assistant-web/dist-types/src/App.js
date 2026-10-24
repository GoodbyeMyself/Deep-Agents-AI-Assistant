import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ModelsPage, McpPage, PlatformExtensionsPage } from "./RuntimePages.js";
import { assistantAppName } from "./brand.js";
import { AgUiChatAgentPort, AssistantApiTransport, } from "@assistant/assistant-transport";
import { AssistantBrandIcon, ChatWorkspace, SessionActionDialog } from "@assistant/assistant-ui";
import { AppstoreOutlined, ApiOutlined, HomeOutlined, MessageOutlined, SettingOutlined } from "@ant-design/icons";
import { PageContainer, ProCard, ProLayout } from "@ant-design/pro-components";
import { Alert, Button, Select, Space, Table } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext, } from "react-router-dom";
const PAGE_PATHS = ["/assistant", "/sessions", "/models", "/mcp", "/platform-extensions"];
const profileConfig = {
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
        { path: "/assistant", name: "智能对话", icon: _jsx(HomeOutlined, {}) },
        { path: "/sessions", name: "会话管理", icon: _jsx(MessageOutlined, {}) },
        { path: "/models", name: "模型配置", icon: _jsx(SettingOutlined, {}) },
        { path: "/mcp", name: "MCP 管理", icon: _jsx(ApiOutlined, {}) },
        { path: "/platform-extensions", name: "平台扩展", icon: _jsx(AppstoreOutlined, {}) },
    ],
};
function normalizePathname(pathname) {
    if (PAGE_PATHS.includes(pathname))
        return pathname;
    return "/assistant";
}
function SessionsPage({ transport }) {
    const [sessions, setSessions] = useState([]);
    const [sessionAction, setSessionAction] = useState();
    const [error, setError] = useState();
    const load = () => void transport.listSessions().then((result) => setSessions(result.items))
        .catch(() => setError("无法加载会话，请稍后重试。"));
    useEffect(load, [transport]);
    return (_jsx(PageContainer, { header: {
            title: "会话管理",
            subTitle: "会话始终按当前身份和租户隔离。",
        }, children: _jsxs("main", { id: "main-content", children: [error !== undefined && _jsx(Alert, { type: "error", showIcon: true, title: error }), _jsx(ProCard, { children: _jsx(Table, { rowKey: "id", dataSource: sessions, columns: [
                            { title: "名称", dataIndex: "title" },
                            { title: "状态", dataIndex: "status" },
                            {
                                title: "创建时间",
                                dataIndex: "createdAt",
                                render: (value) => new Date(String(value)).toLocaleString(),
                            },
                            {
                                title: "操作",
                                render: (_, row) => (_jsxs(Space, { children: [_jsx(Button, { onClick: () => setSessionAction({ type: "rename", session: row }), children: "\u91CD\u547D\u540D" }), _jsx(Button, { onClick: () => void transport
                                                .updateSession(row.id, { archived: row.status !== "archived" })
                                                .then(load), children: row.status === "archived" ? "恢复" : "归档" }), _jsx(Button, { danger: true, onClick: () => setSessionAction({ type: "delete", session: row }), children: "\u5220\u9664" })] })),
                            },
                        ] }) }), sessionAction !== undefined && (_jsx(SessionActionDialog, { action: sessionAction, onClose: () => setSessionAction(undefined), onRename: async (id, title) => {
                        const updated = await transport.updateSession(id, { title });
                        setSessions((current) => current.map((session) => session.id === id ? updated : session));
                    }, onDelete: async (id) => {
                        await transport.deleteSession(id);
                        setSessions((current) => current.filter((session) => session.id !== id));
                    } }, `${sessionAction.type}:${sessionAction.session.id}`))] }) }));
}
function IdentitySelect({ profile, onChange, }) {
    return (_jsxs("label", { className: "assistant-web-identity", children: [_jsx("span", { children: "\u672C\u5730\u6A21\u62DF\u8EAB\u4EFD" }), _jsx(Select, { "aria-label": "\u672C\u5730\u6A21\u62DF\u8EAB\u4EFD", value: profile, onChange: onChange, options: Object.entries(profileConfig).map(([value, config]) => ({
                    value,
                    label: config.label,
                })) })] }));
}
function AssistantChatPage({ transport, selectedObject, profileKey, }) {
    const chatTransport = useMemo(() => new AgUiChatAgentPort(transport), [transport]);
    return (_jsx("div", { className: "assistant-web-chat-host", children: _jsx(ChatWorkspace, { transport: chatTransport, selectedObject: selectedObject, workspaceClassName: "codex-workspace" }, profileKey) }));
}
function useAppOutletContext() {
    const context = useOutletContext();
    if (context === undefined) {
        throw new Error("App routes must render inside AppLayout.");
    }
    return context;
}
function AssistantRoute() {
    const { transport, profile, selectedObject } = useAppOutletContext();
    return (_jsx(AssistantChatPage, { transport: transport, selectedObject: selectedObject, profileKey: profile }));
}
function SessionsRoute() {
    const { transport } = useAppOutletContext();
    return _jsx(SessionsPage, { transport: transport });
}
function DeploymentRoute({ page }) {
    const { transport, isAdmin } = useAppOutletContext();
    if (page === "models")
        return _jsx(ModelsPage, { transport: transport });
    if (page === "mcp")
        return _jsx(McpPage, { transport: transport, isAdmin: isAdmin });
    return _jsx(PlatformExtensionsPage, { transport: transport, isAdmin: isAdmin });
}
function AppLayout() {
    const location = useLocation();
    const [profile, setProfile] = useState("user-a");
    const [collapsed, setCollapsed] = useState(true);
    const current = profileConfig[profile];
    const transport = useMemo(() => new AssistantApiTransport({ getAccessCredential: () => current.token }), [current.token]);
    const pathname = normalizePathname(location.pathname);
    const isChatPage = pathname === "/assistant";
    const outletContext = useMemo(() => ({
        transport,
        profile,
        isAdmin: profile === "admin",
        selectedObject: current.object,
    }), [transport, profile, current.object]);
    return (_jsx(ProLayout, { className: isChatPage ? "assistant-web-layout assistant-web-layout--chat" : "assistant-web-layout", title: assistantAppName, logo: _jsx("div", { className: "assistant-web-logo", "aria-hidden": true, children: _jsx(AssistantBrandIcon, {}) }), layout: "mix", fixSiderbar: true, defaultCollapsed: true, collapsed: collapsed, onCollapse: setCollapsed, breakpoint: false, location: { pathname }, route: shellRoute, menuItemRender: (item, dom) => {
            const target = typeof item.path === "string" ? item.path : "/assistant";
            return _jsx(Link, { to: target, children: dom });
        }, siderWidth: 220, contentStyle: isChatPage
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
                : { minHeight: "calc(100vh - 56px)" }, actionsRender: () => [
            _jsx(IdentitySelect, { profile: profile, onChange: setProfile }, "identity"),
        ], children: _jsx(Outlet, { context: outletContext }) }));
}
export function App() {
    return (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(AppLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/assistant", replace: true }) }), _jsx(Route, { path: "/assistant", element: _jsx(AssistantRoute, {}) }), _jsx(Route, { path: "/sessions", element: _jsx(SessionsRoute, {}) }), _jsx(Route, { path: "/models", element: _jsx(DeploymentRoute, { page: "models" }) }), _jsx(Route, { path: "/mcp", element: _jsx(DeploymentRoute, { page: "mcp" }) }), _jsx(Route, { path: "/platform-extensions", element: _jsx(DeploymentRoute, { page: "extensions" }) }), _jsx(Route, { path: "/runtime", element: _jsx(Navigate, { to: "/mcp", replace: true }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/assistant", replace: true }) })] }) }));
}
//# sourceMappingURL=App.js.map