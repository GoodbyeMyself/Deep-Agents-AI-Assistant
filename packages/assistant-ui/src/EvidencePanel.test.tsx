// @vitest-environment jsdom
import type { AssistantApiTransport } from "@assistant/assistant-transport";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EvidencePanel } from "./EvidencePanel.js";

afterEach(cleanup);

describe("EvidencePanel", () => {
  it.each(["FORBIDDEN", "NOT_FOUND"])(
    "uses the same safe state when evidence resolution returns %s",
    async () => {
      const transport = {
        resolveEvidence: vi.fn().mockRejectedValue(new Error("must not leak details")),
      } as unknown as AssistantApiTransport;
      render(<EvidencePanel referenceIds={["reference-1"]} transport={transport} />);
      fireEvent.click(screen.getByText("证据 1"));
      expect(await screen.findByText("证据不可用或当前身份无权访问。")).toBeTruthy();
    },
  );
});
