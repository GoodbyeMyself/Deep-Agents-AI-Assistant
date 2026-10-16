import { jsx as _jsx } from "react/jsx-runtime";
import "antd/dist/reset.css";
import "@assistant/assistant-ui/styles.css";
import "./app.css";
import { XProvider } from "@ant-design/x";
import { ConfigProvider } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(ConfigProvider, { theme: {
            token: {
                colorPrimary: "#1677ff",
                colorText: "#1f2937",
                borderRadius: 6,
                fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
            },
        }, children: _jsx(XProvider, { children: _jsx(BrowserRouter, { children: _jsx(App, {}) }) }) }) }));
//# sourceMappingURL=main.js.map