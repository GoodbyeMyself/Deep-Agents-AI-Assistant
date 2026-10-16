import "antd/dist/reset.css";
import "@assistant/assistant-ui/styles.css";
import "./app.css";

import { XProvider } from "@ant-design/x";
import { ConfigProvider } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider
      theme={{ token: { colorPrimary: "#2563eb", colorText: "#1f2937", borderRadius: 10 } }}
    >
      <XProvider>
        <App />
      </XProvider>
    </ConfigProvider>
  </StrictMode>,
);
