const configuredName: unknown = import.meta.env["VITE_ASSISTANT_APP_NAME"];
export const assistantAppName = typeof configuredName === "string"
  ? configuredName.trim().slice(0, 80) || "Copilot AI · 业务智能助手"
  : "Copilot AI · 业务智能助手";
