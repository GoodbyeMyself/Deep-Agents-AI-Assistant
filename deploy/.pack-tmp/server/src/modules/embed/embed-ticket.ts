import type { VerifiedPrincipal } from "@assistant/context";
import { randomBytes } from "node:crypto";

import type { EmbedIdentityProvider } from "../identity/identity.js";
import { ServiceError } from "../../shared/errors.js";

interface TicketRecord {
  principal: VerifiedPrincipal;
  targetOrigin: string;
  expiresAt: number;
}

export class EmbedTicketService {
  readonly #tickets = new Map<string, TicketRecord>();

  constructor(private readonly identity: EmbedIdentityProvider) {}

  create(
    principal: VerifiedPrincipal,
    targetOrigin: string,
  ): { ticket: string; expiresAt: string } {
    let normalized: string;
    try {
      normalized = new URL(targetOrigin).origin;
    } catch {
      throw new ServiceError("INVALID_ORIGIN", "A valid target origin is required.", 400);
    }
    const parsed = new URL(normalized);
    const localHttp =
      parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname);
    if (normalized !== targetOrigin || (parsed.protocol !== "https:" && !localHttp))
      throw new ServiceError("INVALID_ORIGIN", "A canonical HTTP(S) origin is required.", 400);
    const ticket = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 60_000;
    this.#tickets.set(ticket, { principal, targetOrigin: normalized, expiresAt });
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  exchange(
    ticket: string,
    requestOrigin: string | null,
  ): { accessCredential: string; expiresIn: number } {
    const record = this.#tickets.get(ticket);
    if (record === undefined || record.expiresAt <= Date.now()) {
      if (record !== undefined) this.#tickets.delete(ticket);
      throw new ServiceError("INVALID_EMBED_TICKET", "Embed ticket is invalid or expired.", 401);
    }
    this.#tickets.delete(ticket);
    if (requestOrigin !== record.targetOrigin)
      throw new ServiceError("EMBED_ORIGIN_MISMATCH", "Embed ticket origin mismatch.", 403);
    return {
      accessCredential: this.identity.issueTemporaryCredential(record.principal),
      expiresIn: 300,
    };
  }
}
