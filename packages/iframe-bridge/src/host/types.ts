import type { RawHostContext } from "@assistant/context";

export interface IframeAssistantHostOptions {
  readonly iframeUrl: string;
  readonly ticketEndpoint: string;
  readonly initialContext?: RawHostContext;
  readonly accessToken?: string;
  readonly title?: string;
  readonly accent?: string;
  readonly zIndex?: number;
}

export interface IframeAssistantHost {
  open(): void;
  close(): void;
  updateContext(context: RawHostContext): void;
  destroy(): void;
  getState(): { readonly open: boolean; readonly ready: boolean };
}
