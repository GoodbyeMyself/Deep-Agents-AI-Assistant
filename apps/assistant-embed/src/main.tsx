import "antd/dist/reset.css";
import "../../../packages/assistant-ui/src/styles.css";
import "@assistant/assistant-sdk/styles.css";
import "./styles.css";

import {
  AssistantReact,
  useAssistant,
  type AssistantSdkOptions,
} from "@assistant/assistant-sdk";
import { AssistantApiTransport } from "@assistant/assistant-transport";
import type { RawHostContext } from "@assistant/context";
import { createIframeAssistantBridge } from "@assistant/iframe-bridge";
import { Alert, Spin } from "antd";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const BOOTSTRAP_TIMEOUT_MS = 15_000;

console.log("[assistant-embed] 构建信息", import.meta.env["VITE_BUILD_INFO"]);

function EmbedContextSync({ context }: { context: RawHostContext }) {
  const { controller } = useAssistant();
  useEffect(() => {
    controller.updateContext(context);
  }, [controller, context]);
  return null;
}

function EmbedApp() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const assistantTitle = params.get("assistantTitle")?.trim().slice(0, 80) || "业务智能助手";
  const hostOrigin = params.get("hostOrigin") ?? "";
  const channelId = params.get("channelId") ?? "";
  const [credential, setCredential] = useState<string>();
  const [context, setContext] = useState<RawHostContext>({});
  const [error, setError] = useState<string>();
  const bridgeRef = useRef<ReturnType<typeof createIframeAssistantBridge> | undefined>(undefined);
  const credentialRef = useRef<string | undefined>(undefined);
  const bootstrapResolveRef = useRef<(() => void) | undefined>(undefined);
  const bootstrapRejectRef = useRef<((reason?: unknown) => void) | undefined>(undefined);

  credentialRef.current = credential;

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
        credentialRef.current = result.accessCredential;
        setCredential(result.accessCredential);
        bootstrapResolveRef.current?.();
        bootstrapResolveRef.current = undefined;
        bootstrapRejectRef.current = undefined;
      },
      onContext: setContext,
      onError: () => setError("嵌入式助手初始化失败。"),
    });
    bridgeRef.current = bridge;
    bridge.start();
    return () => {
      bridge.destroy();
      bridgeRef.current = undefined;
      bootstrapRejectRef.current?.(new Error("Assistant bridge was destroyed."));
      bootstrapResolveRef.current = undefined;
      bootstrapRejectRef.current = undefined;
    };
  }, [channelId, hostOrigin]);

  const requestCredentialRefresh = async () => {
    await new Promise<void>((resolve, reject) => {
      if (bridgeRef.current === undefined) {
        reject(new Error("Assistant bridge is not ready."));
        return;
      }
      bootstrapResolveRef.current = resolve;
      bootstrapRejectRef.current = reject;
      bridgeRef.current.requestBootstrap();
      window.setTimeout(() => {
        if (bootstrapResolveRef.current !== resolve) return;
        bootstrapResolveRef.current = undefined;
        bootstrapRejectRef.current = undefined;
        reject(new Error("Embed credential refresh timed out."));
      }, BOOTSTRAP_TIMEOUT_MS);
    });
  };

  const onHostAction: NonNullable<AssistantSdkOptions["onHostAction"]> = (action) => {
    bridgeRef.current?.requestHostAction(action);
  };

  if (error !== undefined) return <Alert type="error" showIcon title={error} />;
  if (credential === undefined) return <Spin fullscreen description="正在建立安全会话" />;
  return (
    <div className="assistant-sdk-root assistant-embed-page">
      <AssistantReact
        key={credential}
        options={{
          presentation: "inline",
          getAccessCredential: () => {
            const token = credentialRef.current;
            if (token === undefined) throw new Error("Embed access credential is not ready.");
            return token;
          },
          onUnauthenticated: requestCredentialRefresh,
          initialContext: context,
          title: assistantTitle,
          layout: "panel",
          onHostAction,
        }}
      >
        <EmbedContextSync context={context} />
      </AssistantReact>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EmbedApp />
  </StrictMode>,
);
