import { rawHostContextSchema, type RawHostContext } from "@assistant/context";

import { createIframeHostBridge } from "./index.js";

export const ASSISTANT_CONTEXT_EVENT = "enterprise-assistant:context";

export interface IframeAssistantHostOptions {
  readonly iframeUrl: string;
  readonly ticketEndpoint: string;
  readonly initialContext?: RawHostContext;
  readonly accessToken?: string;
  readonly title?: string;
  readonly accent?: string;
  readonly zIndex?: number;
}

export interface IframeAssistantHost {
  open(): void;
  close(): void;
  updateContext(context: RawHostContext): void;
  destroy(): void;
  getState(): { readonly open: boolean; readonly ready: boolean };
}

function canonicalOrigin(value: string): string {
  const url = new URL(value, location.href);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Assistant iframe must use HTTP(S).");
  return url.origin;
}

async function createTicket(options: IframeAssistantHostOptions, targetOrigin: string) {
  const response = await fetch(new URL(options.ticketEndpoint, location.href), {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(options.accessToken === undefined
        ? {}
        : { authorization: `Bearer ${options.accessToken}` }),
    },
    body: JSON.stringify({ targetOrigin }),
  });
  if (!response.ok) throw new Error("Assistant embed ticket request failed.");
  const payload = (await response.json()) as { ticket?: unknown };
  if (typeof payload.ticket !== "string") throw new Error("Assistant embed ticket is missing.");
  return payload.ticket;
}

function stylesheet(accent: string, zIndex: number): string {
  return `
    :host { display: contents; pointer-events: none; color-scheme: light; --assistant-accent: ${accent}; }
    *, *::before, *::after { box-sizing: border-box; }
    .assistant-loader-launcher {
      position: fixed; right: 24px; bottom: 22px; z-index: ${zIndex + 1};
      display: flex; align-items: center; gap: 10px; min-width: 150px; height: 54px;
      padding: 0 18px 0 9px; border: 1px solid color-mix(in srgb, var(--assistant-accent) 35%, white);
      border-radius: 18px; color: white; background: #12241f;
      box-shadow: 0 18px 42px rgb(5 30 24 / 28%); cursor: pointer;
      pointer-events: auto;
      font: 600 14px/1.2 "Microsoft YaHei", "PingFang SC", sans-serif;
      transition: transform 180ms ease, box-shadow 180ms ease, opacity 160ms ease;
    }
    .assistant-loader-launcher:hover { transform: translateY(-2px); box-shadow: 0 22px 48px rgb(5 30 24 / 34%); }
    .assistant-loader-launcher[hidden] { display: none; }
    .assistant-loader-mark {
      display: grid; place-items: center; width: 38px; height: 38px; border-radius: 13px;
      color: #10251f; background: var(--assistant-accent); font-size: 13px; font-weight: 900;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 48%);
    }
    .floating-assistant-panel {
      position: fixed; right: 24px; bottom: 22px; z-index: ${zIndex};
      width: min(448px, calc(100vw - 32px)); height: min(740px, calc(100vh - 44px));
      overflow: hidden; border: 1px solid rgb(20 87 70 / 18%); border-radius: 22px;
      background: #f8fbfa; box-shadow: 0 28px 80px rgb(6 31 25 / 30%);
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: translateY(18px) scale(.975); transform-origin: right bottom;
      transition: opacity 180ms ease, transform 220ms cubic-bezier(.2,.8,.2,1), visibility 180ms ease;
    }
    .floating-assistant-panel.is-open {
      opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0) scale(1);
    }
    .assistant-loader-frame { width: 100%; height: 100%; border: 0; background: #f8fbfa; }
    .assistant-loader-close {
      position: absolute; top: 13px; right: 13px; z-index: 3; display: grid; place-items: center;
      width: 34px; height: 34px; border: 1px solid rgb(20 87 70 / 14%); border-radius: 12px;
      color: #34554c; background: rgb(255 255 255 / 88%); backdrop-filter: blur(10px);
      cursor: pointer; font: 500 22px/1 sans-serif; transition: background 160ms ease, transform 160ms ease;
    }
    .assistant-loader-close:hover { background: white; transform: rotate(4deg); }
    .assistant-loader-status {
      position: absolute; inset: 0; z-index: 2; display: grid; place-items: center;
      color: #3b5c53; background: #f8fbfa; font: 600 14px/1.5 "Microsoft YaHei", sans-serif;
    }
    .assistant-loader-status[hidden] { display: none; }
    .assistant-loader-status.is-error { color: #a33b32; }
    @media (max-width: 640px) {
      .assistant-loader-launcher { right: 14px; bottom: 14px; min-width: 54px; padding-right: 9px; }
      .assistant-loader-launcher strong { display: none; }
      .floating-assistant-panel { right: 8px; bottom: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); border-radius: 18px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .assistant-loader-launcher, .floating-assistant-panel, .assistant-loader-close { transition: none; }
    }
  `;
}

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
  style.textContent = stylesheet(options.accent ?? "#58d8b1", options.zIndex ?? 2_147_483_000);

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
    getTicket: () => createTicket(options, targetOrigin),
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
