import type { CapabilityPolicy } from "@assistant/capability-contracts";

function targetObjectId(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const candidate = (input as Record<string, unknown>)["tableId"];
  return typeof candidate === "string" ? candidate : undefined;
}

export const enterpriseCapabilityPolicy: CapabilityPolicy = {
  authorize: ({ requiredPermission, context, input }) => {
    if (!context.permissionScopes.includes(requiredPermission)) return Promise.resolve(false);
    const target = targetObjectId(input);
    if (target === undefined) return Promise.resolve(true);
    return Promise.resolve(
      (context.authorizedObjectIds ?? []).includes(target) &&
        (context.contextObjectId === undefined || context.contextObjectId === target),
    );
  },
};
