import { hostNavigationActionSchema } from "@assistant/contracts";
import type { PlatformExtensionDefinition } from "@assistant/platform-extension-runtime";
import { fileURLToPath } from "node:url";

const extensionRoot = fileURLToPath(new URL("../", import.meta.url));

export const platformExtension = {
  rootDirectory: extensionRoot,
  manifest: {
    id: "host-navigation",
    version: "1.0.0",
    apiVersion: "1",
    description: "在用户点击后、经宿主白名单校验的声明式导航动作。",
    contributes: {
      tools: [
        {
          name: "present_navigation",
          riskLevel: "read",
          requiredPermissions: [],
        },
      ],
      skills: [],
    },
  },
  tools: [
    {
      name: "present_navigation",
      description:
        "仅在用户明确要求打开或访问宿主页面时，生成导航按钮。只能使用宿主上下文中已声明的不透明 target 动作键；不得编造 URL 或路径。",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["target", "label"],
        properties: {
          target: {
            type: "string",
            minLength: 3,
            maxLength: 120,
            pattern: "^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$",
          },
          label: { type: "string", minLength: 1, maxLength: 80 },
          parameters: {
            type: "object",
            maxProperties: 16,
            additionalProperties: {
              type: ["string", "number", "boolean", "null"],
            },
          },
        },
      },
      execute: (input) => {
        const hostAction = hostNavigationActionSchema.parse({
          type: "host.navigate",
          target: input["target"],
          label: input["label"],
          ...(input["parameters"] === undefined ? {} : { parameters: input["parameters"] }),
        });
        return Promise.resolve(Object.freeze({ status: "success", hostAction }));
      },
    },
  ],
} as const satisfies PlatformExtensionDefinition;
