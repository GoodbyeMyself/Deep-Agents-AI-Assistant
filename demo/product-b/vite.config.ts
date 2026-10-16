import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5412,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3412", changeOrigin: true } },
  },
  build: { target: "es2022", sourcemap: true },
});
