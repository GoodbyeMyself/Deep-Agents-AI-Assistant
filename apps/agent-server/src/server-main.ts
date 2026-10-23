import { ChatOpenAI } from "@langchain/openai";
import {
  loadApprovedPlatformExtensions,
  readPlatformExtensionDeploymentConfig,
} from "@assistant/platform-extension-runtime";
import type { FilesystemPermission } from "deepagents";

import { createAgentApplication } from "./composition/create-application.js";
import {
  connectApprovedDevelopmentMcps,
  readDevelopmentMcpDeploymentConfig,
} from "./composition/mcp-bootstrap.js";
import { importInstalledPlatformExtension } from "./composition/platform-extension-bootstrap.js";
import { createNodeHttpServer } from "./http/node-http.js";

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

const deepSeekKey = envValue("DEEPSEEK_API_KEY");
const apiKey = deepSeekKey ?? envValue("OPENAI_API_KEY");
if (apiKey === undefined) throw new Error("DEEPSEEK_API_KEY or OPENAI_API_KEY is required.");
const baseURL = envValue("DEEPSEEK_BASE_URL");
const modelName =
  envValue("MODEL_NAME") ?? (deepSeekKey === undefined ? "gpt-5-mini" : "deepseek-chat");
const port = Number(process.env["SERVER_PORT"] ?? "3000");
const host = process.env["SERVER_HOST"] ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("SERVER_PORT must be an integer between 1 and 65535.");
}
const model = new ChatOpenAI({
  apiKey,
  model: modelName,
  temperature: 0,
  maxTokens: 2_048,
  maxRetries: 1,
  timeout: 30_000,
  streamUsage: false,
  ...(deepSeekKey === undefined ? {} : { modelKwargs: { thinking: { type: "disabled" } } }),
  ...(baseURL === undefined ? {} : { configuration: { baseURL } }),
});
const mcpConfig = readDevelopmentMcpDeploymentConfig(process.env, process.execPath);
const mcpRuntime =
  mcpConfig === undefined ? undefined : await connectApprovedDevelopmentMcps(mcpConfig);
const extensionConfig = readPlatformExtensionDeploymentConfig(process.env);
const extensionRuntime =
  extensionConfig === undefined
    ? undefined
    : await loadApprovedPlatformExtensions(extensionConfig, importInstalledPlatformExtension).catch(
        async (error: unknown) => {
          await mcpRuntime?.close();
          throw error;
        },
      );
const tools = [...(mcpRuntime?.tools ?? []), ...(extensionRuntime?.tools ?? [])];
const toolNames = new Set<string>();
for (const tool of tools) {
  if (toolNames.has(tool.name)) {
    await Promise.all([mcpRuntime?.close(), extensionRuntime?.close()]);
    throw new Error(`Model Tool name conflict for '${tool.name}'.`);
  }
  toolNames.add(tool.name);
}
const skillPermissions: readonly FilesystemPermission[] = [
  { operations: ["read"], paths: ["/skills", "/skills/**"], mode: "allow" },
  { operations: ["read"], paths: ["/**"], mode: "deny" },
  { operations: ["write"], paths: ["/**"], mode: "deny" },
];
const application = await createAgentApplication({
  model,
  ...(tools.length === 0 ? {} : { tools }),
  ...(mcpRuntime === undefined
    ? {}
    : { mcpServers: mcpRuntime.serverStatuses, mcpTools: mcpRuntime.toolStatuses }),
  ...(extensionRuntime === undefined ? {} : { platformExtensions: extensionRuntime.statuses }),
  ...(extensionRuntime?.workspaceRoot === undefined
    ? {}
    : {
        workspaceRoot: extensionRuntime.workspaceRoot,
        skills: [...extensionRuntime.skills],
        permissions: skillPermissions,
      }),
  modelConfig: {
    id: "default",
    provider: deepSeekKey === undefined ? "openai" : "deepseek",
    model: modelName,
    version: "1",
  },
}).catch(async (error: unknown) => {
  await Promise.all([mcpRuntime?.close(), extensionRuntime?.close()]);
  throw error;
});
const server = createNodeHttpServer(application.handler);
let disposed = false;
async function dispose(): Promise<void> {
  if (disposed) return;
  disposed = true;
  await Promise.all([application.dispose(), mcpRuntime?.close(), extensionRuntime?.close()]);
}
function disposeSafely(): void {
  void dispose().catch((error: unknown) => {
    console.error("Agent Server shutdown failed.", error);
    process.exitCode = 1;
  });
}
server.once("close", disposeSafely);
server.once("error", (error) => {
  console.error("Agent Server failed.", error);
  process.exitCode = 1;
  disposeSafely();
});
server.listen(port, host, () =>
  console.log(
    `Agent Server listening for deployment '${process.env["DEPLOYMENT_ID"] ?? "local"}' on http://${host}:${port}` +
      (mcpConfig === undefined
        ? " without MCP Servers"
        : ` with MCP Servers '${mcpConfig.servers.map((server) => server.serverId).join(", ")}'`) +
      (extensionConfig === undefined
        ? " without Platform Extensions"
        : ` with Platform Extensions '${extensionConfig.map((item) => item.approval.id).join(", ")}'`),
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
  });
}
