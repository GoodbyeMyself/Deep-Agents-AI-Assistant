import type { VerifiedPrincipal } from "@assistant/context";

import { ServiceError } from "../../shared/errors.js";

const principals = new Map<string, VerifiedPrincipal>([
  [
    "mock-token-user-a",
    {
      id: "user-a",
      displayName: "Mock User A",
      tenantId: "tenant-a",
      permissionScopes: ["data_map:read", "data_quality:read"],
      authorizedObjectIds: ["orders"],
      authorizationRef: "mock-auth:user-a",
    },
  ],
  [
    "mock-token-user-b",
    {
      id: "user-b",
      displayName: "Mock User B",
      tenantId: "tenant-a",
      permissionScopes: ["data_map:read"],
      authorizedObjectIds: ["customers"],
      authorizationRef: "mock-auth:user-b",
    },
  ],
  [
    "mock-token-admin",
    {
      id: "admin-a",
      displayName: "Mock Platform Admin",
      tenantId: "tenant-a",
      permissionScopes: ["data_map:read", "data_quality:read", "platform:admin"],
      authorizedObjectIds: ["orders", "customers"],
      authorizationRef: "mock-auth:admin-a",
    },
  ],
]);

export interface IdentityProvider {
  authenticate(authorization: string | null, request?: Request): Promise<VerifiedPrincipal>;
}

export interface EmbedIdentityProvider extends IdentityProvider {
  issueTemporaryCredential(principal: VerifiedPrincipal, ttlMs?: number): string;
}

export class MockIdentityProvider implements IdentityProvider {
  readonly #temporary = new Map<string, { principal: VerifiedPrincipal; expiresAt: number }>();

  issueTemporaryCredential(principal: VerifiedPrincipal, ttlMs = 5 * 60_000): string {
    const token = `embed_${crypto.randomUUID().replaceAll("-", "")}`;
    this.#temporary.set(token, { principal, expiresAt: Date.now() + ttlMs });
    return token;
  }

  authenticate(authorization: string | null): Promise<VerifiedPrincipal> {
    const token = authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
    const temporary = token === undefined ? undefined : this.#temporary.get(token);
    if (temporary !== undefined && temporary.expiresAt <= Date.now()) {
      this.#temporary.delete(token!);
    }
    const principal =
      token === undefined
        ? undefined
        : (principals.get(token) ??
          (temporary !== undefined && temporary.expiresAt > Date.now()
            ? temporary.principal
            : undefined));
    if (principal === undefined) {
      return Promise.reject(new ServiceError("UNAUTHENTICATED", "Authentication required.", 401));
    }
    return Promise.resolve(principal);
  }
}
