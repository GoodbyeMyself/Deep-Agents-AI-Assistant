import type { RawHostContext } from "@assistant/context";
import type { HostNavigationAction } from "@assistant/contracts";

export interface IframeAssistantHostOptions {
  readonly iframeUrl: string;
  /** Deployment-configured independent assistant page; credentials are never placed in this URL. */
  readonly standaloneUrl?: string;
  readonly ticketEndpoint: string;
  readonly initialContext?: RawHostContext;
  readonly accessToken?: string;
  readonly title?: string;
  readonly accent?: string;
  readonly zIndex?: number;
  readonly onHostAction?: (action: HostNavigationAction) => void;
}

export interface IframeAssistantHost {
  open(): void;
  close(): void;
  updateContext(context: RawHostContext): void;
  destroy(): void;
  getState(): { readonly open: boolean; readonly ready: boolean };
}
