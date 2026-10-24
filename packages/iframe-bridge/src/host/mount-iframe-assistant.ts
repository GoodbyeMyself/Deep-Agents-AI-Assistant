import { createAssistantBrandIcon } from "./brand-icon.js";
/**
 * 业务宿主一键挂载：Shadow DOM 浮层、embed 票据请求，并委托 `createIframeHostBridge` 完成握手。
 */
import { rawHostContextSchema, type RawHostContext } from "@assistant/context";

import { createIframeHostBridge } from "../bridge/host-bridge.js";
import { ASSISTANT_CONTEXT_EVENT, ASSISTANT_HOST_ACTION_EVENT } from "./constants.js";
import { canonicalOrigin, createEmbedTicket } from "./embed-ticket.js";
import { loaderStylesheet } from "./loader-styles.js";
import { attachPanelWidthResize } from "./panel-resize.js";
import type { IframeAssistantHost, IframeAssistantHostOptions } from "./types.js";

/**
 * 在 `document.body` 挂载浮层助手：生成 `channelId`、sandbox iframe，并绑定桥接与 Context 事件。
 */
export function mountIframeAssistant(options: IframeAssistantHostOptions): IframeAssistantHost {
  const iframeUrl = new URL(options.iframeUrl, location.href);
  const targetOrigin = canonicalOrigin(iframeUrl.href);
  const standaloneUrl = options.standaloneUrl === undefined ? undefined : new URL(options.standaloneUrl, location.href);
  if (standaloneUrl !== undefined && (!/^https?:$/.test(standaloneUrl.protocol) || standaloneUrl.username || standaloneUrl.password))
    throw new Error("The independent assistant page must use an HTTP(S) URL without credentials.");
  const channelId = crypto.randomUUID();
  const assistantTitle = options.title?.trim().slice(0, 80) || "企业业务智能助手";
  let context = rawHostContextSchema.parse(options.initialContext ?? {});
  let open = false;
  let ready = false;

  const host = document.createElement("enterprise-assistant-host");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = loaderStylesheet(
    options.accent ?? "#58d8b1",
    options.zIndex ?? 2_147_483_000,
  );

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "assistant-loader-launcher";
  launcher.setAttribute("aria-label", "打开智能助手");
  launcher.setAttribute("aria-expanded", "false");
  const mark = document.createElement("span");
  mark.className = "assistant-loader-mark";
  mark.setAttribute("aria-hidden", "true");
  const icon = createAssistantBrandIcon();
  mark.append(icon);
  launcher.title = "打开智能助手";
  launcher.append(mark);

  const panel = document.createElement("section");
  panel.className = "floating-assistant-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", assistantTitle);
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
  iframeUrl.searchParams.set("assistantTitle", assistantTitle);
  const iframe = document.createElement("iframe");
  iframe.className = "assistant-loader-frame";
  iframe.title = assistantTitle;
  iframe.src = iframeUrl.href;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  const resizeHandle = document.createElement("button");
  resizeHandle.type = "button";
  resizeHandle.className = "assistant-panel-resize-handle";
  resizeHandle.setAttribute("aria-label", "拖拽调整助手宽度");
  panel.append(resizeHandle, closeButton, status, iframe);
  if (standaloneUrl !== undefined) {
    const standaloneButton = document.createElement("a");
    standaloneButton.className = "assistant-loader-standalone";
    standaloneButton.href = standaloneUrl.href;
    standaloneButton.target = "_blank";
    standaloneButton.rel = "noopener noreferrer";
    standaloneButton.setAttribute("aria-label", "打开独立助手（新标签页）");
    standaloneButton.title = "打开独立助手";
    const externalIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    externalIcon.setAttribute("fill", "none");
    externalIcon.setAttribute("stroke", "currentColor");
    externalIcon.setAttribute("stroke-width", "1.8");
    externalIcon.setAttribute("stroke-linecap", "round");
    externalIcon.setAttribute("stroke-linejoin", "round");
    externalIcon.setAttribute("viewBox", "0 0 24 24");
    const externalPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    externalPath.setAttribute("d", "M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5");
    externalIcon.setAttribute("aria-hidden", "true");
    externalIcon.append(externalPath);
    standaloneButton.append(externalIcon);
    panel.append(standaloneButton);
  }
  shadow.append(style, launcher, panel);
  document.body.append(host);

  const detachPanelResize = attachPanelWidthResize(panel, resizeHandle);

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
    onHostAction: (action) => {
      options.onHostAction?.(action);
      window.dispatchEvent(new CustomEvent(ASSISTANT_HOST_ACTION_EVENT, { detail: action }));
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
      detachPanelResize();
      bridge.destroy();
      window.removeEventListener(ASSISTANT_CONTEXT_EVENT, contextListener);
      host.remove();
    },
    getState: () => ({ open, ready }),
  };
}
