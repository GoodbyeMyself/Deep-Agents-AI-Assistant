import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    plugins: [react()],
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
        port: 5173,
        proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: true } },
    },
    build: { target: "es2022", sourcemap: true },
});
//# sourceMappingURL=vite.config.js.map