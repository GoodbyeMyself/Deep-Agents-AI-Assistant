// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SafeContent } from "./SafeContent.js";

describe("SafeContent", () => {
  it("renders untrusted markup as text", () => {
    const { container } = render(<SafeContent content={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/onerror/)).toBeTruthy();
  });

  it("renders model output as markdown", () => {
    const { container } = render(
      <SafeContent content={"## 质量分析\n\n- **完整率**：98%\n- 异常记录：2"} />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "质量分析" })).toBeTruthy();
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("完整率").tagName).toBe("STRONG");
  });
});
