import type { VerifiedPrincipal } from "@assistant/context";
import {
  AG_UI_PROTOCOL_VERSION,
  ENTERPRISE_ASSISTANT_METADATA_KEY,
  parseAgUiRunAgentInput,
  type AgUiEvent,
  type AgUiRunAgentInput,
} from "@assistant/contracts";
import { z } from "zod";

import type { AgentService } from "../modules/session/service.js";
import { ServiceError } from "../shared/errors.js";
import { createAgUiEventStream } from "./ag-ui-events.js";

const enterpriseForwardedPropsSchema = z
  .object({
    [ENTERPRISE_ASSISTANT_METADATA_KEY]: z
      .object({ contextSnapshotId: z.string().uuid() })
      .strict(),
  })
  .passthrough();

function invalidInput(message: string): ServiceError {
  return new ServiceError("INVALID_AG_UI_INPUT", message, 400);
}

function extractLatestUserText(input: AgUiRunAgentInput): string {
  const message = input.messages.at(-1);
  if (message?.role !== "user")
    throw invalidInput("The final AG-UI message must be a user message.");

  if (typeof message.content === "string") {
    const text = message.content.trim();
    if (text.length === 0) throw invalidInput("The final user message must not be empty.");
    return text;
  }

  let combined = "";
  for (const part of message.content) {
    if (part.type !== "text")
      throw new ServiceError(
        "UNSUPPORTED_AG_UI_CONTENT",
        "Only text AG-UI input is supported.",
        422,
      );
    combined += part.text;
  }
  const text = combined.trim();
  if (text.length === 0) throw invalidInput("The final user message must not be empty.");
  return text;
}

function contextSnapshotId(input: AgUiRunAgentInput): string {
  const parsed = enterpriseForwardedPropsSchema.safeParse(input.forwardedProps);
  if (!parsed.success)
    throw invalidInput(
      `forwardedProps.${ENTERPRISE_ASSISTANT_METADATA_KEY}.contextSnapshotId is required.`,
    );
  return parsed.data[ENTERPRISE_ASSISTANT_METADATA_KEY].contextSnapshotId;
}

function validateSupportedInput(input: AgUiRunAgentInput): void {
  if (input.protocolVersion !== undefined && input.protocolVersion !== AG_UI_PROTOCOL_VERSION)
    throw new ServiceError(
      "UNSUPPORTED_AG_UI_VERSION",
      `AG-UI protocol version ${input.protocolVersion} is unsupported.`,
      422,
    );
  if (input.runId.length === 0 || input.runId.length > 180)
    throw invalidInput("AG-UI runId must contain between 1 and 180 characters.");
  if (input.tools.length > 0)
    throw new ServiceError(
      "UNSUPPORTED_CLIENT_TOOLS",
      "Client-provided tools are not supported.",
      422,
    );
  if ((input.resume?.length ?? 0) > 0)
    throw new ServiceError(
      "UNSUPPORTED_AG_UI_RESUME",
      "AG-UI interrupt resume is unsupported.",
      422,
    );
}

function exposeRequestedRunIdentity(
  event: AgUiEvent,
  input: Pick<AgUiRunAgentInput, "threadId" | "runId">,
): AgUiEvent {
  const eventType = String(event.type);
  if (eventType !== "RUN_STARTED" && eventType !== "RUN_FINISHED") return event;
  return { ...event, threadId: input.threadId, runId: input.runId } as AgUiEvent;
}

export function createAgUiRun(
  service: AgentService,
  principal: VerifiedPrincipal,
  value: unknown,
): { readonly runId: string; readonly events: AsyncGenerator<AgUiEvent> } {
  let input: AgUiRunAgentInput;
  try {
    input = parseAgUiRunAgentInput(value);
  } catch {
    throw invalidInput("Request does not satisfy the AG-UI 1.0 input contract.");
  }
  validateSupportedInput(input);
  const run = service.createRun(
    input.threadId,
    {
      message: extractLatestUserText(input),
      contextSnapshotId: contextSnapshotId(input),
      clientRequestId: `ag-ui:${input.runId}`,
    },
    principal,
  );
  const events = createAgUiEventStream(service.store, run.id, principal);

  return {
    runId: run.id,
    events: (async function* streamRun() {
      for await (const event of events) yield exposeRequestedRunIdentity(event, input);
    })(),
  };
}
