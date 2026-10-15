import "antd/dist/reset.css";
import "../../../packages/assistant-ui/src/styles.css";
import "@assistant/assistant-sdk/styles.css";

import { AssistantReact } from "@assistant/assistant-sdk";
import { AssistantApiTransport } from "@assistant/assistant-transport";
import type { RawHostContext } from "@assistant/context";
import { createIframeAssistantBridge } from "@assistant/iframe-bridge";
import { Alert, Spin } from "antd";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

function EmbedApp() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const hostOrigin = params.get("hostOrigin") ?? "";
  const channelId = params.get("channelId") ?? "";
  const [credential, setCredential] = useState<string>();
  const [context, setContext] = useState<RawHostContext>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (hostOrigin.length === 0 || channelId.length === 0) {
      setError("缺少可信宿主参数。");
      return;
    }
    const bootstrapTransport = new AssistantApiTransport({ getAccessCredential: () => "unused" });
    const bridge = createIframeAssistantBridge({
      hostWindow: window.parent,
      hostOrigin,
      channelId,
      onHello: async (ticket, initialContext) => {
        const result = await bootstrapTransport.exchangeEmbedTicket(ticket);
        setContext(initialContext);
        setCredential(result.accessCredential);
      },
      onContext: setContext,
      onError: () => setError("嵌入式助手初始化失败。"),
    });
    bridge.start();
    return () => bridge.destroy();
  }, [channelId, hostOrigin]);

  if (error !== undefined) return <Alert type="error" showIcon title={error} />;
  if (credential === undefined) return <Spin fullscreen tip="正在建立安全会话" />;
  return (
    <div className="assistant-sdk-root" style={{ minHeight: "100vh" }}>
      <AssistantReact
        options={{
          presentation: "inline",
          getAccessCredential: () => credential,
          initialContext: context,
        }}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EmbedApp />
  </StrictMode>,
);
