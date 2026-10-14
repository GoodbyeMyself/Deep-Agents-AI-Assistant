// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssistantViewRenderer } from "./AssistantViewRenderer.js";

describe("AssistantViewRenderer", () => {
  it("refuses an unknown renderer payload", () => {
    render(<AssistantViewRenderer value={{ viewType: "unsafe.html", data: "<script />" }} />);
    expect(screen.getByText("此结构化结果无法安全显示")).toBeTruthy();
  });

  it("renders an accessible chart with a data fallback", () => {
    render(
      <AssistantViewRenderer
        value={{
          viewId: "cecd1e52-8a33-4dd7-875e-b81a5d184c4c",
          viewType: "chart.line",
          schemaVersion: "1",
          title: "质量趋势",
          data: { xField: "time", yField: "value", rows: [{ time: "2026-10-14", value: 96 }] },
          evidenceIds: ["ref-1"],
        }}
      />,
    );
    expect(screen.getByRole("img", { name: /质量趋势/ })).toBeTruthy();
    expect(screen.getByText("查看图表数据")).toBeTruthy();
  });
});
