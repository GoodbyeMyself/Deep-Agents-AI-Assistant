import { defineCapability, definePlugin, implementCapability } from "@assistant/plugin-sdk";
import { z } from "zod";

const metadataLookup = defineCapability({
  id: "__NAMESPACE__.metadata.lookup",
  version: "1.0.0",
  description: "Look up metadata already authorized by the source business system.",
  requiredPermission: "metadata:read",
  riskLevel: "read",
  inputSchema: z.object({ objectId: z.string().min(1) }).strict(),
  dataSchema: z.object({ objectId: z.string(), displayName: z.string() }).strict(),
});

export default definePlugin(() => ({
  contracts: [metadataLookup],
  capabilities: [
    implementCapability({
      contract: metadataLookup,
      execute(input) {
        // Replace this sample with a call to the original business API. That API must
        // enforce object/row/field authorization and return only model-visible data.
        return Promise.resolve({
          status: "success",
          data: { objectId: input.objectId, displayName: `Authorized ${input.objectId}` },
          evidence: [
            {
              id: `__PLUGIN_ID__:${input.objectId}`,
              source: { type: "service", id: "replace-with-business-service" },
              collectedAt: new Date().toISOString(),
              referenceId: `__PLUGIN_ID__:${input.objectId}`,
            },
          ],
          warnings: [],
        });
      },
    }),
  ],
  healthCheck: () => Promise.resolve({ ok: true }),
}));
