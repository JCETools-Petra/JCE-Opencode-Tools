import { describe, test, expect } from "bun:test";
import {
  recordAgentPerformance,
  computeAgentFitness,
  recommendAgent,
  selectAgentWithFitness,
  type AgentPerformanceEntry,
} from "../../src/plugin/lib/orchestration/agent-fitness.ts";

describe("Agent Fitness Scoring (#6)", () => {
  const empty: AgentPerformanceEntry[] = [];

  test("recordAgentPerformance adds entry and caps at max", () => {
    const entry = { agent: "oracle" as const, intent: "bugfix" as const, outcome: "success" as const };
    const result = recordAgentPerformance(empty, entry);
    expect(result).toHaveLength(1);
    expect(result[0].agent).toBe("oracle");
    expect(result[0].recordedAt).toBeTruthy();
  });

  test("computeAgentFitness returns empty for no data", () => {
    expect(computeAgentFitness([])).toEqual([]);
  });

  test("computeAgentFitness computes correct success rate", () => {
    const entries: AgentPerformanceEntry[] = [
      { agent: "oracle", intent: "bugfix", outcome: "success", recordedAt: "2026-01-01" },
      { agent: "oracle", intent: "bugfix", outcome: "success", recordedAt: "2026-01-02" },
      { agent: "oracle", intent: "bugfix", outcome: "failed", recordedAt: "2026-01-03" },
      { agent: "explorer", intent: "bugfix", outcome: "success", recordedAt: "2026-01-01" },
      { agent: "explorer", intent: "bugfix", outcome: "failed", recordedAt: "2026-01-02" },
      { agent: "explorer", intent: "bugfix", outcome: "failed", recordedAt: "2026-01-03" },
    ];
    const scores = computeAgentFitness(entries, "bugfix");
    const oracle = scores.find((s) => s.agent === "oracle")!;
    const explorer = scores.find((s) => s.agent === "explorer")!;
    expect(oracle.successRate).toBe(0.67);
    expect(oracle.attempts).toBe(3);
    expect(explorer.successRate).toBe(0.33);
    // Oracle should have higher fitness
    expect(oracle.fitness).toBeGreaterThan(explorer.fitness);
  });

  test("recommendAgent returns default when insufficient data", () => {
    const entries: AgentPerformanceEntry[] = [
      { agent: "oracle", intent: "bugfix", outcome: "success", recordedAt: "2026-01-01" },
    ];
    const rec = recommendAgent(entries, "bugfix", "explorer");
    expect(rec.recommended).toBe("explorer"); // default, not enough samples
  });

  test("recommendAgent returns best agent when enough data", () => {
    const entries: AgentPerformanceEntry[] = [
      { agent: "oracle", intent: "bugfix", outcome: "success", recordedAt: "2026-01-01" },
      { agent: "oracle", intent: "bugfix", outcome: "success", recordedAt: "2026-01-02" },
      { agent: "oracle", intent: "bugfix", outcome: "success", recordedAt: "2026-01-03" },
      { agent: "explorer", intent: "bugfix", outcome: "failed", recordedAt: "2026-01-01" },
      { agent: "explorer", intent: "bugfix", outcome: "failed", recordedAt: "2026-01-02" },
      { agent: "explorer", intent: "bugfix", outcome: "failed", recordedAt: "2026-01-03" },
    ];
    const rec = recommendAgent(entries, "bugfix", "explorer");
    expect(rec.recommended).toBe("oracle");
    expect(rec.fitness).toBeGreaterThan(0.5);
  });

  test("selectAgentWithFitness overrides default when margin is significant", () => {
    const entries: AgentPerformanceEntry[] = [
      ...Array.from({ length: 5 }, () => ({ agent: "oracle" as const, intent: "review" as const, outcome: "success" as const, recordedAt: "2026-01-01" })),
      ...Array.from({ length: 5 }, () => ({ agent: "explorer" as const, intent: "review" as const, outcome: "failed" as const, recordedAt: "2026-01-01" })),
    ];
    const result = selectAgentWithFitness(entries, "review", "explorer");
    expect(result.agent).toBe("oracle");
    expect(result.source).toBe("fitness");
  });

  test("selectAgentWithFitness keeps default when margin is small", () => {
    const entries: AgentPerformanceEntry[] = [
      { agent: "oracle", intent: "review", outcome: "success", recordedAt: "2026-01-01" },
      { agent: "oracle", intent: "review", outcome: "failed", recordedAt: "2026-01-02" },
      { agent: "oracle", intent: "review", outcome: "success", recordedAt: "2026-01-03" },
      { agent: "explorer", intent: "review", outcome: "success", recordedAt: "2026-01-01" },
      { agent: "explorer", intent: "review", outcome: "failed", recordedAt: "2026-01-02" },
      { agent: "explorer", intent: "review", outcome: "success", recordedAt: "2026-01-03" },
    ];
    const result = selectAgentWithFitness(entries, "review", "explorer");
    expect(result.agent).toBe("explorer"); // similar performance, keep default
    expect(result.source).toBe("default");
  });
});
