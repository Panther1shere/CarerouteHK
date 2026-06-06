export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[error-boundary]", { error, ...context });
}
