/**
 * API 路径索引（非完整 operation/schema 定义）。
 *
 * 用于契约测试与文档生成器的「面清单」；request/response 细节以本包 Zod schema 与
 * apps/agent-server 路由实现为准。
 */
export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Enterprise AI Assistant API", version: "1.0.0-m3" },
  paths: {
    "/api/v1/ag-ui": { post: { summary: "Run an agent using AG-UI 1.0 input and SSE events" } },
    "/api/v1/context/snapshots": { post: { summary: "Create an authorized context snapshot" } },
    "/api/v1/sessions": {
      get: { summary: "List owned sessions" },
      post: { summary: "Create session" },
    },
    "/api/v1/sessions/{id}": { get: {}, patch: {}, delete: {} },
    "/api/v1/sessions/{id}/messages": { get: {} },
    "/api/v1/sessions/{id}/runs": { post: { summary: "Create an idempotent run" } },
    "/api/v1/runs/{id}": { get: {} },
    "/api/v1/runs/{id}/events": { get: { summary: "Read or replay SSE events" } },
    "/api/v1/runs/{id}/ag-ui/events": {
      get: { summary: "Read or replay the AG-UI 1.0 event projection" },
    },
    "/api/v1/runs/{id}/cancel": { post: {} },
    "/api/v1/runs/{id}/resume": {
      post: { summary: "Resolve an AG-UI interrupt and continue the governed run" },
    },
    "/api/v1/evidence/{referenceId}": { get: { summary: "Resolve evidence after authorization" } },
    "/api/v1/models": { get: { summary: "List safe model metadata for this deployment" } },
    "/api/v1/identity": { get: { summary: "Return the authenticated display identity and platform admin flag without credentials" } },
    "/api/v1/mcp/servers": { get: { summary: "List configured MCP server status" } },
    "/api/v1/mcp/tools": { get: { summary: "List approved MCP tools" } },
    "/api/v1/platform/extensions": {
      get: { summary: "List approved Platform Extensions for administrators" },
    },
  },
} as const;
