import "antd/dist/reset.css";
import "../../../packages/assistant-ui/src/styles.css";
import "@assistant/assistant-sdk/styles.css";
import "./styles.css";

import {
  AssistantController,
  AssistantProvider,
  AssistantSurface,
  createAssistant,
  type AssistantInstance,
} from "@assistant/assistant-sdk";
import { AssistantApiTransport } from "@assistant/assistant-transport";
import type { RawHostContext } from "@assistant/context";
import { createIframeHostBridge } from "@assistant/iframe-bridge";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type Mode = "react" | "vanilla" | "iframe";
const token = "mock-token-admin";
const contexts: Record<"orders" | "customers", RawHostContext> = {
  orders: {
    page: { route: "/quality/orders", title: "订单质量", type: "detail" },
    object: { type: "dataset", rawId: "orders", name: "订单数据集" },
    business: { domain: "data-governance", module: "quality" },
  },
  customers: {
    page: { route: "/quality/customers", title: "客户质量", type: "detail" },
    object: { type: "dataset", rawId: "customers", name: "客户数据集" },
    business: { domain: "data-governance", module: "quality" },
  },
};

function App() {
  const [mode, setMode] = useState<Mode>("react");
  const [objectId, setObjectId] = useState<"orders" | "customers">("orders");
  const current = contexts[objectId];
  const reactController = useMemo(
    () =>
      new AssistantController({
        presentation: "inline",
        getAccessCredential: () => token,
        initialContext: current,
      }),
    [],
  );
  const vanillaRoot = useRef<HTMLDivElement>(null);
  const vanillaInstance = useRef<AssistantInstance | undefined>(undefined);
  const iframe = useRef<HTMLIFrameElement>(null);
  const iframeBridge = useRef<ReturnType<typeof createIframeHostBridge> | undefined>(undefined);
  const channelId = useMemo(() => crypto.randomUUID(), []);
  const hostTransport = useMemo(
    () => new AssistantApiTransport({ getAccessCredential: () => token }),
    [],
  );

  useEffect(() => {
    reactController.updateContext(current);
    vanillaInstance.current?.updateContext(current);
    iframeBridge.current?.updateContext(current);
  }, [current, reactController]);

  useEffect(() => {
    if (mode !== "vanilla" || vanillaRoot.current === null) return;
    const instance = createAssistant({
      container: vanillaRoot.current,
      presentation: "inline",
      getAccessCredential: () => token,
      initialContext: current,
    });
    vanillaInstance.current = instance;
    instance.mount();
    return () => {
      instance.destroy();
      vanillaInstance.current = undefined;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "iframe" || iframe.current === null) return;
    const bridge = createIframeHostBridge({
      iframe: iframe.current,
      targetOrigin: "http://127.0.0.1:5315",
      channelId,
      getTicket: async () =>
        (await hostTransport.createEmbedTicket("http://127.0.0.1:5315")).ticket,
      getContext: () => current,
    });
    iframeBridge.current = bridge;
    bridge.start();
    return () => {
      bridge.destroy();
      iframeBridge.current = undefined;
    };
  }, [channelId, hostTransport, mode]);

  return (
    <div className="demo-shell">
      <header>
        <div>
          <span>M4 INTEGRATION LAB</span>
          <h1>同一助手，三种宿主</h1>
          <p>React、原生 JavaScript 与跨域 iframe 共用 Chat Core 与 Agent Server。</p>
        </div>
      </header>
      <nav aria-label="集成方式">
        {(["react", "vanilla", "iframe"] as const).map((item) => (
          <button
            key={item}
            className={mode === item ? "active" : ""}
            onClick={() => setMode(item)}
          >
            {item === "react" ? "React SDK" : item === "vanilla" ? "JavaScript SDK" : "跨域 iframe"}
          </button>
        ))}
      </nav>
      <section className="context-bar" aria-label="宿主页面上下文">
        <strong>模拟业务页面：</strong>
        <button
          className={objectId === "orders" ? "active" : ""}
          onClick={() => setObjectId("orders")}
        >
          订单数据集
        </button>
        <button
          className={objectId === "customers" ? "active" : ""}
          onClick={() => setObjectId("customers")}
        >
          客户数据集
        </button>
        <code>{current.page?.route}</code>
      </section>
      <main>
        {mode === "react" && (
          <div className="assistant-sdk-root">
            <AssistantProvider controller={reactController}>
              <AssistantSurface />
            </AssistantProvider>
          </div>
        )}
        {mode === "vanilla" && <div ref={vanillaRoot} />}
        {mode === "iframe" && (
          <iframe
            ref={iframe}
            title="跨域企业智能助手"
            sandbox="allow-scripts allow-same-origin"
            src={`http://127.0.0.1:5315/?hostOrigin=${encodeURIComponent(location.origin)}&channelId=${channelId}`}
          />
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
