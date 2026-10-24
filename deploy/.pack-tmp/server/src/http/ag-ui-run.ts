import type { VerifiedPrincipal } from "@assistant/context";
import {
  AG_UI_PROTOCOL_VERSION,
  ENTERPRISE_ASSISTANT_METADATA_KEY,
  parseAgUiRunAgentInput,
  resumeRunRequestSchema,
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
  if ((input.resume?.length ?? 0) > 1)
    throw new ServiceError(
      "UNSUPPORTED_PARALLEL_INTERRUPTS",
      "Only one AG-UI interrupt can be resumed at a time.",
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

export async function createAgUiRun(
  service: AgentService,
  principal: VerifiedPrincipal,
  value: unknown,
): Promise<{ readonly runId: string; readonly events: AsyncGenerator<AgUiEvent> }> {
  let input: AgUiRunAgentInput;
  try {
    input = parseAgUiRunAgentInput(value);
  } catch {
    throw invalidInput("Request does not satisfy the AG-UI 1.0 input contract.");
  }
  validateSupportedInput(input);
  const resume = input.resume?.[0];
  const run =
    resume === undefined
      ? await service.createRun(
          input.threadId,
          {
            message: extractLatestUserText(input),
            contextSnapshotId: contextSnapshotId(input),
            clientRequestId: `ag-ui:${input.runId}`,
          },
          principal,
        )
      : await (async () => {
          const parsedResponse = resumeRunRequestSchema.safeParse({
            interruptId: resume.interruptId,
            status: resume.status,
            ...(resume.payload === undefined ? {} : { payload: resume.payload as unknown }),
            clientRequestId: `ag-ui:${input.runId}`,
          });
          if (!parsedResponse.success)
            throw invalidInput("AG-UI resume does not satisfy the governed approval contract.");
          const response = parsedResponse.data;
          const pending = await service.store.findPendingInterrupt(
            input.threadId,
            response.interruptId,
            principal,
          );
          return service.resumeRun(pending.runId, response, principal);
        })();
  const events = await createAgUiEventStream(service.store, run.id, principal);

  return {
    runId: run.id,
    events: (async function* streamRun() {
      for await (const event of events) yield exposeRequestedRunIdentity(event, input);
    })(),
  };
}
