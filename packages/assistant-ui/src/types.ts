import type { AssistantEvent, AssistantView } from "@assistant/contracts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "loading" | "success" | "error" | "abort";
  evidenceIds: string[];
  views: AssistantView[];
}

export interface PublicExecutionStep {
  key: string;
  title: string;
  detail?: string;
  status: "pending" | "loading" | "success" | "error";
}

export interface ChatState {
  messages: ChatMessage[];
  steps: PublicExecutionStep[];
  seenEventIds: Set<string>;
  activeRunId: string | undefined;
}

export type ChatAction =
  | { type: "reset"; messages: ChatMessage[] }
  | { type: "submit"; user: ChatMessage; assistant: ChatMessage; runId?: string }
  | { type: "run-bound"; runId: string }
  | { type: "event"; event: AssistantEvent }
  | { type: "failed"; message: string }
  | { type: "cancelled" };
