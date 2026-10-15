import type { VerifiedPrincipal } from "@assistant/context";
import { describe, expect, it } from "vitest";

import { EmbedTicketService } from "./embed-ticket.js";
import { MockIdentityProvider } from "./identity.js";

const principal: VerifiedPrincipal = {
  id: "user-a",
  displayName: "User A",
  tenantId: "tenant-a",
  permissionScopes: ["data_quality:read"],
  authorizedObjectIds: ["orders"],
  authorizationRef: "test-auth",
};

describe("EmbedTicketService", () => {
  it("exchanges a ticket once and binds it to the exact origin", async () => {
    const identity = new MockIdentityProvider();
    const service = new EmbedTicketService(identity);
    const issued = service.create(principal, "https://assistant.example");
    expect(() => service.exchange(issued.ticket, "https://evil.example")).toThrow(
      "origin mismatch",
    );
    expect(() => service.exchange(issued.ticket, "https://assistant.example")).toThrow(
      "invalid or expired",
    );

    const second = service.create(principal, "https://assistant.example");
    const exchanged = service.exchange(second.ticket, "https://assistant.example");
    await expect(
      identity.authenticate(`Bearer ${exchanged.accessCredential}`),
    ).resolves.toMatchObject({
      id: "user-a",
    });
    expect(() => service.exchange(second.ticket, "https://assistant.example")).toThrow(
      "invalid or expired",
    );
  });

  it("allows HTTP only for local development origins", () => {
    const service = new EmbedTicketService(new MockIdentityProvider());
    expect(() => service.create(principal, "http://product.example")).toThrow("canonical HTTP(S)");
    expect(service.create(principal, "http://127.0.0.1:5315").ticket).toHaveLength(43);
  });
});
