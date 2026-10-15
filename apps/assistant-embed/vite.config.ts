import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5315,
    strictPort: true,
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors http://127.0.0.1:5314",
    },
    proxy: { "/api": { target: "http://127.0.0.1:3310", changeOrigin: false } },
  },
  build: { target: "es2022", sourcemap: true },
});
