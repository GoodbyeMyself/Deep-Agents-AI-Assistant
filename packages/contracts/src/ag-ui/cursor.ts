/**
 * AG-UI 事件游标：一条 AssistantEvent 可投影为多条 AG-UI Event（如 message.delta 含 START+CONTENT）。
 *
 * 编码格式 `agui1.{urlEncodedSourceEventId}.{projectionIndex}`，写入 metadata.eventId 供
 * GET /api/v1/runs/{id}/ag-ui/events 断线续传。
 */
import {
  ENTERPRISE_ASSISTANT_METADATA_KEY,
  enterpriseAssistantMetadataSchema,
  type AgUiEvent,
} from "./schemas.js";

const AG_UI_CURSOR_PREFIX = "agui1.";

export interface AgUiEventCursor {
  readonly sourceEventId: string;
  readonly projectionIndex: number;
}

export function encodeAgUiEventCursor(cursor: AgUiEventCursor): string {
  if (cursor.sourceEventId.length === 0 || !Number.isSafeInteger(cursor.projectionIndex))
    throw new Error("Invalid AG-UI event cursor.");
  if (cursor.projectionIndex < 0) throw new Error("Invalid AG-UI event cursor.");
  return `${AG_UI_CURSOR_PREFIX}${encodeURIComponent(cursor.sourceEventId)}.${cursor.projectionIndex}`;
}

export function decodeAgUiEventCursor(value: string): AgUiEventCursor | undefined {
  if (!value.startsWith(AG_UI_CURSOR_PREFIX)) return undefined;
  const separator = value.lastIndexOf(".");
  if (separator <= AG_UI_CURSOR_PREFIX.length) return undefined;
  const projectionIndex = Number(value.slice(separator + 1));
  if (!Number.isSafeInteger(projectionIndex) || projectionIndex < 0) return undefined;
  try {
    const sourceEventId = decodeURIComponent(
      value.slice(AG_UI_CURSOR_PREFIX.length, separator),
    );
    return sourceEventId.length === 0 ? undefined : { sourceEventId, projectionIndex };
  } catch {
    return undefined;
  }
}

export function getAgUiEventCursor(event: AgUiEvent): string {
  const metadata = (event.metadata as Record<string, unknown> | undefined)?.[
    ENTERPRISE_ASSISTANT_METADATA_KEY
  ];
  const parsed = enterpriseAssistantMetadataSchema.safeParse(metadata);
  if (!parsed.success) throw new Error("AG-UI event is missing enterprise cursor metadata.");
  return parsed.data.eventId;
}
