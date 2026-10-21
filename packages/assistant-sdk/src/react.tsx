import { ChatWorkspace, resolveAssistantColorPrimary } from "@assistant/assistant-ui";
import { ConfigProvider } from "antd";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  AssistantController,
  type AssistantSdkOptions,
  type AssistantSdkState,
} from "./controller.js";

const ControllerContext = createContext<AssistantController | undefined>(undefined);

export function AssistantProvider({
  options,
  controller,
  children,
}: {
  options?: AssistantSdkOptions;
  controller?: AssistantController;
  children: ReactNode;
}) {
  const value = useMemo(
    () => controller ?? new AssistantController(options!),
    [controller, options],
  );
  return <ControllerContext.Provider value={value}>{children}</ControllerContext.Provider>;
}

export function useAssistant(): {
  state: AssistantSdkState;
  open: () => void;
  close: () => void;
  updateContext: AssistantController["updateContext"];
  controller: AssistantController;
} {
  const controller = useContext(ControllerContext);
  if (controller === undefined)
    throw new Error("useAssistant must be used inside AssistantProvider.");
  const state = useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.getState(),
    () => controller.getState(),
  );
  return {
    state,
    open: () => controller.open(),
    close: () => controller.close(),
    updateContext: (context) => controller.updateContext(context),
    controller,
  };
}

function AssistantSurfaceContent() {
  const { state, open, close, controller } = useAssistant();
  useEffect(() => {
    controller.markMounted(true);
    return () => controller.markMounted(false);
  }, [controller]);
  useEffect(() => {
    if (state.context === undefined)
      void controller.getContext().then((context) => controller.updateContext(context));
  }, [controller, state.context]);
  const selected = state.context?.object;
  const workspace = (
    <ChatWorkspace
      transport={controller.chatTransport}
      mode="assistant"
      getContext={() => controller.getContext()}
      {...(controller.options.layout === undefined ? {} : { layout: controller.options.layout })}
      {...(controller.options.title === undefined
        ? {}
        : { headingTitle: controller.options.title })}
      {...(selected?.rawId === undefined || selected.type === undefined
        ? {}
        : {
            selectedObject: {
              id: selected.rawId,
              type: selected.type,
              name: selected.name ?? selected.rawId,
            },
          })}
    />
  );
  if (state.presentation === "inline")
    return <div className="assistant-sdk-inline">{workspace}</div>;
  return (
    <>
      {state.presentation === "floating" && !state.open && (
        <button
          className="assistant-sdk-launcher"
          type="button"
          onClick={open}
          aria-label="打开智能助手"
        >
          <span aria-hidden="true">AI</span>
          <strong>业务助手</strong>
        </button>
      )}
      {state.open && (
        <div
          className={`assistant-sdk-panel assistant-sdk-panel--${state.presentation}`}
          role="dialog"
          aria-modal="false"
          aria-label={controller.options.title ?? "企业智能助手"}
        >
          <button
            className="assistant-sdk-close"
            type="button"
            onClick={close}
            aria-label="关闭智能助手"
          >
            ×
          </button>
          {workspace}
        </div>
      )}
    </>
  );
}

function AssistantSurfaceTheme({ children }: { children: ReactNode }) {
  const { controller } = useAssistant();
  const colorPrimary = resolveAssistantColorPrimary(controller.options.theme);
  const brandStyle = {
    "--assistant-brand": colorPrimary,
    "--assistant-sdk-color-primary": colorPrimary,
  } as CSSProperties;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary,
          borderRadius: 10,
          fontFamily: "Inter, system-ui, sans-serif",
        },
      }}
    >
      <div className="assistant-sdk-theme" style={brandStyle}>
        {children}
      </div>
    </ConfigProvider>
  );
}

export function AssistantSurface() {
  return (
    <AssistantSurfaceTheme>
      <AssistantSurfaceContent />
    </AssistantSurfaceTheme>
  );
}

export function AssistantReact({ options }: { options: AssistantSdkOptions }) {
  return (
    <AssistantProvider options={options}>
      <AssistantSurface />
    </AssistantProvider>
  );
}
