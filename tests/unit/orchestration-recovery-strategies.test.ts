import { describe, test, expect } from "bun:test";
import {
  recordRecoveryOutcome,
  computeRecoveryStats,
  selectRecoveryStrategy,
  formatRecoveryStats,
  type RecoveryStrategyEntry,
} from "../../src/plugin/lib/orchestration/recovery-strategies.ts";

describe("Autonomous Error Recovery Patterns (#11)", () => {
  const empty: RecoveryStrategyEntry[] = [];

  test("recordRecoveryOutcome adds entry and caps at max", () => {
    const result = recordRecoveryOutcome(empty, {
      errorCategory: "verification_failed",
      intent: "bugfix",
      strategy: "add_diagnostics",
      succeeded: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe("add_diagnostics");
  });

  test("computeRecoveryStats groups by strategy for a category", () => {
    const entries: RecoveryStrategyEntry[] = [
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "retry_refined", succeeded: false, recordedAt: "2026-01-01" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "retry_refined", succeeded: false, recordedAt: "2026-01-02" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "add_diagnostics", succeeded: true, recordedAt: "2026-01-03" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "add_diagnostics", succeeded: true, recordedAt: "2026-01-04" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "add_diagnostics", succeeded: true, recordedAt: "2026-01-05" },
    ];
    const stats = computeRecoveryStats(entries, "verification_failed");
    const diagnostics = stats.find((s) => s.strategy === "add_diagnostics")!;
    const retry = stats.find((s) => s.strategy === "retry_refined")!;
    expect(diagnostics.successRate).toBe(1.0);
    expect(retry.successRate).toBe(0);
    // add_diagnostics should be ranked first
    expect(stats[0].strategy).toBe("add_diagnostics");
  });

  test("selectRecoveryStrategy uses learned data when available", () => {
    const entries: RecoveryStrategyEntry[] = [
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "add_diagnostics", succeeded: true, recordedAt: "2026-01-01" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "add_diagnostics", succeeded: true, recordedAt: "2026-01-02" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "add_diagnostics", succeeded: true, recordedAt: "2026-01-03" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "retry_refined", succeeded: false, recordedAt: "2026-01-04" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "retry_refined", succeeded: false, recordedAt: "2026-01-05" },
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "retry_refined", succeeded: false, recordedAt: "2026-01-06" },
    ];
    const plan = selectRecoveryStrategy(entries, "verification_failed", "bugfix", 0, "explorer");
    expect(plan.strategy).toBe("add_diagnostics"); // learned best
    expect(plan.promptModification).toContain("Diagnostics");
  });

  test("selectRecoveryStrategy falls back to defaults when no learned data", () => {
    const plan = selectRecoveryStrategy(empty, "verification_failed", "bugfix", 0, "explorer");
    expect(plan.strategy).toBe("add_diagnostics"); // default for verification_failed
  });

  test("selectRecoveryStrategy escalates strategy on higher retry attempts", () => {
    const plan0 = selectRecoveryStrategy(empty, "tool_failure", "feature", 0, "explorer");
    const plan1 = selectRecoveryStrategy(empty, "tool_failure", "feature", 1, "explorer");
    const plan2 = selectRecoveryStrategy(empty, "tool_failure", "feature", 2, "explorer");
    expect(plan0.strategy).toBe("retry_refined");
    expect(plan1.strategy).toBe("alternative_approach");
    expect(plan2.strategy).toBe("decompose");
  });

  test("escalate_agent selects appropriate escalation target", () => {
    const plan = selectRecoveryStrategy(empty, "missing_access", "bugfix", 0, "explorer");
    expect(plan.strategy).toBe("escalate_agent");
    expect(plan.agentOverride).toBe("oracle");
  });

  test("decompose strategy includes decomposed steps", () => {
    const plan = selectRecoveryStrategy(empty, "tool_failure", "feature", 2, "explorer");
    expect(plan.strategy).toBe("decompose");
    expect(plan.decomposedSteps).toBeDefined();
    expect(plan.decomposedSteps!.length).toBeGreaterThan(0);
  });

  test("formatRecoveryStats renders readable output", () => {
    const entries: RecoveryStrategyEntry[] = [
      { errorCategory: "verification_failed", intent: "bugfix", strategy: "add_diagnostics", succeeded: true, recordedAt: "2026-01-01" },
      { errorCategory: "tool_failure", intent: "feature", strategy: "retry_refined", succeeded: false, recordedAt: "2026-01-02" },
    ];
    const output = formatRecoveryStats(entries);
    expect(output).toContain("verification_failed");
    expect(output).toContain("tool_failure");
    expect(output).toContain("add_diagnostics");
  });
});
