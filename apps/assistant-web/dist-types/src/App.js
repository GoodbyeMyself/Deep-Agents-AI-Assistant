import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AgUiChatAgentPort, AssistantApiError, AssistantApiTransport, } from "@assistant/assistant-transport";
import { ChatWorkspace } from "@assistant/assistant-ui";
import { AppstoreOutlined, HomeOutlined, MessageOutlined } from "@ant-design/icons";
import { PageContainer, ProCard, ProLayout } from "@ant-design/pro-components";
import { Alert, Button, Descriptions, Empty, Select, Space, Table, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext, } from "react-router-dom";
const PAGE_PATHS = ["/assistant", "/sessions", "/runtime"];
function displayValue(value, fallback = "—") {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : fallback;
}
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
        { path: "/runtime", name: "运行状态", icon: _jsx(AppstoreOutlined, {}) },
    ],
};
function normalizePathname(pathname) {
    if (PAGE_PATHS.includes(pathname))
        return pathname;
    return "/assistant";
}
function RuntimeStatus({ transport, isAdmin, }) {
    const [models, setModels] = useState([]);
    const [mcpTools, setMcpTools] = useState([]);
    const [mcpServers, setMcpServers] = useState([]);
    const [platformExtensions, setPlatformExtensions] = useState([]);
    const [error, setError] = useState();
    useEffect(() => {
        let disposed = false;
        void Promise.all([
            transport.listModels(),
            transport.listMcpTools(),
            isAdmin ? transport.listMcpServers() : Promise.resolve({ items: [] }),
            isAdmin ? transport.listPlatformExtensions() : Promise.resolve({ items: [] }),
        ])
            .then(([modelResult, toolResult, serverResult, extensionResult]) => {
            if (disposed)
                return;
            setModels(modelResult.items);
            setMcpTools(toolResult.items);
            setMcpServers(serverResult.items);
            setPlatformExtensions(extensionResult.items);
        })
            .catch((cause) => {
            if (!disposed)
                setError(cause instanceof AssistantApiError
                    ? `${cause.message}（${cause.code}）`
                    : "状态读取失败");
        });
        return () => {
            disposed = true;
        };
    }, [transport, isAdmin]);
    return (_jsx(PageContainer, { header: {
            title: "运行状态",
            subTitle: "仅显示安全的部署元数据；MCP Server 与平台扩展明细需要平台管理员权限。",
        }, children: _jsxs("main", { id: "main-content", children: [error && _jsx(Alert, { type: "error", showIcon: true, title: error, style: { marginBottom: 16 } }), _jsxs("div", { className: "assistant-web-status-grid", children: [_jsx(ProCard, { title: "\u6A21\u578B\u914D\u7F6E", children: _jsx(Descriptions, { column: 1, children: models.map((item, index) => (_jsx(Descriptions.Item, { label: displayValue(item["provider"], "provider"), children: displayValue(item["model"], displayValue(item["id"])) }, index))) }) }), _jsx(ProCard, { title: "MCP Tools", children: _jsx(Table, { rowKey: (row) => displayValue(row["name"], "unknown-tool"), pagination: false, dataSource: mcpTools, columns: [
                                    { title: "Tool", dataIndex: "name" },
                                    { title: "MCP Server", dataIndex: "serverId" },
                                ] }) }), _jsx(ProCard, { title: "MCP Server \u72B6\u6001", children: isAdmin ? (_jsx(Table, { rowKey: (row) => displayValue(row["serverId"], "unknown-mcp-server"), pagination: false, dataSource: mcpServers, columns: [
                                    { title: "MCP Server", dataIndex: "serverId" },
                                    {
                                        title: "状态",
                                        dataIndex: "status",
                                        render: (value) => (_jsx(Tag, { color: value === "ready" ? "cyan" : "gold", children: String(value) })),
                                    },
                                ] })) : (_jsx(Empty, { description: "\u7BA1\u7406\u5458\u53EF\u67E5\u770B MCP Server \u8FD0\u884C\u660E\u7EC6" })) }), _jsx(ProCard, { title: "Platform Extensions", children: isAdmin ? (_jsx(Table, { rowKey: (row) => displayValue(row["id"], "unknown-platform-extension"), pagination: false, dataSource: platformExtensions, columns: [
                                    { title: "Extension", dataIndex: "id" },
                                    { title: "版本", dataIndex: "version" },
                                    {
                                        title: "状态",
                                        dataIndex: "status",
                                        render: (value) => _jsx(Tag, { color: "cyan", children: String(value) }),
                                    },
                                ] })) : (_jsx(Empty, { description: "\u7BA1\u7406\u5458\u53EF\u67E5\u770B\u5E73\u53F0\u6269\u5C55\u8FD0\u884C\u660E\u7EC6" })) })] })] }) }));
}
function SessionsPage({ transport }) {
    const [sessions, setSessions] = useState([]);
    const load = () => void transport.listSessions().then((result) => setSessions(result.items));
    useEffect(load, [transport]);
    return (_jsx(PageContainer, { header: {
            title: "会话管理",
            subTitle: "会话始终按当前身份和租户隔离。",
        }, children: _jsx("main", { id: "main-content", children: _jsx(ProCard, { children: _jsx(Table, { rowKey: "id", dataSource: sessions, columns: [
                        { title: "名称", dataIndex: "title" },
                        { title: "状态", dataIndex: "status" },
                        {
                            title: "创建时间",
                            dataIndex: "createdAt",
                            render: (value) => new Date(String(value)).toLocaleString(),
                        },
                        {
                            title: "操作",
                            render: (_, row) => (_jsxs(Space, { children: [_jsx(Button, { onClick: () => void transport
                                            .updateSession(row.id, { archived: row.status !== "archived" })
                                            .then(load), children: row.status === "archived" ? "恢复" : "归档" }), _jsx(Button, { danger: true, onClick: () => void transport.deleteSession(row.id).then(load), children: "\u5220\u9664" })] })),
                        },
                    ] }) }) }) }));
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
function RuntimeRoute() {
    const { transport, isAdmin } = useAppOutletContext();
    return _jsx(RuntimeStatus, { transport: transport, isAdmin: isAdmin });
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
    return (_jsx(ProLayout, { className: isChatPage ? "assistant-web-layout assistant-web-layout--chat" : "assistant-web-layout", title: "Enterprise Assistant", logo: _jsx("div", { className: "assistant-web-logo", "aria-hidden": true, children: "EA" }), layout: "mix", fixSiderbar: true, defaultCollapsed: true, collapsed: collapsed, onCollapse: setCollapsed, breakpoint: false, location: { pathname }, route: shellRoute, menuItemRender: (item, dom) => {
            const target = typeof item.path === "string" ? item.path : "/assistant";
            return _jsx(Link, { to: target, children: dom });
        }, siderWidth: 220, contentStyle: isChatPage
            ? { padding: 0, height: "calc(100vh - 56px)", overflow: "hidden" }
            : { minHeight: "calc(100vh - 56px)" }, actionsRender: () => [
            _jsx(IdentitySelect, { profile: profile, onChange: setProfile }, "identity"),
        ], children: _jsx(Outlet, { context: outletContext }) }));
}
export function App() {
    return (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(AppLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/assistant", replace: true }) }), _jsx(Route, { path: "/assistant", element: _jsx(AssistantRoute, {}) }), _jsx(Route, { path: "/sessions", element: _jsx(SessionsRoute, {}) }), _jsx(Route, { path: "/runtime", element: _jsx(RuntimeRoute, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/assistant", replace: true }) })] }) }));
}
//# sourceMappingURL=App.js.map