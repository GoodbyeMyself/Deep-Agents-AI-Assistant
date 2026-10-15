import { describe, expect, it, vi } from "vitest";

import { AssistantController } from "./controller.js";

describe("AssistantController", () => {
  it("exposes stable state and applies context updates to subsequent reads", async () => {
    const controller = new AssistantController({
      getAccessCredential: () => "token",
      presentation: "floating",
      initialContext: { object: { type: "dataset", rawId: "orders" } },
    });
    const firstState = controller.getState();
    expect(controller.getState()).toBe(firstState);
    expect((await controller.getContext()).object?.rawId).toBe("orders");
    controller.updateContext({ object: { type: "dataset", rawId: "customers" } });
    expect(controller.getState()).not.toBe(firstState);
    expect((await controller.getContext()).object?.rawId).toBe("customers");
  });

  it("supports open, close and subscription without exposing credentials", () => {
    const listener = vi.fn();
    const controller = new AssistantController({ getAccessCredential: () => "secret" });
    const unsubscribe = controller.subscribe(listener);
    controller.open();
    expect(controller.getState()).toEqual({ mounted: false, open: true, presentation: "floating" });
    controller.close();
    unsubscribe();
    controller.open();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(controller.getState())).not.toContain("secret");
  });
});
