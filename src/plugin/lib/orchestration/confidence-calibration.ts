import type { AgentRole, Evidence } from "./types.js";
import { calibrateConfidence as bayesianCalibrate, type CalibrationEntry } from "./bayesian-calibration.js";

export interface ConfidenceCalibrationInput {
  baseConfidence: number;
  agent: AgentRole;
  evidence: Evidence[];
  hasStructuredEvidence: boolean;
  /** Optional: learned calibration entries for Bayesian adjustment. */
  calibrationEntries?: CalibrationEntry[];
}

const AGENT_PRIOR: Record<AgentRole, number> = {
  self: 0,
  oracle: 0.02,
  "jce-researcher": 0,
  explorer: -0.02,
  frontend: 0,
  android: 0,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

/**
 * Calibrate confidence from raw parser score using deterministic quality signals
 * AND learned Bayesian calibration when available.
 *
 * Pipeline: raw → fixed priors → evidence signals → Bayesian learned adjustment.
 * The Bayesian layer only activates when sufficient calibration data exists (≥5
 * samples); otherwise it passes through the rule-based score unchanged.
 */
export function calibrateResultConfidence(input: ConfidenceCalibrationInput): number {
  let score = input.baseConfidence + (AGENT_PRIOR[input.agent] ?? 0);
  if (input.hasStructuredEvidence) score += 0.03;
  const hasFailingEvidence = input.evidence.some((ev) => ev.exitCode !== undefined && ev.exitCode !== 0)
    || input.evidence.some((ev) => ev.assertions.some((assertion) => assertion.passed === false));
  if (hasFailingEvidence) score = Math.min(score, 0.49);
  if (input.evidence.length === 0) score = Math.min(score, 0.3);

  // #5 Bayesian Calibration: if learned data is available, apply Platt-style adjustment
  if (input.calibrationEntries && input.calibrationEntries.length >= 5) {
    const bayesian = bayesianCalibrate(input.calibrationEntries, input.agent, score);
    if (bayesian.source === "learned") {
      // Blend: 60% learned + 40% rule-based (conservative transition)
      score = bayesian.calibrated * 0.6 + score * 0.4;
    }
  }

  return clamp(score);
}
