import { jsx as _jsx } from "react/jsx-runtime";
import "antd/dist/reset.css";
import "@assistant/assistant-ui/styles.css";
import "./app.css";
import { XProvider } from "@ant-design/x";
import { ConfigProvider } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(ConfigProvider, { theme: { token: { colorPrimary: "#087f76", colorText: "#102a2c", borderRadius: 10 } }, children: _jsx(XProvider, { children: _jsx(App, {}) }) }) }));
//# sourceMappingURL=main.js.map