import { fileURLToPath } from "node:url";

import type { PlatformExtensionDefinition } from "@assistant/platform-extension-runtime";

const extensionRoot = fileURLToPath(new URL("../", import.meta.url));

export const platformExtension = {
  rootDirectory: extensionRoot,
  manifest: {
    id: "platform-diagnostics",
    version: "1.0.0",
    apiVersion: "1",
    description: "只读说明：平台扩展与业务能力之间的强制边界。",
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
          contentDigest: "47a750c7e936b4e7801bec996b7955202ec93c45995a347e29e27239e8bfe307",
          allowedTools: ["platform_platform-diagnostics_extension_boundary"],
        },
      ],
    },
  },
  tools: [
    {
      name: "extension_boundary",
      description: "说明平台扩展与业务 MCP 能力之间受强制执行的边界。",
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
              "经审核的平台 Tool",
              "已批准的 Skill",
              "平台基础设施 Provider",
            ],
            businessCapabilitiesMustUse: "独立治理的系统 MCP",
            authorizationRule:
              "Skill 说明与模型可见参数均不能授予身份、权限或凭证。",
          }),
        ),
    },
  ],
} as const satisfies PlatformExtensionDefinition;
