import { describe, expect, test } from "bun:test";
import {
  resolveContextLimit,
  extractTokensUsed,
  computeUsage,
  shouldAutoCompact,
  crossedThreshold,
  buildCompactionPreservation,
  formatUsage,
  DEFAULT_COMPACTION_THRESHOLD,
  FALLBACK_CONTEXT_LIMIT,
} from "../../src/plugin/lib/context-window-monitor.js";

describe("context-window-monitor: resolveContextLimit", () => {
  test("uses model limit when positive", () => {
    const r = resolveContextLimit(1_000_000);
    expect(r.limit).toBe(1_000_000);
    expect(r.source).toBe("model");
    expect(r.known).toBe(true);
  });

  test("falls back to conservative default when limit is 0/undefined/garbage", () => {
    for (const bad of [0, undefined, null, -5, NaN, Infinity]) {
      const r = resolveContextLimit(bad as any);
      expect(r.limit).toBe(FALLBACK_CONTEXT_LIMIT);
      expect(r.source).toBe("fallback");
      expect(r.known).toBe(false);
    }
  });
});

describe("context-window-monitor: extractTokensUsed", () => {
  test("sums input + cache.read tokens", () => {
    const msg = { tokens: { input: 100000, output: 500, reasoning: 0, cache: { read: 12000, write: 0 } } };
    expect(extractTokensUsed(msg)).toBe(112000);
  });

  test("defensive against missing/garbage shapes", () => {
    expect(extractTokensUsed(null)).toBe(0);
    expect(extractTokensUsed({})).toBe(0);
    expect(extractTokensUsed({ tokens: {} })).toBe(0);
    expect(extractTokensUsed({ tokens: { input: "x" as any } })).toBe(0);
    expect(extractTokensUsed({ tokens: { input: 50 } })).toBe(50);
  });
});

describe("context-window-monitor: computeUsage", () => {
  test("computes percent against a known 1M limit", () => {
    const u = computeUsage(830_000, 1_000_000);
    expect(u.usagePercent).toBe(0.83);
    expect(u.knownLimit).toBe(true);
    expect(u.limitSource).toBe("model");
  });

  test("uses fallback limit when model limit unknown", () => {
    const u = computeUsage(64_000, 0);
    expect(u.contextLimit).toBe(FALLBACK_CONTEXT_LIMIT);
    expect(u.knownLimit).toBe(false);
    expect(u.usagePercent).toBe(0.5);
  });

  test("clamps over-limit usage to 1.0", () => {
    expect(computeUsage(2_000_000, 1_000_000).usagePercent).toBe(1);
  });
});

describe("context-window-monitor: thresholds", () => {
  test("default threshold is 0.83", () => {
    expect(DEFAULT_COMPACTION_THRESHOLD).toBe(0.83);
  });

  test("shouldAutoCompact fires at/after 83%", () => {
    expect(shouldAutoCompact(computeUsage(829_000, 1_000_000))).toBe(false);
    expect(shouldAutoCompact(computeUsage(830_000, 1_000_000))).toBe(true);
    expect(shouldAutoCompact(computeUsage(950_000, 1_000_000))).toBe(true);
  });

  test("crossedThreshold fires only on upward crossing (once per crossing)", () => {
    // below -> above: fire
    expect(crossedThreshold(0.80, 0.84)).toBe(true);
    // already above -> still above: do NOT fire again
    expect(crossedThreshold(0.85, 0.90)).toBe(false);
    // below -> below: no
    expect(crossedThreshold(0.50, 0.70)).toBe(false);
    // undefined previous (first reading) already above: fire
    expect(crossedThreshold(undefined, 0.90)).toBe(true);
  });
});

describe("context-window-monitor: buildCompactionPreservation", () => {
  test("builds a preservation block from durable state", () => {
    const text = buildCompactionPreservation({
      goal: "ship auto-compaction",
      changedFiles: ["a.ts", "b.ts"],
      blockers: ["waiting on review"],
      verification: ["typecheck pass"],
      nextSteps: ["wire hook"],
    });
    expect(text).toContain("PRESERVE THE FOLLOWING");
    expect(text).toContain("ship auto-compaction");
    expect(text).toContain("a.ts, b.ts");
    expect(text).toContain("waiting on review");
    expect(text).toContain("typecheck pass");
  });

  test("returns empty string when there is nothing durable", () => {
    expect(buildCompactionPreservation({})).toBe("");
    expect(buildCompactionPreservation({ changedFiles: ["", "  "], blockers: [] })).toBe("");
  });

  test("caps list sizes to keep the block bounded", () => {
    const manyFiles = Array.from({ length: 50 }, (_, i) => `f${i}.ts`);
    const text = buildCompactionPreservation({ goal: "g", changedFiles: manyFiles });
    expect(text).toContain("f0.ts");
    expect(text).not.toContain("f25.ts"); // capped at 20
  });
});

describe("context-window-monitor: formatUsage", () => {
  test("known limit has no fallback note", () => {
    expect(formatUsage(computeUsage(830_000, 1_000_000))).not.toContain("fallback limit");
  });
  test("unknown limit warns to set limit.context", () => {
    expect(formatUsage(computeUsage(64_000, 0))).toContain("set limit.context");
  });
});
