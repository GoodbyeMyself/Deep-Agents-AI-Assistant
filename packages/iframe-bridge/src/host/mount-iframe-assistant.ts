/**
 * 业务宿主一键挂载：Shadow DOM 浮层、embed 票据请求，并委托 `createIframeHostBridge` 完成握手。
 */
import { rawHostContextSchema, type RawHostContext } from "@assistant/context";

import { createIframeHostBridge } from "../bridge/host-bridge.js";
import { ASSISTANT_CONTEXT_EVENT } from "./constants.js";
import { canonicalOrigin, createEmbedTicket } from "./embed-ticket.js";
import { loaderStylesheet } from "./loader-styles.js";
import type { IframeAssistantHost, IframeAssistantHostOptions } from "./types.js";

/**
 * 在 `document.body` 挂载浮层助手：生成 `channelId`、sandbox iframe，并绑定桥接与 Context 事件。
 */
export function mountIframeAssistant(options: IframeAssistantHostOptions): IframeAssistantHost {
  const iframeUrl = new URL(options.iframeUrl, location.href);
  const targetOrigin = canonicalOrigin(iframeUrl.href);
  const channelId = crypto.randomUUID();
  let context = rawHostContextSchema.parse(options.initialContext ?? {});
  let open = false;
  let ready = false;

  const host = document.createElement("enterprise-assistant-host");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = loaderStylesheet(options.accent ?? "#58d8b1", options.zIndex ?? 2_147_483_000);

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "assistant-loader-launcher";
  launcher.setAttribute("aria-label", "打开智能助手");
  launcher.setAttribute("aria-expanded", "false");
  const mark = document.createElement("span");
  mark.className = "assistant-loader-mark";
  mark.textContent = "AI";
  mark.setAttribute("aria-hidden", "true");
  const launcherLabel = document.createElement("strong");
  launcherLabel.textContent = "业务助手";
  launcher.append(mark, launcherLabel);

  const panel = document.createElement("section");
  panel.className = "floating-assistant-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", options.title ?? "企业业务智能助手");
  panel.setAttribute("aria-hidden", "true");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "assistant-loader-close";
  closeButton.setAttribute("aria-label", "关闭智能助手");
  closeButton.textContent = "×";

  const status = document.createElement("div");
  status.className = "assistant-loader-status";
  status.setAttribute("role", "status");
  status.textContent = "正在建立安全通道…";

  iframeUrl.searchParams.set("hostOrigin", location.origin);
  iframeUrl.searchParams.set("channelId", channelId);
  const iframe = document.createElement("iframe");
  iframe.className = "assistant-loader-frame";
  iframe.title = "企业业务智能助手";
  iframe.src = iframeUrl.href;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  panel.append(closeButton, status, iframe);
  shadow.append(style, launcher, panel);
  document.body.append(host);

  const setOpen = (next: boolean) => {
    open = next;
    panel.classList.toggle("is-open", next);
    panel.setAttribute("aria-hidden", String(!next));
    launcher.hidden = next;
    launcher.setAttribute("aria-expanded", String(next));
  };

  const bridge = createIframeHostBridge({
    iframe,
    targetOrigin,
    channelId,
    getTicket: () => createEmbedTicket(options, targetOrigin),
    getContext: () => context,
    onReady: () => {
      ready = true;
      status.hidden = true;
    },
    onError: () => {
      status.hidden = false;
      status.classList.add("is-error");
      status.textContent = "助手连接失败，请刷新后重试。";
    },
  });
  bridge.start();

  const updateContext = (next: RawHostContext) => {
    context = rawHostContextSchema.parse(next);
    bridge.updateContext(context);
  };
  const contextListener = (event: Event) => {
    if (event instanceof CustomEvent) updateContext(event.detail as RawHostContext);
  };
  window.addEventListener(ASSISTANT_CONTEXT_EVENT, contextListener);
  launcher.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    updateContext,
    destroy() {
      bridge.destroy();
      window.removeEventListener(ASSISTANT_CONTEXT_EVENT, contextListener);
      host.remove();
    },
    getState: () => ({ open, ready }),
  };
}
