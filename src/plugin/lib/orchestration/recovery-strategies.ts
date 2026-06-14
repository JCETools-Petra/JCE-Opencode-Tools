/**
 * Autonomous Error Recovery Patterns (#11)
 *
 * Replaces simple retry-with-narrowed-scope with a pattern library of recovery
 * strategies. Instead of retrying the same prompt with failure context appended,
 * this selects a structurally different recovery approach based on failure class.
 *
 * Strategies:
 * - retry_refined: Same approach with more specific constraints (current behavior)
 * - decompose: Break the failing task into smaller sub-tasks
 * - alternative_approach: Try a fundamentally different method
 * - add_diagnostics: Gather more information before retrying
 * - rollback_and_pivot: Undo changes and try orthogonal path
 * - escalate_agent: Route to a more capable agent
 *
 * Tracks strategy success rates to learn which recovery works for which errors.
 */

import type { AgentRole, IntentType } from "./types.js";
import type { JceWorkerErrorCategory } from "../error-taxonomy.js";

export type RecoveryStrategy =
  | "retry_refined"
  | "decompose"
  | "alternative_approach"
  | "add_diagnostics"
  | "rollback_and_pivot"
  | "escalate_agent";

export interface RecoveryStrategyEntry {
  errorCategory: JceWorkerErrorCategory;
  intent: IntentType;
  strategy: RecoveryStrategy;
  succeeded: boolean;
  recordedAt: string;
}

export interface RecoveryStrategyScore {
  strategy: RecoveryStrategy;
  attempts: number;
  successes: number;
  successRate: number;
}

export interface RecoveryPlan {
  strategy: RecoveryStrategy;
  reason: string;
  promptModification: string;
  agentOverride?: AgentRole;
  decomposedSteps?: string[];
}

const MAX_ENTRIES = 300;

// Default strategy mapping: error category → ordered list of strategies to try
const DEFAULT_STRATEGY_MAP: Record<JceWorkerErrorCategory, RecoveryStrategy[]> = {
  transient_network: ["retry_refined", "add_diagnostics"],
  tool_failure: ["retry_refined", "alternative_approach", "decompose"],
  delegated_contract_failure: ["retry_refined", "escalate_agent", "decompose"],
  verification_failed: ["add_diagnostics", "decompose", "alternative_approach"],
  missing_access: ["escalate_agent"],
  user_approval_required: ["escalate_agent"],
  merge_conflict: ["rollback_and_pivot"],
  ambiguous_requirement: ["add_diagnostics", "decompose"],
  unknown: ["retry_refined", "add_diagnostics", "alternative_approach"],
};

function now(ts?: string): string {
  return ts ?? new Date().toISOString();
}

/**
 * Record a recovery strategy outcome.
 */
export function recordRecoveryOutcome(
  entries: RecoveryStrategyEntry[],
  input: Omit<RecoveryStrategyEntry, "recordedAt">,
  ts?: string,
): RecoveryStrategyEntry[] {
  const list = [...entries];
  list.unshift({ ...input, recordedAt: now(ts) });
  return list.slice(0, MAX_ENTRIES);
}

/**
 * Compute success rates for each strategy given an error category.
 */
export function computeRecoveryStats(
  entries: RecoveryStrategyEntry[],
  errorCategory: JceWorkerErrorCategory,
): RecoveryStrategyScore[] {
  const relevant = entries.filter((e) => e.errorCategory === errorCategory);
  const groups = new Map<RecoveryStrategy, RecoveryStrategyEntry[]>();
  for (const entry of relevant) {
    const group = groups.get(entry.strategy) ?? [];
    group.push(entry);
    groups.set(entry.strategy, group);
  }

  const scores: RecoveryStrategyScore[] = [];
  for (const [strategy, group] of groups) {
    const attempts = group.length;
    const successes = group.filter((e) => e.succeeded).length;
    scores.push({
      strategy,
      attempts,
      successes,
      successRate: attempts > 0 ? Math.round((successes / attempts) * 100) / 100 : 0,
    });
  }
  return scores.sort((a, b) => b.successRate - a.successRate || b.attempts - a.attempts);
}

/**
 * Select the best recovery strategy for a given error, using learned outcomes
 * when available, falling back to the default strategy map.
 */
export function selectRecoveryStrategy(
  entries: RecoveryStrategyEntry[],
  errorCategory: JceWorkerErrorCategory,
  intent: IntentType,
  retryAttempt: number,
  currentAgent: AgentRole,
): RecoveryPlan {
  const stats = computeRecoveryStats(entries, errorCategory);
  const defaults = DEFAULT_STRATEGY_MAP[errorCategory] ?? DEFAULT_STRATEGY_MAP.unknown;

  // If we have learned data with good success rates, prefer that
  const learnedBest = stats.find((s) => s.attempts >= 3 && s.successRate >= 0.5);

  // Select strategy: learned > default sequence (indexed by retry attempt)
  const strategy = learnedBest
    ? learnedBest.strategy
    : defaults[Math.min(retryAttempt, defaults.length - 1)] ?? "retry_refined";

  return buildRecoveryPlan(strategy, errorCategory, intent, retryAttempt, currentAgent);
}

