import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AssistantApiError, AssistantApiTransport } from "@assistant/assistant-transport";
import { ChatWorkspace } from "@assistant/assistant-ui";
import { DatabaseOutlined, MessageOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
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
    return (_jsxs("main", { className: "web-page", id: "main-content", children: [_jsxs("div", { className: "web-page-heading", children: [_jsx("span", { children: "DEPLOYMENT HEALTH" }), _jsx("h1", { children: "\u8FD0\u884C\u72B6\u6001" }), _jsx("p", { children: "\u4EC5\u663E\u793A\u5B89\u5168\u7684\u90E8\u7F72\u5143\u6570\u636E\uFF1B\u63D2\u4EF6\u660E\u7EC6\u9700\u8981\u5E73\u53F0\u7BA1\u7406\u5458\u6743\u9650\u3002" })] }), error && _jsx(Alert, { type: "error", showIcon: true, title: error }), _jsxs("div", { className: "status-grid", children: [_jsx(Card, { title: "\u6A21\u578B\u914D\u7F6E", children: _jsx(Descriptions, { column: 1, children: models.map((item, index) => (_jsx(Descriptions.Item, { label: displayValue(item["provider"], "provider"), children: displayValue(item["model"], displayValue(item["id"])) }, index))) }) }), _jsx(Card, { title: "\u6807\u51C6\u80FD\u529B", children: _jsx(Table, { rowKey: (row) => displayValue(row["id"], "unknown-capability"), pagination: false, dataSource: capabilities, columns: [
                                { title: "能力", dataIndex: "id" },
                                { title: "版本", dataIndex: "version" },
                            ] }) }), _jsx(Card, { title: "\u63D2\u4EF6\u72B6\u6001", children: isAdmin ? (_jsx(Table, { rowKey: (row) => displayValue(row["pluginId"], "unknown-plugin"), pagination: false, dataSource: plugins, columns: [
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
    return (_jsxs("main", { className: "web-page", id: "main-content", children: [_jsxs("div", { className: "web-page-heading", children: [_jsx("span", { children: "YOUR THREADS" }), _jsx("h1", { children: "\u4F1A\u8BDD\u7BA1\u7406" }), _jsx("p", { children: "\u4F1A\u8BDD\u59CB\u7EC8\u6309\u5F53\u524D\u8EAB\u4EFD\u548C\u79DF\u6237\u9694\u79BB\u3002" })] }), _jsx(Table, { rowKey: "id", dataSource: sessions, columns: [
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
export function App() {
    const [profile, setProfile] = useState("user-a");
    const [page, setPage] = useState("assistant");
    const current = profileConfig[profile];
    const transport = useMemo(() => new AssistantApiTransport({ getAccessCredential: () => current.token }), [current.token]);
    return (_jsxs("div", { className: "web-shell", children: [_jsxs("header", { className: "web-topbar", children: [_jsxs("button", { className: "web-brand", onClick: () => setPage("assistant"), children: [_jsx("span", { children: "EA" }), _jsx("strong", { children: "Enterprise Assistant" })] }), _jsxs("nav", { "aria-label": "\u4E3B\u5BFC\u822A", children: [_jsx(Button, { type: page === "assistant" ? "primary" : "text", icon: _jsx(MessageOutlined, {}), onClick: () => setPage("assistant"), children: "\u52A9\u624B" }), _jsx(Button, { type: page === "sessions" ? "primary" : "text", icon: _jsx(DatabaseOutlined, {}), onClick: () => setPage("sessions"), children: "\u4F1A\u8BDD" }), _jsx(Button, { type: page === "runtime" ? "primary" : "text", icon: _jsx(SafetyCertificateOutlined, {}), onClick: () => setPage("runtime"), children: "\u8FD0\u884C\u72B6\u6001" })] }), _jsxs("label", { className: "identity-control", children: [_jsx("span", { children: "\u672C\u5730\u6A21\u62DF\u8EAB\u4EFD" }), _jsx(Select, { "aria-label": "\u672C\u5730\u6A21\u62DF\u8EAB\u4EFD", value: profile, onChange: setProfile, options: Object.entries(profileConfig).map(([value, config]) => ({
                                    value,
                                    label: config.label,
                                })) })] })] }), page === "assistant" && (_jsx("main", { id: "main-content", className: "web-assistant-page", children: _jsx(ChatWorkspace, { transport: transport, selectedObject: current.object }, profile) })), page === "sessions" && _jsx(SessionsPage, { transport: transport }), page === "runtime" && _jsx(RuntimeStatus, { transport: transport, isAdmin: profile === "admin" })] }));
}
//# sourceMappingURL=App.js.map