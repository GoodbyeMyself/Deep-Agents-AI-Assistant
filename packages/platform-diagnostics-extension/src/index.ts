import { fileURLToPath } from "node:url";

import type { PlatformExtensionDefinition } from "@assistant/platform-extension-runtime";

const extensionRoot = fileURLToPath(new URL("../", import.meta.url));

export const platformExtension = {
  rootDirectory: extensionRoot,
  manifest: {
    id: "platform-diagnostics",
    version: "1.0.0",
    apiVersion: "1",
    description: "Read-only guidance about the platform extension boundary.",
    contributes: {
      tools: [
        {
          name: "extension_boundary",
          riskLevel: "read",
          requiredPermissions: [],
        },
      ],
      skills: [
        {
          id: "platform-extension-help",
          path: "skills/platform-extension-help",
          contentDigest: "89bcea738c462bbcdaad9ef734c494e35ece03c599f8559c33b14e67b53040f0",
          allowedTools: ["platform_platform-diagnostics_extension_boundary"],
        },
      ],
    },
  },
  tools: [
    {
      name: "extension_boundary",
      description:
        "Explain the enforced boundary between platform extensions and business MCP capabilities.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      execute: () =>
        Promise.resolve(
          Object.freeze({
            status: "success",
            platformExtensionsMayProvide: [
              "reviewed platform tools",
              "approved skills",
              "platform infrastructure providers",
            ],
            businessCapabilitiesMustUse: "an independently governed system MCP",
            authorizationRule:
              "Skill instructions and model-visible parameters never grant identity, permissions, or credentials.",
          }),
        ),
    },
  ],
} as const satisfies PlatformExtensionDefinition;
