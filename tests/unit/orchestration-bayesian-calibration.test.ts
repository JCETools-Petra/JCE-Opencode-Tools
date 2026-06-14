import { describe, test, expect } from "bun:test";
import {
  recordCalibrationEntry,
  buildCalibrationProfile,
  calibrateConfidence,
  formatCalibrationProfiles,
  type CalibrationEntry,
} from "../../src/plugin/lib/orchestration/bayesian-calibration.ts";

describe("Bayesian Confidence Calibration (#5)", () => {
  test("recordCalibrationEntry adds entry and caps at max", () => {
    const entries: CalibrationEntry[] = [];
    const result = recordCalibrationEntry(entries, {
      agent: "oracle",
      intent: "bugfix",
      claimedConfidence: 0.8,
      succeeded: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].agent).toBe("oracle");
    expect(result[0].claimedConfidence).toBe(0.8);
  });

  test("buildCalibrationProfile computes ECE correctly", () => {
    // Oracle claims 80% but only succeeds 50% of the time
    const entries: CalibrationEntry[] = Array.from({ length: 10 }, (_, i) => ({
      agent: "oracle" as const,
      intent: "bugfix" as const,
      claimedConfidence: 0.8,
      succeeded: i < 5, // 50% actual success
      recordedAt: `2026-01-${String(i + 1).padStart(2, "0")}`,
    }));
    const profile = buildCalibrationProfile(entries, "oracle");
    expect(profile.totalSamples).toBe(10);
    expect(profile.ece).toBeGreaterThan(0); // miscalibrated
    // The 0.7-0.9 bucket should show ~50% actual rate
    const highBucket = profile.buckets.find((b) => b.center === 0.9);
    expect(highBucket?.count).toBe(10);
    expect(highBucket?.actualRate).toBe(0.5);
  });

  test("calibrateConfidence returns passthrough when insufficient data", () => {
    const entries: CalibrationEntry[] = [
      { agent: "oracle", intent: "bugfix", claimedConfidence: 0.8, succeeded: true, recordedAt: "2026-01-01" },
    ];
    const result = calibrateConfidence(entries, "oracle", 0.8);
    expect(result.source).toBe("passthrough");
    expect(result.calibrated).toBe(0.8);
  });

  test("calibrateConfidence adjusts overconfident agent downward", () => {
    // Oracle claims high confidence but only succeeds ~50%
    const entries: CalibrationEntry[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        agent: "oracle" as const, intent: "bugfix" as const,
        claimedConfidence: 0.3, succeeded: i < 4, // 80% at low confidence
        recordedAt: `2026-01-${String(i + 1).padStart(2, "0")}`,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        agent: "oracle" as const, intent: "bugfix" as const,
        claimedConfidence: 0.8, succeeded: i < 2, // 40% at high confidence
        recordedAt: `2026-01-${String(i + 6).padStart(2, "0")}`,
      })),
    ];
    const result = calibrateConfidence(entries, "oracle", 0.8);
    // Should be adjusted downward since actual success at 0.8 claimed is only 40%
    expect(result.calibrated).toBeLessThan(0.8);
    expect(result.source).toBe("learned");
  });

  test("calibrateConfidence adjusts underconfident agent upward", () => {
    // Explorer claims low confidence but actually succeeds well
    const entries: CalibrationEntry[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        agent: "explorer" as const, intent: "research" as const,
        claimedConfidence: 0.3, succeeded: true, // 100% at low confidence
        recordedAt: `2026-01-${String(i + 1).padStart(2, "0")}`,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        agent: "explorer" as const, intent: "research" as const,
        claimedConfidence: 0.7, succeeded: true, // 100% at high confidence
        recordedAt: `2026-01-${String(i + 6).padStart(2, "0")}`,
      })),
    ];
    const result = calibrateConfidence(entries, "explorer", 0.3);
    // Should be adjusted upward since actual success at 0.3 claimed is 100%
    expect(result.calibrated).toBeGreaterThan(0.3);
    expect(result.source).toBe("learned");
  });

  test("formatCalibrationProfiles renders readable output", () => {
    const entries: CalibrationEntry[] = Array.from({ length: 6 }, (_, i) => ({
      agent: "oracle" as const,
      intent: "bugfix" as const,
      claimedConfidence: 0.7,
      succeeded: i < 4,
      recordedAt: `2026-01-${String(i + 1).padStart(2, "0")}`,
    }));
    const output = formatCalibrationProfiles(entries);
    expect(output).toContain("oracle");
    expect(output).toContain("ECE=");
  });
});
