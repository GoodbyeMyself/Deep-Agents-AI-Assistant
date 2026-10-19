import type { IframeAssistantHostOptions } from "./types.js";

export function canonicalOrigin(value: string): string {
  const url = new URL(value, location.href);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Assistant iframe must use HTTP(S).");
  return url.origin;
}

/** 向 Agent Server 申请面向 `targetOrigin` 的短期 embed ticket（Cookie 或 Bearer）。 */
export async function createEmbedTicket(
  options: IframeAssistantHostOptions,
  targetOrigin: string,
): Promise<string> {
  const response = await fetch(new URL(options.ticketEndpoint, location.href), {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(options.accessToken === undefined
        ? {}
        : { authorization: `Bearer ${options.accessToken}` }),
    },
    body: JSON.stringify({ targetOrigin }),
  });
  if (!response.ok) throw new Error("Assistant embed ticket request failed.");
  const payload = (await response.json()) as { ticket?: unknown };
  if (typeof payload.ticket !== "string") throw new Error("Assistant embed ticket is missing.");
  return payload.ticket;
}
