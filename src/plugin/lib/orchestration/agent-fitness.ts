/**
 * Agent Fitness Scoring — Adaptive Delegation Strategies (#6)
 *
 * Tracks per-agent success rates by task category and computes fitness scores
 * to route delegations to the best-performing agent for each intent type.
 *
 * Closes the feedback loop: telemetry → fitness score → delegation routing.
 * Pure module: operates on arrays, returns new arrays / derived stats.
 */

import type { AgentRole, IntentType } from "./types.js";

export type AgentOutcome = "success" | "partial" | "failed";

export interface AgentPerformanceEntry {
  agent: AgentRole;
  intent: IntentType;
  outcome: AgentOutcome;
  /** Claimed confidence at dispatch time (0..1). */
  claimedConfidence?: number;
  /** Actual confidence after evaluation (0..1). */
  actualConfidence?: number;
  /** Retries consumed before outcome. */
  retries?: number;
  /** Token cost (input + output). */
  tokenCost?: number;
  recordedAt: string;
}

export interface AgentFitnessScore {
  agent: AgentRole;
  intent: IntentType;
  attempts: number;
  successes: number;
  successRate: number;
  avgRetries: number;
  avgTokenCost: number;
  /** Composite fitness: success_rate * 0.7 + efficiency * 0.3 */
  fitness: number;
}

export interface AgentRecommendation {
  recommended: AgentRole;
  fitness: number;
  reason: string;
  alternatives: Array<{ agent: AgentRole; fitness: number }>;
}

const MAX_ENTRIES = 500;
const MIN_SAMPLES = 3;

function now(ts?: string): string {
  return ts ?? new Date().toISOString();
}

/**
 * Record an agent's performance on a task.
 */
export function recordAgentPerformance(
  entries: AgentPerformanceEntry[],
  input: Omit<AgentPerformanceEntry, "recordedAt">,
  ts?: string,
): AgentPerformanceEntry[] {
  const list = [...entries];
  list.unshift({ ...input, recordedAt: now(ts) });
  return list.slice(0, MAX_ENTRIES);
}

/**
 * Compute fitness scores for all (agent, intent) combinations.
 */
export function computeAgentFitness(
  entries: AgentPerformanceEntry[],
  intent?: IntentType,
): AgentFitnessScore[] {
  if (!entries || entries.length === 0) return [];
  const filtered = intent ? entries.filter((e) => e.intent === intent) : entries;
  const groups = new Map<string, AgentPerformanceEntry[]>();
  for (const entry of filtered) {
    const key = `${entry.agent}|${entry.intent}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const scores: AgentFitnessScore[] = [];
  for (const [key, group] of groups) {
    const [agent, intentPart] = key.split("|") as [AgentRole, IntentType];
    const attempts = group.length;
    const successes = group.filter((e) => e.outcome === "success").length;
    const successRate = attempts > 0 ? successes / attempts : 0;
    const totalRetries = group.reduce((sum, e) => sum + (e.retries ?? 0), 0);
    const avgRetries = attempts > 0 ? totalRetries / attempts : 0;
    const tokenEntries = group.filter((e) => typeof e.tokenCost === "number" && e.tokenCost > 0);
    const avgTokenCost = tokenEntries.length > 0
      ? tokenEntries.reduce((sum, e) => sum + (e.tokenCost ?? 0), 0) / tokenEntries.length
      : 0;
    // Efficiency: lower retries and lower token cost = better (normalized 0..1)
    const retryEfficiency = Math.max(0, 1 - avgRetries / 5); // 0 retries = 1.0, 5+ = 0
    const fitness = Math.round((successRate * 0.7 + retryEfficiency * 0.3) * 100) / 100;
    scores.push({ agent, intent: intentPart, attempts, successes, successRate: Math.round(successRate * 100) / 100, avgRetries: Math.round(avgRetries * 100) / 100, avgTokenCost: Math.round(avgTokenCost), fitness });
  }
  return scores.sort((a, b) => b.fitness - a.fitness || b.attempts - a.attempts);
}

/**
 * Recommend the best agent for a given intent based on learned performance.
 * Returns the default agent if insufficient data.
 */
export function recommendAgent(
  entries: AgentPerformanceEntry[],
  intent: IntentType,
  defaultAgent: AgentRole,
): AgentRecommendation {
  const scores = computeAgentFitness(entries, intent);
  if (scores.length === 0) {
    return { recommended: defaultAgent, fitness: 0.5, reason: "No performance data; using default agent.", alternatives: [] };
  }

  const leader = scores[0];
  if (leader.attempts < MIN_SAMPLES) {
    return {
      recommended: defaultAgent,
      fitness: 0.5,
      reason: `Insufficient samples (${leader.attempts}/${MIN_SAMPLES}) for ${intent}; using default.`,
      alternatives: scores.map((s) => ({ agent: s.agent, fitness: s.fitness })),
    };
  }

  const alternatives = scores.slice(1).map((s) => ({ agent: s.agent, fitness: s.fitness }));
  return {
    recommended: leader.agent,
    fitness: leader.fitness,
    reason: `${leader.agent} has ${Math.round(leader.successRate * 100)}% success rate on ${intent} (${leader.successes}/${leader.attempts}).`,
    alternatives,
  };
}

/**
 * Determine if the default agent should be overridden based on fitness data.
 * Only overrides when the recommended agent is significantly better.
 */
export function selectAgentWithFitness(
  entries: AgentPerformanceEntry[],
  intent: IntentType,
  defaultAgent: AgentRole,
  overrideThreshold = 0.15,
): { agent: AgentRole; source: "default" | "fitness"; reason: string } {
  const rec = recommendAgent(entries, intent, defaultAgent);
  if (rec.recommended === defaultAgent) {
    return { agent: defaultAgent, source: "default", reason: rec.reason };
  }
  // Only override if the recommended agent's fitness exceeds default's by threshold
  const defaultScore = computeAgentFitness(entries, intent).find((s) => s.agent === defaultAgent);
  const margin = rec.fitness - (defaultScore?.fitness ?? 0.5);
  if (margin >= overrideThreshold) {
    return { agent: rec.recommended, source: "fitness", reason: `Fitness override: ${rec.reason} (margin +${Math.round(margin * 100)}%)` };
  }
  return { agent: defaultAgent, source: "default", reason: `Fitness margin (${Math.round(margin * 100)}%) below threshold (${Math.round(overrideThreshold * 100)}%); keeping default.` };
}
