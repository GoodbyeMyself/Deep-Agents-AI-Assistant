/** 宿主页面通过 `CustomEvent` 推送 Context 更新时使用的窗口事件名。 */
export const ASSISTANT_CONTEXT_EVENT = "enterprise-assistant:context";

/** 助手请求宿主执行经 allowlist 校验动作时派发；事件本身不授予导航权限。 */
export const ASSISTANT_HOST_ACTION_EVENT = "enterprise-assistant:host-action";
