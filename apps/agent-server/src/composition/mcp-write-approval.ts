import { createHash, createHmac } from "node:crypto";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

/** Transport-only assertion bound to tool, exact arguments, current business JWT and stable graph call id. */
export function signMcpWriteApproval(
  secret: string,
  key: string,
  tool: string,
  input: unknown,
  token: string,
) {
  const payload = {
    key,
    tool,
    inputDigest: digest(input),
    tokenDigest: digest(token),
    expires: Date.now() + 600000,
  };
  return {
    ...payload,
    signature: createHmac("sha256", secret).update(canonical(payload)).digest("hex"),
  };
}
