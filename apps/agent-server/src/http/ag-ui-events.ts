import type { VerifiedPrincipal } from "@assistant/context";
import {
  decodeAgUiEventCursor,
  initialAgUiProjectionState,
  projectAssistantEventToAgUi,
  type AgUiEvent,
  type AgUiProjectionState,
  type AssistantEvent,
} from "@assistant/contracts";

import { ServiceError } from "../shared/errors.js";
import type { InMemoryAgentStore } from "../modules/session/store.js";

interface PreparedProjection {
  readonly events: readonly AgUiEvent[];
  readonly state: AgUiProjectionState;
  readonly anchorEventId?: string;
}

function cursorUnavailable(): ServiceError {
  return new ServiceError("EVENT_CURSOR_EXPIRED", "Event cursor is unavailable.", 409);
}

function projectStoredEvents(
  sourceEvents: readonly AssistantEvent[],
  cursor: string | undefined,
): PreparedProjection {
  const decodedCursor = cursor === undefined ? undefined : decodeAgUiEventCursor(cursor);
  if (cursor !== undefined && decodedCursor === undefined) throw cursorUnavailable();

  let state = initialAgUiProjectionState;
  let cursorFound = decodedCursor === undefined;
  const projectedEvents: AgUiEvent[] = [];

  for (const sourceEvent of sourceEvents) {
    const projection = projectAssistantEventToAgUi(sourceEvent, state);
    state = projection.state;

    if (!cursorFound && sourceEvent.eventId === decodedCursor?.sourceEventId) {
      if (decodedCursor.projectionIndex >= projection.events.length) throw cursorUnavailable();
      projectedEvents.push(...projection.events.slice(decodedCursor.projectionIndex + 1));
      cursorFound = true;
      continue;
    }
    if (cursorFound) projectedEvents.push(...projection.events);
  }

  if (!cursorFound) throw cursorUnavailable();
  const anchorEventId = sourceEvents.at(-1)?.eventId;
  return {
    events: projectedEvents,
    state,
    ...(anchorEventId === undefined ? {} : { anchorEventId }),
  };
}

/**
 * 使用同一已鉴权 AssistantEvent 日志生成 AG-UI 流。准备阶段同步验证游标，确保错误仍以 HTTP
 * 409 返回，而不是在已经发送 200 后才破坏 SSE 流。
 */
export function createAgUiEventStream(
  store: InMemoryAgentStore,
  runId: string,
  principal: VerifiedPrincipal,
  cursor?: string,
): AsyncGenerator<AgUiEvent> {
  const prepared = projectStoredEvents(store.listEvents(runId, principal), cursor);

  return (async function* streamProjectedEvents() {
    let state = prepared.state;
    for (const event of prepared.events) yield event;

    for await (const sourceEvent of store.streamEvents(
      runId,
      principal,
      prepared.anchorEventId,
    )) {
      const projection = projectAssistantEventToAgUi(sourceEvent, state);
      state = projection.state;
      for (const event of projection.events) yield event;
    }
  })();
}
