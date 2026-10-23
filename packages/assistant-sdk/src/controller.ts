import type { AssistantColorTheme } from "@assistant/assistant-ui";
import { AgUiChatAgentPort, AssistantApiTransport } from "@assistant/assistant-transport";
import type { HostNavigationAction } from "@assistant/contracts";
import { rawHostContextSchema, type RawHostContext } from "@assistant/context";

export type AssistantPresentation = "floating" | "drawer" | "inline";

export interface AssistantSdkOptions {
  apiBaseUrl?: string;
  presentation?: AssistantPresentation;
  container?: HTMLElement | string;
  getAccessCredential: () => string | Promise<string>;
  getContext?: () => RawHostContext | Promise<RawHostContext>;
  initialContext?: RawHostContext;
  initiallyOpen?: boolean;
  title?: string;
  layout?: "default" | "panel";
  /** 主色（Ant Design `colorPrimary` 与聊天强调色）。默认 `#1677ff`。 */
  theme?: AssistantColorTheme;
  onHostAction?: (action: HostNavigationAction) => void;
}

export interface AssistantSdkState {
  mounted: boolean;
  open: boolean;
  presentation: AssistantPresentation;
  context?: RawHostContext;
}

type Listener = () => void;

export class AssistantController {
  readonly transport: AssistantApiTransport;
  readonly chatTransport: AgUiChatAgentPort;
  readonly options: AssistantSdkOptions;
  #context: RawHostContext | undefined;
  #mounted = false;
  #open: boolean;
  #listeners = new Set<Listener>();
  #snapshot: AssistantSdkState;

  constructor(options: AssistantSdkOptions) {
    this.options = options;
    this.#context =
      options.initialContext === undefined
        ? undefined
        : rawHostContextSchema.parse(options.initialContext);
    this.#open = options.presentation === "inline" || options.initiallyOpen === true;
    this.#snapshot = this.#createSnapshot();
    this.transport = new AssistantApiTransport({
      ...(options.apiBaseUrl === undefined ? {} : { apiBaseUrl: options.apiBaseUrl }),
      getAccessCredential: options.getAccessCredential,
    });
    this.chatTransport = new AgUiChatAgentPort(this.transport);
  }

  getState(): AssistantSdkState {
    return this.#snapshot;
  }

  #createSnapshot(): AssistantSdkState {
    return {
      mounted: this.#mounted,
      open: this.options.presentation === "inline" || this.#open,
      presentation: this.options.presentation ?? "floating",
      ...(this.#context === undefined ? {} : { context: structuredClone(this.#context) }),
    };
  }

  async getContext(): Promise<RawHostContext> {
    const value = this.#context ?? (await this.options.getContext?.()) ?? {};
    return rawHostContextSchema.parse(value);
  }

  updateContext(context: RawHostContext): void {
    this.#context = rawHostContextSchema.parse(context);
    this.#emit();
  }

  open(): void {
    this.#open = true;
    this.#emit();
  }

  close(): void {
    if (this.options.presentation !== "inline") this.#open = false;
    this.#emit();
  }

  markMounted(mounted: boolean): void {
    this.#mounted = mounted;
    this.#emit();
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(): void {
    this.#snapshot = this.#createSnapshot();
    for (const listener of this.#listeners) listener();
  }
}
