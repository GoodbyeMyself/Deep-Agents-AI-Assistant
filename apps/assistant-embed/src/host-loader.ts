import {
  mountIframeAssistant,
  type IframeAssistantHost,
  type IframeAssistantHostOptions,
} from "@assistant/iframe-bridge";
import { rawHostContextSchema } from "@assistant/context";

// Entry-script integrations can explicitly remount after an SPA login/logout.
// Declarative HTML integrations below continue to bootstrap automatically.
export { mountIframeAssistant };

console.log("[assistant-loader] 构建信息", import.meta.env["VITE_BUILD_INFO"]);

declare global {
  interface Window {
    enterpriseAssistant?: IframeAssistantHost;
  }
}

function required(element: HTMLScriptElement, name: string): string {
  const value = element.dataset[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing declarative assistant setting: data-${name}.`);
  }
  return value;
}

function initialContext(elementId: string | undefined) {
  if (elementId === undefined) return {};
  const source = document.getElementById(elementId);
  if (source === null) throw new Error("Assistant context element was not found.");
  return rawHostContextSchema.parse(JSON.parse(source.textContent ?? "{}") as unknown);
}

function optionsFrom(element: HTMLScriptElement): IframeAssistantHostOptions {
  const demoToken = element.dataset["demoAccessToken"]?.trim() || undefined;
  const configuredStandaloneUrl: unknown = import.meta.env["VITE_ASSISTANT_WEB_URL"];
  const standaloneUrl = element.dataset["standaloneUrl"]?.trim()
    || (typeof configuredStandaloneUrl === "string" ? configuredStandaloneUrl.trim() : undefined);
  if (demoToken !== undefined && !["127.0.0.1", "localhost"].includes(location.hostname)) {
    throw new Error("Demo access tokens are restricted to localhost.");
  }
  return {
    iframeUrl: required(element, "iframeUrl"),
    ...(standaloneUrl ? { standaloneUrl } : {}),
    ticketEndpoint: element.dataset["ticketEndpoint"]?.trim() || "/api/v1/embed/tickets",
    initialContext: initialContext(element.dataset["contextElement"]),
    ...(demoToken === undefined ? {} : { accessToken: demoToken }),
    ...(element.dataset["assistantTitle"] === undefined
      ? {}
      : { title: element.dataset["assistantTitle"] }),
    ...(element.dataset["accent"] === undefined ? {} : { accent: element.dataset["accent"] }),
  };
}

function bootstrap(): void {
  if (window.enterpriseAssistant !== undefined) return;
  const script = document.querySelector<HTMLScriptElement>("script[data-enterprise-assistant]");
  if (script === null) return;
  try {
    window.enterpriseAssistant = mountIframeAssistant(optionsFrom(script));
  } catch {
    console.error("Enterprise assistant bootstrap failed.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
