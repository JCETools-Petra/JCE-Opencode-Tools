/**
 * Bayesian Confidence Calibration (#5)
 *
 * Tracks (agent, intent, claimed_confidence, actual_outcome) tuples and learns
 * calibration curves per agent. Applies Platt-style scaling to raw confidence
 * scores so the system's claimed confidence matches actual reliability.
 *
 * Example: if oracle claims 80% confidence on bugfix but actually succeeds 65%
 * of the time, the calibrated score becomes ~0.65.
 *
 * Pure module: operates on arrays, returns calibrated scores.
 */

import type { AgentRole, IntentType } from "./types.js";

export interface CalibrationEntry {
  agent: AgentRole;
  intent: IntentType;
  /** Raw confidence claimed at dispatch/completion (0..1). */
  claimedConfidence: number;
  /** Whether the task actually succeeded. */
  succeeded: boolean;
  recordedAt: string;
}

export interface CalibrationBucket {
  /** Confidence range center (e.g., 0.3, 0.5, 0.7, 0.9). */
  center: number;
  /** Number of observations in this bucket. */
  count: number;
  /** Actual success rate in this bucket. */
  actualRate: number;
}

export interface CalibrationProfile {
  agent: AgentRole;
  totalSamples: number;
  buckets: CalibrationBucket[];
  /** Overall calibration error (lower = better calibrated). */
  ece: number;
}

const MAX_ENTRIES = 1000;
const BUCKET_CENTERS = [0.1, 0.3, 0.5, 0.7, 0.9];
const BUCKET_WIDTH = 0.2;
const MIN_BUCKET_SAMPLES = 2;

function now(ts?: string): string {
  return ts ?? new Date().toISOString();
}

/**
 * Record a calibration observation.
 */
export function recordCalibrationEntry(
  entries: CalibrationEntry[],
  input: Omit<CalibrationEntry, "recordedAt">,
  ts?: string,
): CalibrationEntry[] {
  const list = [...entries];
  list.unshift({ ...input, recordedAt: now(ts) });
  return list.slice(0, MAX_ENTRIES);
}

/**
 * Build calibration buckets for an agent. Each bucket shows the actual success
 * rate for a range of claimed confidence values.
 */
export function buildCalibrationProfile(
  entries: CalibrationEntry[],
  agent: AgentRole,
): CalibrationProfile {
  const agentEntries = entries.filter((e) => e.agent === agent);
  const buckets: CalibrationBucket[] = BUCKET_CENTERS.map((center) => {
    const low = center - BUCKET_WIDTH / 2;
    const high = center + BUCKET_WIDTH / 2;
    const inBucket = agentEntries.filter((e) => e.claimedConfidence >= low && e.claimedConfidence < high);
    const count = inBucket.length;
    const successes = inBucket.filter((e) => e.succeeded).length;
    return { center, count, actualRate: count > 0 ? successes / count : center };
  });

  // Expected Calibration Error (ECE): weighted average of |actual - claimed| per bucket
  const totalSamples = agentEntries.length;
  let ece = 0;
  for (const bucket of buckets) {
    if (bucket.count > 0) {
      ece += (bucket.count / totalSamples) * Math.abs(bucket.actualRate - bucket.center);
    }
  }

  return { agent, totalSamples, buckets, ece: Math.round(ece * 1000) / 1000 };
}

/**
 * Apply Platt-style calibration to a raw confidence score.
 * Uses linear interpolation between calibration buckets.
 *
 * If insufficient data, returns the raw score unchanged.
 */
export function calibrateConfidence(
  entries: CalibrationEntry[],
  agent: AgentRole,
  rawConfidence: number,
): { calibrated: number; source: "learned" | "passthrough"; profile?: CalibrationProfile } {
  const profile = buildCalibrationProfile(entries, agent);

  // Need minimum data to calibrate
  if (profile.totalSamples < 5) {
    return { calibrated: rawConfidence, source: "passthrough" };
  }

  // Find the two nearest buckets with enough samples for interpolation
  const validBuckets = profile.buckets.filter((b) => b.count >= MIN_BUCKET_SAMPLES);
  if (validBuckets.length < 2) {
    return { calibrated: rawConfidence, source: "passthrough" };
  }

  // Linear interpolation between nearest buckets
  const clamped = Math.max(0, Math.min(1, rawConfidence));
  let lower = validBuckets[0];
  let upper = validBuckets[validBuckets.length - 1];

  for (let i = 0; i < validBuckets.length - 1; i++) {
    if (clamped >= validBuckets[i].center && clamped <= validBuckets[i + 1].center) {
      lower = validBuckets[i];
      upper = validBuckets[i + 1];
      break;
    }
  }

  // Edge cases: below lowest or above highest bucket
  if (clamped <= lower.center) {
    return { calibrated: Math.round(lower.actualRate * 100) / 100, source: "learned", profile };
  }
  if (clamped >= upper.center) {
    return { calibrated: Math.round(upper.actualRate * 100) / 100, source: "learned", profile };
  }

  // Interpolate
  const t = (clamped - lower.center) / (upper.center - lower.center);
  const calibrated = lower.actualRate + t * (upper.actualRate - lower.actualRate);
  return { calibrated: Math.round(Math.max(0, Math.min(1, calibrated)) * 100) / 100, source: "learned", profile };
}

/**
 * Format calibration profiles for display.
 */
export function formatCalibrationProfiles(entries: CalibrationEntry[]): string {
  const agents = [...new Set(entries.map((e) => e.agent))];
  if (agents.length === 0) return "No calibration data recorded.";

  const lines: string[] = ["Agent Confidence Calibration:"];
  for (const agent of agents) {
    const profile = buildCalibrationProfile(entries, agent);
    const bucketStr = profile.buckets
      .filter((b) => b.count > 0)
      .map((b) => `${Math.round(b.center * 100)}%→${Math.round(b.actualRate * 100)}%`)
      .join(", ");
    lines.push(`  ${agent}: ECE=${profile.ece} (${profile.totalSamples} samples) [${bucketStr}]`);
  }
  return lines.join("\n");
}
