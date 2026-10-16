import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AssistantApiError, AssistantApiTransport } from "@assistant/assistant-transport";
import { ChatWorkspace } from "@assistant/assistant-ui";
import { AppstoreOutlined, ClockCircleOutlined, HomeOutlined, MessageOutlined, SettingOutlined, } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty, Select, Space, Table, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
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
const recentTopics = [
    "订单数据集质量趋势分析",
    "客户数据集完整性复核",
    "治理规则执行摘要",
];
function RuntimeStatus({ transport, isAdmin, }) {
    const [models, setModels] = useState([]);
    const [capabilities, setCapabilities] = useState([]);
    const [plugins, setPlugins] = useState([]);
    const [error, setError] = useState();
    useEffect(() => {
        let disposed = false;
        void Promise.all([
            transport.listModels(),
            transport.listCapabilities(),
            isAdmin ? transport.listPlugins() : Promise.resolve({ items: [] }),
        ])
            .then(([modelResult, capabilityResult, pluginResult]) => {
            if (disposed)
                return;
            setModels(modelResult.items);
            setCapabilities(capabilityResult.items);
            setPlugins(pluginResult.items);
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
    return (_jsxs("main", { className: "codex-admin-page", id: "main-content", children: [_jsxs("div", { className: "codex-admin-heading", children: [_jsx("h1", { children: "\u8FD0\u884C\u72B6\u6001" }), _jsx("p", { children: "\u4EC5\u663E\u793A\u5B89\u5168\u7684\u90E8\u7F72\u5143\u6570\u636E\uFF1B\u63D2\u4EF6\u660E\u7EC6\u9700\u8981\u5E73\u53F0\u7BA1\u7406\u5458\u6743\u9650\u3002" })] }), error && _jsx(Alert, { type: "error", showIcon: true, title: error }), _jsxs("div", { className: "status-grid", children: [_jsx(Card, { title: "\u6A21\u578B\u914D\u7F6E", bordered: false, children: _jsx(Descriptions, { column: 1, children: models.map((item, index) => (_jsx(Descriptions.Item, { label: displayValue(item["provider"], "provider"), children: displayValue(item["model"], displayValue(item["id"])) }, index))) }) }), _jsx(Card, { title: "\u6807\u51C6\u80FD\u529B", bordered: false, children: _jsx(Table, { rowKey: (row) => displayValue(row["id"], "unknown-capability"), pagination: false, dataSource: capabilities, columns: [
                                { title: "能力", dataIndex: "id" },
                                { title: "版本", dataIndex: "version" },
                            ] }) }), _jsx(Card, { title: "\u63D2\u4EF6\u72B6\u6001", bordered: false, children: isAdmin ? (_jsx(Table, { rowKey: (row) => displayValue(row["pluginId"], "unknown-plugin"), pagination: false, dataSource: plugins, columns: [
                                { title: "插件", dataIndex: "pluginId" },
                                {
                                    title: "状态",
                                    dataIndex: "status",
                                    render: (value) => (_jsx(Tag, { color: value === "active" ? "cyan" : "gold", children: String(value) })),
                                },
                            ] })) : (_jsx(Empty, { description: "\u7BA1\u7406\u5458\u53EF\u67E5\u770B\u63D2\u4EF6\u8FD0\u884C\u660E\u7EC6" })) })] })] }));
}
function SessionsPage({ transport }) {
    const [sessions, setSessions] = useState([]);
    const load = () => void transport.listSessions().then((result) => setSessions(result.items));
    useEffect(load, [transport]);
    return (_jsxs("main", { className: "codex-admin-page", id: "main-content", children: [_jsxs("div", { className: "codex-admin-heading", children: [_jsx("h1", { children: "\u4F1A\u8BDD\u7BA1\u7406" }), _jsx("p", { children: "\u4F1A\u8BDD\u59CB\u7EC8\u6309\u5F53\u524D\u8EAB\u4EFD\u548C\u79DF\u6237\u9694\u79BB\u3002" })] }), _jsx(Table, { rowKey: "id", dataSource: sessions, columns: [
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
                ] })] }));
}
function CodexListPane({ page, profileLabel, onNavigate, onProfileChange, profile, }) {
    return (_jsxs("aside", { className: "codex-list-pane", "aria-label": "\u5DE5\u4F5C\u533A\u5BFC\u822A", children: [_jsx("div", { className: "codex-list-head", children: _jsx("button", { className: "codex-app-title", type: "button", onClick: () => onNavigate("assistant"), children: "Enterprise Assistant" }) }), _jsx(Button, { block: true, className: "codex-new-chat", icon: _jsx(MessageOutlined, {}), type: "default", onClick: () => onNavigate("assistant"), children: "\u65B0\u804A\u5929" }), _jsxs("div", { className: "codex-list-section", children: [_jsx("span", { className: "codex-list-label", children: "\u9879\u76EE" }), _jsxs("button", { className: page === "assistant" ? "codex-list-item active" : "codex-list-item", type: "button", onClick: () => onNavigate("assistant"), children: [_jsx("strong", { children: "Deep agents \u901A\u7528 AI \u667A\u80FD\u52A9\u624B" }), _jsxs("small", { children: [profileLabel, " \u00B7 \u8BA2\u5355\u6570\u636E\u96C6"] })] })] }), _jsxs("div", { className: "codex-list-section", children: [_jsx("span", { className: "codex-list-label", children: "\u6700\u8FD1" }), recentTopics.map((topic) => (_jsx("button", { className: "codex-list-item", type: "button", onClick: () => onNavigate("assistant"), children: topic }, topic)))] }), _jsxs("div", { className: "codex-list-section", children: [_jsx("span", { className: "codex-list-label", children: "\u7BA1\u7406" }), _jsx("button", { className: page === "sessions" ? "codex-list-item active" : "codex-list-item", type: "button", onClick: () => onNavigate("sessions"), children: "\u4F1A\u8BDD" }), _jsx("button", { className: page === "runtime" ? "codex-list-item active" : "codex-list-item", type: "button", onClick: () => onNavigate("runtime"), children: "\u8FD0\u884C\u72B6\u6001" })] }), _jsxs("label", { className: "codex-identity", children: [_jsx("span", { children: "\u672C\u5730\u6A21\u62DF\u8EAB\u4EFD" }), _jsx(Select, { "aria-label": "\u672C\u5730\u6A21\u62DF\u8EAB\u4EFD", value: profile, onChange: onProfileChange, options: Object.entries(profileConfig).map(([value, config]) => ({
                            value,
                            label: config.label,
                        })) })] })] }));
}
export function App() {
    const [profile, setProfile] = useState("user-a");
    const [page, setPage] = useState("assistant");
    const current = profileConfig[profile];
    const transport = useMemo(() => new AssistantApiTransport({ getAccessCredential: () => current.token }), [current.token]);
    return (_jsxs("div", { className: "codex-shell", children: [_jsxs("nav", { className: "codex-rail", "aria-label": "\u5168\u5C40\u5BFC\u822A", children: [_jsx("button", { "aria-label": "\u52A9\u624B", className: page === "assistant" ? "codex-rail-btn active" : "codex-rail-btn", type: "button", onClick: () => setPage("assistant"), children: _jsx(HomeOutlined, {}) }), _jsx("button", { "aria-label": "\u4F1A\u8BDD", className: page === "sessions" ? "codex-rail-btn active" : "codex-rail-btn", type: "button", onClick: () => setPage("sessions"), children: _jsx(MessageOutlined, {}) }), _jsx("button", { "aria-label": "\u5386\u53F2", className: "codex-rail-btn", type: "button", onClick: () => setPage("assistant"), children: _jsx(ClockCircleOutlined, {}) }), _jsx("button", { "aria-label": "\u8FD0\u884C\u72B6\u6001", className: page === "runtime" ? "codex-rail-btn active" : "codex-rail-btn", type: "button", onClick: () => setPage("runtime"), children: _jsx(AppstoreOutlined, {}) }), _jsx("div", { className: "codex-rail-spacer" }), _jsx("label", { className: "codex-rail-identity", children: _jsx(Select, { "aria-label": "\u672C\u5730\u6A21\u62DF\u8EAB\u4EFD", size: "small", value: profile, onChange: setProfile, options: Object.entries(profileConfig).map(([value, config]) => ({
                                value,
                                label: config.label,
                            })) }) }), _jsx("button", { "aria-label": "\u8BBE\u7F6E", className: "codex-rail-btn", type: "button", children: _jsx(SettingOutlined, {}) })] }), _jsxs("div", { className: page === "assistant" ? "codex-stage codex-stage--chat" : "codex-stage", children: [page === "assistant" && (_jsx(ChatWorkspace, { transport: transport, selectedObject: current.object, workspaceClassName: "codex-workspace" }, profile)), page !== "assistant" && (_jsxs(_Fragment, { children: [_jsx(CodexListPane, { page: page, profile: profile, profileLabel: current.label, onNavigate: setPage, onProfileChange: setProfile }), page === "sessions" && _jsx(SessionsPage, { transport: transport }), page === "runtime" && (_jsx(RuntimeStatus, { transport: transport, isAdmin: profile === "admin" }))] }))] })] }));
}
//# sourceMappingURL=App.js.map