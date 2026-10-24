import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  connectApprovedHttpMcp, createApprovedMcpToolSnapshot, createMcpLangChainTools,
  discoverMcpTools, validateHttpMcpEndpoint, type McpToolApproval,
} from "@assistant/mcp-client-runtime";
import type { ConfiguredMcpRuntime } from "./mcp-bootstrap.js";

const serverSchema = z.object({
  serverId: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
  endpoint: z.string().url(), allowedHosts: z.array(z.string().min(1)).min(1),
  localDemoHttp: z.boolean().default(false),
  authentication: z.enum(["local-delegation", "current-user"]).default("local-delegation"),
  approvals: z.array(z.object({ toolName: z.string().min(1).max(128),
    schemaDigest: z.string().regex(/^[a-f0-9]{64}$/), riskLevel: z.literal("read") }).strict()).min(1),
}).strict();

export function readHttpMcpDeploymentConfig(environment: NodeJS.ProcessEnv) {
  const raw = environment["MCP_HTTP_SERVERS"]?.trim();
  if (!raw) return undefined;
  // This credential issuer is deliberately a local integration mechanism, not an enterprise IdP.
  if (environment["ASSISTANT_LOCAL_DEMO"] !== "true")
    throw new Error("The bundled HTTP MCP credential issuer requires explicit ASSISTANT_LOCAL_DEMO=true.");
  const secret = environment["MCP_DELEGATION_SECRET"];
  if (secret === undefined || secret.length < 64) throw new Error("MCP_DELEGATION_SECRET must contain at least 64 characters.");
  const servers = z.array(serverSchema).min(1).parse(JSON.parse(raw));
  if (new Set(servers.map((server) => server.serverId)).size !== servers.length)
    throw new Error("Duplicate HTTP MCP Server id.");
  for (const server of servers) validateHttpMcpEndpoint(server);
  return { servers, secret };
}

function tokenFor(secret: string, audience: string, subject: string, tenant: string, discovery: boolean): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: "assistant-local", aud: audience,
    sub: subject, tenant, iat: now, exp: now + 60, purpose: discovery ? "discovery" : "tool" })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Each invocation owns an authenticated connection; credentials never cross principals. */
export async function connectApprovedHttpMcps(
  config: NonNullable<ReturnType<typeof readHttpMcpDeploymentConfig>>,
  credentialFor?: (context: { principalId: string; tenantId: string; authorizationRef?: string | undefined }) => Promise<string>,
): Promise<ConfiguredMcpRuntime> {
  const tools: ConfiguredMcpRuntime["tools"][number][] = [];
  const serverStatuses: Record<string, unknown>[] = [];
  const toolStatuses: Record<string, unknown>[] = [];
  for (const server of config.servers) {
    if (server.authentication === "current-user" && !credentialFor) throw new Error("Current-user MCP requires a trusted credential provider.");
    const approvals: McpToolApproval[] = server.approvals.map((approval) => ({ ...approval, serverId: server.serverId }));
    const validate = async (client: Parameters<typeof discoverMcpTools>[0]) => {
      const candidates = await discoverMcpTools(client, { serverId: server.serverId });
      const snapshot = createApprovedMcpToolSnapshot(candidates, approvals);
      if (snapshot.unapproved.length) throw new Error(`MCP Server '${server.serverId}' exposes unapproved Tools.`);
      return snapshot;
    };
    const discovery = await connectApprovedHttpMcp(server,
      () => Promise.resolve(tokenFor(config.secret, server.serverId, "platform-discovery", "platform", true)));
    try {
      const snapshot = await validate(discovery.client);
      tools.push(...createMcpLangChainTools({ client: discovery.client, approvedTools: snapshot.approved,
        invokeTool: async (request, options, context) => {
          const identity = z.object({ principalId: z.string().min(1), tenantId: z.string().min(1),
            runId: z.string().uuid(), sessionId: z.string().uuid(), authorizationRef: z.string().optional() }).parse(context);
          options.signal?.throwIfAborted();
          const connection = await connectApprovedHttpMcp(server,
            () => server.authentication === "current-user" ? credentialFor!(identity)
              : Promise.resolve(tokenFor(config.secret, server.serverId, identity.principalId, identity.tenantId, false)));
          try {
            options.signal?.throwIfAborted();
            await validate(connection.client);
            return await connection.client.callTool(request, options);
          } catch { throw new Error(`MCP Tool request failed for '${server.serverId}'.`); }
          finally { await connection.close(); }
        },
      }));
      serverStatuses.push({ serverId: server.serverId, status: "ready", transport: "streamable-http",
        protocolEra: discovery.protocolEra, approvedToolCount: snapshot.approved.length, localDemo: true });
      toolStatuses.push(...snapshot.approved.map((tool) => ({ serverId: tool.serverId, name: tool.name,
        schemaDigest: tool.schemaDigest, riskLevel: tool.riskLevel, status: "approved" })));
    } finally { await discovery.close(); }
  }
  if (new Set(tools.map((tool) => tool.name)).size !== tools.length) throw new Error("MCP model Tool name conflict.");
  return { tools, serverStatuses, toolStatuses, close: () => Promise.resolve() };
}
