import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

function assistantLoaderAlias(): Plugin {
  return {
    name: "assistant-loader-dev-alias",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.startsWith("/assistant-loader.js") === true) {
          request.url = request.url.replace("/assistant-loader.js", "/src/host-loader.ts");
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  const port = Number(process.env["ASSISTANT_EMBED_PORT"] ?? "5315");
  const apiTarget = process.env["ASSISTANT_API_TARGET"] ?? "http://127.0.0.1:3310";
  const hostOrigin = process.env["ASSISTANT_HOST_ORIGIN"] ?? "http://127.0.0.1:5314";
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("ASSISTANT_EMBED_PORT must be a valid TCP port.");
  }
  return {
    plugins: [react(), assistantLoaderAlias()],
    server: {
      port,
      strictPort: true,
      headers: {
        "Content-Security-Policy": `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors ${hostOrigin}`,
      },
      proxy: { "/api": { target: apiTarget, changeOrigin: false } },
    },
    build: {
      target: "es2022",
      sourcemap: true,
      rolldownOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          "assistant-loader": fileURLToPath(new URL("./src/host-loader.ts", import.meta.url)),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === "assistant-loader" ? "assistant-loader.js" : "assets/[name]-[hash].js",
        },
      },
    },
  };
});
