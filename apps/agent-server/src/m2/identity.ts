import type { VerifiedPrincipal } from "@assistant/context";

import { ServiceError } from "./errors.js";

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
  authenticate(authorization: string | null): Promise<VerifiedPrincipal>;
}

export class MockIdentityProvider implements IdentityProvider {
  authenticate(authorization: string | null): Promise<VerifiedPrincipal> {
    const token = authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
    const principal = token === undefined ? undefined : principals.get(token);
    if (principal === undefined) {
      return Promise.reject(new ServiceError("UNAUTHENTICATED", "Authentication required.", 401));
    }
    return Promise.resolve(principal);
  }
}
