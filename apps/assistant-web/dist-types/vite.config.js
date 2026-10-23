import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
function logApiProxyTarget(apiTarget) {
    return {
        name: "assistant-web-log-api-proxy",
        configureServer() {
            console.log(`[assistant-web] /api 代理 → ${apiTarget}`);
            console.log("[assistant-web] 真实 DeepSeek 演示请使用 pnpm demo（3410）；离线假模型请设 ASSISTANT_API_TARGET=http://127.0.0.1:3000 并运行 demo-server serve:web-offline。");
        },
    };
}
export default defineConfig(() => {
    const apiTarget = process.env["ASSISTANT_API_TARGET"] ?? "http://127.0.0.1:3000";
    const port = Number(process.env["ASSISTANT_WEB_PORT"] ?? "5173");
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("ASSISTANT_WEB_PORT must be a valid TCP port.");
    }
    return {
        plugins: [react(), logApiProxyTarget(apiTarget)],
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
//# sourceMappingURL=vite.config.js.map