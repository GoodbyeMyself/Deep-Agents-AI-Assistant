// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { ASSISTANT_CONTEXT_EVENT, mountIframeAssistant } from "./host-loader.js";

describe("declarative iframe assistant host", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("owns the fixed launcher and panel outside the business application", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ticket: "a".repeat(32) }), {
            status: 201,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );
    const assistant = mountIframeAssistant({
      iframeUrl: "https://assistant.example/widget",
      ticketEndpoint: "/api/v1/embed/tickets",
      initialContext: {
        page: { type: "asset-detail", route: "/assets/orders" },
        object: { type: "data_table", rawId: "orders", name: "Orders" },
      },
    });

    const host = document.querySelector("enterprise-assistant-host");
    const launcher = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      ".assistant-loader-launcher",
    );
    const panel = host?.shadowRoot?.querySelector<HTMLElement>(".floating-assistant-panel");
    const iframe = host?.shadowRoot?.querySelector<HTMLIFrameElement>("iframe");
    expect(launcher?.getAttribute("aria-label")).toBe("打开智能助手");
    expect(panel?.classList.contains("is-open")).toBe(false);
    expect(iframe?.src).toContain("hostOrigin=http%3A%2F%2Flocalhost%3A3000");
    expect(iframe?.src).toContain("channelId=");

    launcher?.click();
    expect(panel?.classList.contains("is-open")).toBe(true);
    expect(assistant.getState().open).toBe(true);

    window.dispatchEvent(
      new CustomEvent(ASSISTANT_CONTEXT_EVENT, {
        detail: {
          page: { type: "asset-detail", route: "/assets/customers" },
          object: { type: "data_table", rawId: "customers", name: "Customers" },
        },
      }),
    );
    host?.shadowRoot?.querySelector<HTMLButtonElement>(".assistant-loader-close")?.click();
    expect(assistant.getState().open).toBe(false);

    assistant.destroy();
    expect(document.querySelector("enterprise-assistant-host")).toBeNull();
  });
});
