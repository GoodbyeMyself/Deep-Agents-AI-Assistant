// @vitest-environment jsdom
import type { AssistantApiTransport } from "@assistant/assistant-transport";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import { ExecutionTimeline } from "./ExecutionTimeline.js";
import { MessageList } from "./MessageList.js";

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [];
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    value: TestIntersectionObserver,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: TestResizeObserver,
  });
});

describe("ExecutionTimeline", () => {
  it("shows an expanded public execution chain while running", () => {
    render(
      <ExecutionTimeline
        status="loading"
        steps={[
          { key: "run", title: "正在分析请求", status: "loading" },
          { key: "tool:1", title: "查询数据质量趋势", status: "success" },
        ]}
      />,
    );

    expect(screen.getByText("正在执行")).toBeTruthy();
    expect(screen.getByText("查询数据质量趋势")).toBeTruthy();
    expect(screen.getByText(/不展示模型私有推理/)).toBeTruthy();
  });

  it("summarizes a completed execution", () => {
    render(
      <ExecutionTimeline
        status="success"
        steps={[
          { key: "run", title: "分析完成", status: "success" },
          { key: "tool:1", title: "搜索业务数据对象", status: "success" },
        ]}
      />,
    );

    expect(screen.getByText("执行完成 · 2 个步骤")).toBeTruthy();
  });

  it("fully removes and restores details when toggled", async () => {
    const user = userEvent.setup();
    const view = render(
      <ExecutionTimeline
        status="success"
        steps={[
          {
            key: "tool:1",
            title: "查询数据质量趋势",
            detail: "业务能力 · data_quality_get_trend",
            status: "success",
          },
        ]}
      />,
    );

    const toggle = view.getByRole("button", { name: "执行完成 · 1 个步骤" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("业务能力 · data_quality_get_trend")).toBeNull();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("业务能力 · data_quality_get_trend")).toBeTruthy();

    await user.click(toggle);
    expect(screen.queryByText("业务能力 · data_quality_get_trend")).toBeNull();
  });

  it("renders the chain inside its assistant message", () => {
    const { container } = render(
      <MessageList
        transport={{} as AssistantApiTransport}
        messages={[
          {
            id: "assistant-message",
            role: "assistant",
            content: "这是最终回答。",
            status: "loading",
            executionSteps: [{ key: "run", title: "正在分析请求", status: "loading" }],
            evidenceIds: [],
            views: [],
          },
        ]}
      />,
    );

    const execution = container.querySelector<HTMLElement>('[aria-label="执行过程"]');
    expect(execution).toBeTruthy();
    expect(execution?.closest(".assistant-message-content")).toBeTruthy();
  });
});
