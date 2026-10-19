const SENSITIVE_KEY = /(api[-_]?key|authorization|credential|password|secret|token)/i;

export function sanitizeDiagnostic(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnostic(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeDiagnostic(entryValue),
      ]),
    );
  }

  return value;
}
