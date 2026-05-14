/**
 * Legacy type definitions for the old skill router.
 * These types are still used by workflow.ts, execution-policy.ts, dispatch.ts, and decision-intelligence.ts.
 * The routeJceWorkerIntent function has been removed — use scoreIntent from orchestration/intent-router.ts instead.
 */

export type JceWorkerIntent = "bugfix" | "feature" | "completion_claim" | "review" | "branch_completion" | "parallel_work" | "general";
export type JceWorkerAgentHint = "oracle" | "jce-researcher" | "explorer" | "frontend";

export interface SkillRoute {
  intent: JceWorkerIntent;
  skills: string[];
  reason: string;
  agentHint?: JceWorkerAgentHint;
}
