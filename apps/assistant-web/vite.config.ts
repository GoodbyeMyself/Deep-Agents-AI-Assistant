import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { createBuildInfo } from "../../deploy/build-info.mjs";

function logApiProxyTarget(apiTarget: string, devOrigin: string): Plugin {
  return {
    name: "assistant-web-log-api-proxy",
    configureServer() {
      console.log(`[assistant-web] 开发页 ${devOrigin} ，/api 代理 → ${apiTarget}`);
      console.log(
        "[assistant-web] Docker 平台（deploy/local-compose agents）默认 API 为 3411；本机 agent-server 用 ASSISTANT_API_TARGET=http://127.0.0.1:3000。",
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const rootEnv = loadEnv(mode, repoRoot, "");
  const appName = (process.env["VITE_ASSISTANT_APP_NAME"] ?? rootEnv["VITE_ASSISTANT_APP_NAME"])?.trim().slice(0, 80) || "Copilot AI · 业务智能助手";
  const apiTarget =
    process.env["ASSISTANT_API_TARGET"] ??
    rootEnv["ASSISTANT_API_TARGET"] ??
    "http://127.0.0.1:3411";
  const port = Number(process.env["ASSISTANT_WEB_PORT"] ?? rootEnv["ASSISTANT_WEB_PORT"] ?? "5173");
  const devOrigin = `http://127.0.0.1:${port}`;
  const identityMode = (
    process.env["VITE_IDENTITY_MODE"] ??
    rootEnv["VITE_IDENTITY_MODE"] ??
    (apiTarget.includes(":3411") ? "external" : "")
  ).trim();
  const identityLoginUrl = (
    process.env["VITE_IDENTITY_LOGIN_URL"] ??
    rootEnv["VITE_IDENTITY_LOGIN_URL"] ??
    "http://127.0.0.1:19001/user/login"
  ).trim();
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("ASSISTANT_WEB_PORT must be a valid TCP port.");
  }
  return {
    envDir: repoRoot,
    plugins: [react(), logApiProxyTarget(apiTarget, devOrigin)],
    define: {
      "import.meta.env.VITE_BUILD_INFO": JSON.stringify(createBuildInfo()),
      "import.meta.env.VITE_ASSISTANT_APP_NAME": JSON.stringify(appName),
      ...(identityMode.length > 0
        ? { "import.meta.env.VITE_IDENTITY_MODE": JSON.stringify(identityMode) }
        : {}),
      ...(identityMode === "external"
        ? { "import.meta.env.VITE_IDENTITY_LOGIN_URL": JSON.stringify(identityLoginUrl) }
        : {}),
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "antd",
        "@ant-design/icons",
        "@ant-design/pro-components",
        "@ant-design/x",
      ],
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      proxy: { "/api": { target: apiTarget, changeOrigin: true } },
    },
    build: { target: "es2022", sourcemap: true },
  };
});
