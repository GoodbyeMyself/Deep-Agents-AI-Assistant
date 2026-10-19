import "antd/dist/reset.css";
import "../../../packages/assistant-ui/src/styles.css";
import "@assistant/assistant-sdk/styles.css";
import "./styles.css";

import { AssistantController, AssistantProvider, AssistantSurface } from "@assistant/assistant-sdk";
import type { RawHostContext } from "@assistant/context";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";

const context: RawHostContext = {
  page: { route: "/quality/orders", title: "订单质量", type: "detail" },
  object: { type: "dataset", rawId: "orders", name: "订单数据集" },
  business: { domain: "data-governance", module: "quality" },
};

function App() {
  const controller = useMemo(
    () =>
      new AssistantController({
        presentation: "inline",
        layout: "panel",
        getAccessCredential: () => "mock-token-admin",
        initialContext: context,
      }),
    [],
  );

  return (
    <div className="assistant-sdk-root demo-shell">
      <AssistantProvider controller={controller}>
        <AssistantSurface />
      </AssistantProvider>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
