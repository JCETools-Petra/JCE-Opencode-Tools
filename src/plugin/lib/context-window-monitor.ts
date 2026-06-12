/**
 * Context Window Monitor — provider-agnostic detection of how full the model's
 * context window is, plus the building blocks for proactive auto-compaction.
 *
 * Detection is intentionally simple and robust across providers/routers:
 *   - Context limit comes from the model's reported `limit.context` when known
 *     (set in opencode.json for routed/custom providers), else a conservative
 *     fallback so the feature degrades safely instead of misfiring.
 *   - Token usage comes from the assistant message's reported token counts.
 *
 * Pure module: no I/O, no global state. The plugin wires these into hooks.
 */

/** Trigger proactive checkpoint/compaction at this fraction of the window. */
export const DEFAULT_COMPACTION_THRESHOLD = 0.83;

/** Conservative fallback when the model does not report a context limit. */
export const FALLBACK_CONTEXT_LIMIT = 128_000;

export interface ContextUsage {
  tokensUsed: number;
  contextLimit: number;
  /** 0..1 fraction of the context window in use. */
  usagePercent: number;
  /** Whether the limit came from the model or the conservative fallback. */
  knownLimit: boolean;
  limitSource: "model" | "fallback";
}

interface MessageTokenShape {
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
}

function finite(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Resolve the effective context limit. Uses the model-reported value when it is
 * a positive number; otherwise falls back to a conservative default so the
 * monitor never divides by zero or misfires on an unknown limit.
 */
export function resolveContextLimit(
  modelLimitContext: number | undefined | null,
  fallback = FALLBACK_CONTEXT_LIMIT,
): { limit: number; source: "model" | "fallback"; known: boolean } {
  if (typeof modelLimitContext === "number" && Number.isFinite(modelLimitContext) && modelLimitContext > 0) {
    return { limit: modelLimitContext, source: "model", known: true };
  }
  return { limit: fallback, source: "fallback", known: false };
}

/**
 * Extract the number of context tokens occupied by an assistant message.
 * Uses input + cached-read tokens (the portion that occupies the prompt window).
 * Defensive: any missing/garbage field counts as 0.
 */
export function extractTokensUsed(message: unknown): number {
  if (!message || typeof message !== "object") return 0;
  const m = message as MessageTokenShape;
  const t = m.tokens;
  if (!t || typeof t !== "object") return 0;
  return finite(t.input) + finite(t.cache?.read);
}

/**
 * Compute context usage from a token count and the model's reported limit.
 */
export function computeUsage(tokensUsed: number, modelLimitContext: number | undefined | null): ContextUsage {
  const used = finite(tokensUsed);
  const resolved = resolveContextLimit(modelLimitContext);
  const usagePercent = resolved.limit > 0 ? Math.min(1, used / resolved.limit) : 0;
  return {
    tokensUsed: used,
    contextLimit: resolved.limit,
    usagePercent: Math.round(usagePercent * 1000) / 1000,
    knownLimit: resolved.known,
    limitSource: resolved.source,
  };
}

/**
 * Whether usage has reached the proactive-compaction threshold.
 */
export function shouldAutoCompact(usage: ContextUsage, threshold = DEFAULT_COMPACTION_THRESHOLD): boolean {
  return usage.usagePercent >= threshold;
}

/**
 * Detect a fresh upward crossing of the threshold. Returns true only when usage
 * is at/above the threshold AND the previous reading was below it, so the
 * caller fires the checkpoint exactly once per crossing (not every message).
 */
export function crossedThreshold(
  previousPercent: number | undefined,
  currentPercent: number,
  threshold = DEFAULT_COMPACTION_THRESHOLD,
): boolean {
  const prev = typeof previousPercent === "number" && Number.isFinite(previousPercent) ? previousPercent : 0;
  return currentPercent >= threshold && prev < threshold;
}

export interface PreservationInput {
  goal?: string;
  changedFiles?: string[];
  blockers?: string[];
  verification?: string[];
  nextSteps?: string[];
}

/**
 * Build a preservation block to inject into the native compaction prompt so the
 * summary never drops critical JCE-Worker state (goal, touched files, blockers,
 * verification status, next steps). Returns "" when there is nothing durable to
 * preserve.
 */
export function buildCompactionPreservation(input: PreservationInput): string {
  const lines: string[] = [];
  const goal = input.goal?.trim();
  const files = (input.changedFiles ?? []).filter((f) => f && f.trim()).slice(0, 20);
  const blockers = (input.blockers ?? []).filter((b) => b && b.trim()).slice(0, 10);
  const verification = (input.verification ?? []).filter((v) => v && v.trim()).slice(0, 10);
  const nextSteps = (input.nextSteps ?? []).filter((s) => s && s.trim()).slice(0, 10);

  if (goal) lines.push(`- Active goal: ${goal}`);
  if (files.length) lines.push(`- Touched files (preserve): ${files.join(", ")}`);
  if (blockers.length) lines.push(`- Open blockers (do not drop): ${blockers.join("; ")}`);
  if (verification.length) lines.push(`- Verification state: ${verification.join("; ")}`);
  if (nextSteps.length) lines.push(`- Next steps: ${nextSteps.join("; ")}`);

  if (lines.length === 0) return "";
  return [
    "PRESERVE THE FOLLOWING JCE-Worker STATE VERBATIM IN THE SUMMARY (do not omit):",
    ...lines,
  ].join("\n");
}

/**
 * Human-readable one-liner for logging/telemetry.
 */
export function formatUsage(usage: ContextUsage): string {
  const pct = Math.round(usage.usagePercent * 100);
  const limitNote = usage.knownLimit ? "" : " (fallback limit — set limit.context in opencode.json for accuracy)";
  return `Context: ${usage.tokensUsed.toLocaleString()} / ${usage.contextLimit.toLocaleString()} tokens (${pct}%)${limitNote}`;
}
