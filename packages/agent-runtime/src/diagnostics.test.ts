import { describe, expect, it } from "vitest";

import { sanitizeDiagnostic } from "./diagnostics.js";

describe("sanitizeDiagnostic", () => {
  it("redacts credentials recursively before diagnostics are persisted", () => {
    const sanitized = sanitizeDiagnostic({
      model: "test-model",
      apiKey: "must-not-leak",
      nested: { authorization: "Bearer must-not-leak", safe: "visible" },
    });

    expect(JSON.stringify(sanitized)).not.toContain("must-not-leak");
    expect(sanitized).toEqual({
      model: "test-model",
      apiKey: "[REDACTED]",
      nested: { authorization: "[REDACTED]", safe: "visible" },
    });
  });
});
