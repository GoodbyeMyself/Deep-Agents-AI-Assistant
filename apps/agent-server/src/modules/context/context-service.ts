import {
  rawHostContextSchema,
  type ContextAuthorizer,
  type ContextSnapshot,
  type NormalizedContext,
  type RawHostContext,
  type VerifiedPrincipal,
} from "@assistant/context";
import { randomUUID } from "node:crypto";

import { forbidden, ServiceError } from "../../shared/errors.js";

export class MockContextAuthorizer implements ContextAuthorizer {
  normalize(raw: RawHostContext, principal: VerifiedPrincipal): Promise<NormalizedContext> {
    const objectId = raw.object?.rawId;
    if (objectId !== undefined && !principal.authorizedObjectIds.includes(objectId)) {
      return Promise.reject(forbidden());
    }
    return Promise.resolve({
      user: { id: principal.id, displayName: principal.displayName },
      permissions: { scopes: [...principal.permissionScopes] },
      ...(raw.page?.type === undefined
        ? {}
        : {
            page: {
              type: raw.page.type,
              ...(raw.page.route === undefined ? {} : { route: raw.page.route }),
              ...(raw.page.title === undefined ? {} : { title: raw.page.title }),
            },
          }),
      ...(raw.object?.type === undefined || objectId === undefined
        ? {}
        : {
            object: {
              type: raw.object.type,
              id: objectId,
              ...(raw.object.name === undefined ? {} : { name: raw.object.name }),
            },
          }),
      ...(raw.business?.domain === undefined
        ? {}
        : {
            business: {
              domain: raw.business.domain,
              ...(raw.business.module === undefined ? {} : { module: raw.business.module }),
            },
          }),
    });
  }
}

export class ContextService {
  constructor(private readonly authorizer: ContextAuthorizer) {}

  async create(
    body: unknown,
    mode: "assistant" | "standalone",
    principal: VerifiedPrincipal,
  ): Promise<ContextSnapshot> {
    const parsed = rawHostContextSchema.safeParse(body);
    if (!parsed.success) throw new ServiceError("INVALID_INPUT", "Invalid host context.", 400);
    const context = await this.authorizer.normalize(parsed.data, principal);
    return {
      id: randomUUID(),
      version: 1,
      ownerId: principal.id,
      tenantId: principal.tenantId,
      mode,
      capturedAt: new Date().toISOString(),
      context,
    };
  }
}
