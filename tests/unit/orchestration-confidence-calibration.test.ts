import { describe, expect, test } from "bun:test";
import { calibrateResultConfidence } from "../../src/plugin/lib/orchestration/confidence-calibration.js";
import type { Evidence } from "../../src/plugin/lib/orchestration/types.js";

const passing: Evidence = { id: "e1", type: "test_result", source: "test", command: "bun test", exitCode: 0, assertions: [{ description: "ok", passed: true }], confidence: 0.9, timestamp: "2026-01-01T00:00:00.000Z" };
const failing: Evidence = { ...passing, id: "e2", exitCode: 1, assertions: [{ description: "fail", passed: false }] };

describe("calibrateResultConfidence", () => {
  test("nudges structured evidence up without exceeding 1", () => {
    expect(calibrateResultConfidence({ baseConfidence: 0.8, agent: "oracle", evidence: [passing], hasStructuredEvidence: true })).toBe(0.85);
    expect(calibrateResultConfidence({ baseConfidence: 0.99, agent: "oracle", evidence: [passing], hasStructuredEvidence: true })).toBe(1);
  });

  test("caps failing evidence below success threshold", () => {
    expect(calibrateResultConfidence({ baseConfidence: 0.95, agent: "oracle", evidence: [failing], hasStructuredEvidence: true })).toBe(0.49);
  });

  test("caps no-evidence results", () => {
    expect(calibrateResultConfidence({ baseConfidence: 0.8, agent: "explorer", evidence: [], hasStructuredEvidence: false })).toBe(0.3);
  });
});
