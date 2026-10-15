import { createRoot, type Root } from "react-dom/client";

import { AssistantController, type AssistantSdkOptions } from "./controller.js";
import { AssistantProvider, AssistantReact, AssistantSurface, useAssistant } from "./react.js";

export * from "./controller.js";
export { AssistantProvider, AssistantReact, AssistantSurface, useAssistant };

export interface AssistantInstance {
  mount(): void;
  open(): void;
  close(): void;
  updateContext: AssistantController["updateContext"];
  getState: AssistantController["getState"];
  destroy(): void;
}

export function createAssistant(options: AssistantSdkOptions): AssistantInstance {
  const controller = new AssistantController(options);
  let root: Root | undefined;
  let ownedContainer: HTMLElement | undefined;

  const resolveContainer = (): HTMLElement => {
    if (options.container instanceof HTMLElement) return options.container;
    if (typeof options.container === "string") {
      const match = document.querySelector<HTMLElement>(options.container);
      if (match === null) throw new Error(`Assistant container not found: ${options.container}`);
      return match;
    }
    ownedContainer = document.createElement("div");
    ownedContainer.className = "assistant-sdk-root";
    document.body.append(ownedContainer);
    return ownedContainer;
  };

  return {
    mount() {
      if (root !== undefined) return;
      const container = resolveContainer();
      container.classList.add("assistant-sdk-root");
      root = createRoot(container);
      root.render(
        <AssistantProvider controller={controller}>
          <AssistantSurface />
        </AssistantProvider>,
      );
    },
    open: () => controller.open(),
    close: () => controller.close(),
    updateContext: (context) => controller.updateContext(context),
    getState: () => controller.getState(),
    destroy() {
      root?.unmount();
      root = undefined;
      ownedContainer?.remove();
      ownedContainer = undefined;
    },
  };
}
