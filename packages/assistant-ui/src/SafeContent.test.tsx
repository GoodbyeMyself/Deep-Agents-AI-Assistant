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
});