/**
 * Build a concrete recovery plan with prompt modifications and optional agent override.
 */
function buildRecoveryPlan(
  strategy: RecoveryStrategy,
  errorCategory: JceWorkerErrorCategory,
  intent: IntentType,
  retryAttempt: number,
  currentAgent: AgentRole,
): RecoveryPlan {
  switch (strategy) {
    case "retry_refined":
      return {
        strategy,
        reason: `Retry with refined constraints (attempt ${retryAttempt + 1}).`,
        promptModification: [
          "## Recovery: Refined Retry",
          `Previous attempt failed (${errorCategory}). Constraints for this retry:`,
          "- Focus on the EXACT failure point, do not redo successful work.",
          "- If the same approach fails again, report it as blocked instead of retrying.",
          "- Provide explicit evidence of what was tried and why it failed.",
        ].join("\n"),
      };

    case "decompose":
      return {
        strategy,
        reason: `Decompose into smaller steps — the full task is too complex for a single pass.`,
        promptModification: [
          "## Recovery: Decompose",
          `Previous attempt failed (${errorCategory}). The task is too complex for one pass.`,
          "- Break this into the SMALLEST possible first step that can succeed independently.",
          "- Complete ONLY that first step and verify it before proceeding.",
          "- Report remaining steps as next actions, do not attempt them yet.",
        ].join("\n"),
        decomposedSteps: ["Identify smallest independent first step", "Execute and verify first step only", "Report remaining steps"],
      };

    case "alternative_approach":
      return {
        strategy,
        reason: `Try a fundamentally different approach — the current method is not working.`,
        promptModification: [
          "## Recovery: Alternative Approach",
          `Previous approach failed (${errorCategory}). Do NOT retry the same method.`,
          "- Identify WHY the previous approach failed structurally (not just the error).",
          "- Choose a fundamentally different technique to achieve the same goal.",
          "- If the goal was to edit code, try a different edit strategy.",
          "- If the goal was to find information, try different search terms or files.",
        ].join("\n"),
      };

    case "add_diagnostics":
      return {
        strategy,
        reason: `Gather diagnostic information before retrying — need more context.`,
        promptModification: [
          "## Recovery: Add Diagnostics",
          `Previous attempt failed (${errorCategory}). Before retrying, gather information:`,
          "- Read the relevant source files around the failure point.",
          "- Check related test files for expected behavior.",
          "- Run diagnostic commands (typecheck, focused test, git status) to understand current state.",
          "- Only after understanding the full picture, attempt the fix.",
        ].join("\n"),
      };

    case "rollback_and_pivot":
      return {
        strategy,
        reason: `Rollback changes and try an orthogonal path.`,
        promptModification: [
          "## Recovery: Rollback and Pivot",
          `Previous changes caused issues (${errorCategory}). Undo and try differently:`,
          "- First, revert any changes made in the failed attempt.",
          "- Verify the codebase is back to a clean state.",
          "- Then try an entirely different approach to the original goal.",
          "- Do NOT build on top of the failed changes.",
        ].join("\n"),
      };

    case "escalate_agent":
      return {
        strategy,
        reason: `Escalate to a more capable agent for this task type.`,
        promptModification: [
          "## Recovery: Escalated",
          `Previous agent could not complete this (${errorCategory}).`,
          "- This task has been escalated to a specialist agent.",
          "- Review the prior attempt's evidence and avoid repeating the same mistakes.",
          "- Apply deeper analysis appropriate to your specialization.",
        ].join("\n"),
        agentOverride: selectEscalationAgent(currentAgent, intent),
      };
  }
}

/**
 * Select which agent to escalate to based on current agent and intent.
 */
function selectEscalationAgent(current: AgentRole, intent: IntentType): AgentRole {
  // Escalation chain: explorer → oracle, frontend → oracle, self → oracle
  if (current === "explorer" || current === "frontend" || current === "self") return "oracle";
  if (current === "jce-researcher") return "oracle";
  // Oracle is already the top — escalate to self (user-facing agent)
  if (current === "oracle") return "self";
  return "oracle";
}

/**
 * Format recovery stats for display.
 */
export function formatRecoveryStats(entries: RecoveryStrategyEntry[]): string {
  if (entries.length === 0) return "No recovery data recorded.";
  const categories = [...new Set(entries.map((e) => e.errorCategory))];
  const lines: string[] = ["Recovery Strategy Performance:"];
  for (const cat of categories) {
    const stats = computeRecoveryStats(entries, cat);
    if (stats.length === 0) continue;
    const statStr = stats.map((s) => `${s.strategy}=${Math.round(s.successRate * 100)}%(${s.attempts})`).join(", ");
    lines.push(`  ${cat}: ${statStr}`);
  }
  return lines.join("\n");
}
