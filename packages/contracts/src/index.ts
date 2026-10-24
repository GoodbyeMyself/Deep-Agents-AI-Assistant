/**
 * 包入口：只做 re-export，不在此文件新增 schema 或运行时逻辑。
 *
 * 分层说明见 packages/contracts/README.md。消费方应始终 `import … from "@assistant/contracts"`，
 * 不要依赖 dist 子路径或 src 相对路径，以免内部目录调整破坏引用。
 */
export { assistantViewSchema, type AssistantView } from "./ui/views.js";
export {
  hostActionParametersSchema,
  hostNavigationActionSchema,
  type HostNavigationAction,
} from "./ui/host-actions.js";
export * from "./governance/interrupts.js";
export { apiErrorSchema } from "./http/errors.js";
export {
  createRunRequestSchema,
  createSessionRequestSchema,
  patchSessionRequestSchema,
} from "./http/sessions-runs.js";
export {
  assistantEventSchema,
  assistantEventTypeSchema,
  type AssistantEvent,
  type AssistantEventType,
} from "./sse/assistant-events.js";
export * from "./ag-ui/index.js";
export { openApiDocument } from "./http/openapi.js";
