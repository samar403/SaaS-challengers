import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.LATHE_MODEL || "claude-opus-5-5";

/**
 * Server-side fallback on refusal: if a safety classifier declines a benign
 * request, the API retries on Anthropic's recommended model for that category
 * instead of failing the user's request.
 */
export function withFallback() {
  return {
    betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
    fallbacks: "default" as const,
  };
}

let client: Anthropic | null | undefined;

/** Returns a client when credentials are configured, otherwise null (Offline mode). */
export function getClaude(): Anthropic | null {
  if (client !== undefined) return client;
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  client = hasKey ? new Anthropic({ maxRetries: 2 }) : null;
  return client;
}

export function aiMode(): "claude" | "offline" {
  return getClaude() ? "claude" : "offline";
}

/** Human-readable message for a failed Claude call, using the SDK's typed errors. */
export function describeAiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Claude rejected the API key — check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "Claude is rate limiting this workspace — try again shortly.";
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach Claude — check network egress.";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : "Unknown error";
}
