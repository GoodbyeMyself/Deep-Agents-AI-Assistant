import type { AgUiEvent, AssistantView } from "@assistant/contracts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "loading" | "success" | "error" | "abort";
  executionSteps: PublicExecutionStep[];
  evidenceIds: string[];
  views: AssistantView[];
  approvals: ApprovalRequest[];
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  reason: string;
  message?: string;
  expiresAt?: string;
  status: "pending" | "submitting" | "approved" | "rejected";
}

export interface PublicExecutionStep {
  key: string;
  title: string;
  detail?: string;
  status: "pending" | "loading" | "success" | "error";
}

export interface ChatState {
  messages: ChatMessage[];
  seenEventIds: Set<string>;
  activeRunId: string | undefined;
}

export type ChatAction =
  | { type: "reset"; messages: ChatMessage[] }
  | { type: "submit"; user: ChatMessage; assistant: ChatMessage; runId?: string }
  | { type: "run-bound"; runId: string }
  | {
      type: "approval-status";
      interruptId: string;
      status: ApprovalRequest["status"];
    }
  | {
      type: "resume-bound";
      interruptId: string;
      decision: "approved" | "rejected";
      runId: string;
      assistant: ChatMessage;
    }
  | { type: "event"; event: AgUiEvent }
  | { type: "failed"; message: string }
  | { type: "cancelled" };
