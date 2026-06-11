import type { AgentRole, Evidence } from "./types.js";

export interface ConfidenceCalibrationInput {
  baseConfidence: number;
  agent: AgentRole;
  evidence: Evidence[];
  hasStructuredEvidence: boolean;
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
 * Calibrate confidence from raw parser score using deterministic quality signals.
 * This is intentionally conservative: it nudges scores instead of replacing
 * evidence-based gating, and can later be fed by telemetry-derived priors.
 */
export function calibrateResultConfidence(input: ConfidenceCalibrationInput): number {
  let score = input.baseConfidence + (AGENT_PRIOR[input.agent] ?? 0);
  if (input.hasStructuredEvidence) score += 0.03;
  const hasFailingEvidence = input.evidence.some((ev) => ev.exitCode !== undefined && ev.exitCode !== 0)
    || input.evidence.some((ev) => ev.assertions.some((assertion) => assertion.passed === false));
  if (hasFailingEvidence) score = Math.min(score, 0.49);
  if (input.evidence.length === 0) score = Math.min(score, 0.3);
  return clamp(score);
}
