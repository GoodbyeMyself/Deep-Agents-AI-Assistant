import { describe, expect, it } from "vitest";

import { rawHostContextSchema } from "./index.js";

describe("raw host context", () => {
  it("keeps only the untrusted host allowlist and drops forged identity fields", () => {
    const parsed = rawHostContextSchema.parse({
      page: { type: "table-detail" },
      object: { type: "data_table", rawId: "orders" },
      user: { id: "forged" },
      permissions: { scopes: ["admin"] },
    });
    expect(parsed).not.toHaveProperty("user");
    expect(parsed).not.toHaveProperty("permissions");
  });
});
