/**
 * Orchestration Reliability — Production-grade robustness layer
 * 
 * Implements all 10 reliability enhancements:
 * 1. Error boundaries (graceful fallback)
 * 2. Plan cancellation
 * 3. Rate limiting (auto-activation cooldown)
 * 4. Per-node timeout enforcement
 * 5. Plan approval gate
 * 6. Conflict detection (file locks)
 * 7. Token budget tracking
 * 8. Rollback/compensation
 * 9. Structured logging
 * 10. Health self-check
 */

import type { TaskGraph, TaskNode, Artifact } from "./types.js";
import { getGraphStats, getRunningNodes } from "./task-graph.js";

// ─── 1. Error Boundaries ──────────────────────────────────────────────────────

/**
 * Wrap an orchestration function call with error boundary.
 * On failure, returns fallback value and logs the error.
 */
export function withErrorBoundary<T>(fn: () => T, fallback: T, logger?: OrchestrationLogger): T {
  try {
    return fn();
  } catch (err) {
    logger?.log("error", "orchestration.error_boundary", err instanceof Error ? err.message : String(err), { stack: err instanceof Error ? err.stack : undefined });
    return fallback;
  }
}

/**
 * Async version of error boundary.
 */
export async function withAsyncErrorBoundary<T>(fn: () => Promise<T>, fallback: T, logger?: OrchestrationLogger): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger?.log("error", "orchestration.error_boundary_async", err instanceof Error ? err.message : String(err), { stack: err instanceof Error ? err.stack : undefined });
    return fallback;
  }
}

// ─── 2. Plan Cancellation ─────────────────────────────────────────────────────

export interface CancellationResult {
  cancelled: boolean;
  nodesAffected: number;
  reason: string;
}

/**
 * Cancel an active orchestration plan.
 * Marks all non-terminal nodes as cancelled.
 */
export function cancelPlan(graph: TaskGraph, reason = "User cancelled"): { graph: TaskGraph; result: CancellationResult } {
  let affected = 0;
  const next: TaskGraph = {
    ...graph,
    nodes: new Map(graph.nodes),
    edges: [...graph.edges],
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  };

  for (const [id, node] of next.nodes) {
    if (node.status !== "done" && node.status !== "cancelled" && node.status !== "failed") {
      next.nodes.set(id, { ...node, status: "cancelled", completedAt: new Date().toISOString(), failureReason: reason });
      affected++;
    }
  }

  return {
    graph: next,
    result: { cancelled: true, nodesAffected: affected, reason },
  };
}

// ─── 3. Rate Limiting ─────────────────────────────────────────────────────────

export interface RateLimiter {
  canActivate(): boolean;
  recordActivation(): void;
  reset(): void;
  getState(): RateLimiterState;
}

export interface RateLimiterState {
  activationsThisSession: number;
  lastActivationAt: string | null;
  cooldownUntil: string | null;
  isInCooldown: boolean;
}

export interface RateLimiterConfig {
  maxActivationsPerSession: number;
  cooldownMs: number;
  now?: () => string;
}

const DEFAULT_RATE_CONFIG: RateLimiterConfig = {
  maxActivationsPerSession: 3,
  cooldownMs: 60_000, // 1 minute between auto-activations
};

export function createRateLimiter(config: Partial<RateLimiterConfig> = {}): RateLimiter {
  const cfg = { ...DEFAULT_RATE_CONFIG, ...config };
  const now = cfg.now ?? (() => new Date().toISOString());
  let activations = 0;
  let lastActivationAt: string | null = null;
  let cooldownUntil: string | null = null;

  return {
    canActivate(): boolean {
      if (activations >= cfg.maxActivationsPerSession) return false;
      if (cooldownUntil && Date.parse(now()) < Date.parse(cooldownUntil)) return false;
      return true;
    },
    recordActivation(): void {
      activations++;
      lastActivationAt = now();
      cooldownUntil = new Date(Date.parse(now()) + cfg.cooldownMs).toISOString();
    },
    reset(): void {
      activations = 0;
      lastActivationAt = null;
      cooldownUntil = null;
    },
    getState(): RateLimiterState {
      return {
        activationsThisSession: activations,
        lastActivationAt,
        cooldownUntil,
        isInCooldown: cooldownUntil !== null && Date.parse(now()) < Date.parse(cooldownUntil),
      };
    },
  };
}

// ─── 4. Per-Node Timeout ──────────────────────────────────────────────────────

export interface NodeTimeoutConfig {
  defaultTimeoutMs: number;
  timeoutByType: Record<string, number>;
}

const DEFAULT_TIMEOUT_CONFIG: NodeTimeoutConfig = {
  defaultTimeoutMs: 5 * 60 * 1000, // 5 minutes
  timeoutByType: {
    research: 10 * 60 * 1000,  // 10 min for research
    code: 8 * 60 * 1000,       // 8 min for code
    review: 7 * 60 * 1000,     // 7 min for review
    verify: 3 * 60 * 1000,     // 3 min for verification
    shell: 2 * 60 * 1000,      // 2 min for shell commands
    plan: 3 * 60 * 1000,       // 3 min for planning
    config: 2 * 60 * 1000,     // 2 min for config
  },
};

/**
 * Check for timed-out nodes and return their IDs.
 */
export function detectTimedOutNodes(graph: TaskGraph, config: NodeTimeoutConfig = DEFAULT_TIMEOUT_CONFIG, now?: string): TaskNode[] {
  const nowMs = Date.parse(now ?? new Date().toISOString());
  const running = getRunningNodes(graph);
  const timedOut: TaskNode[] = [];

  for (const node of running) {
    if (!node.startedAt) continue;
    const startMs = Date.parse(node.startedAt);
    const timeout = config.timeoutByType[node.type] ?? config.defaultTimeoutMs;
    if (nowMs - startMs > timeout) {
      timedOut.push(node);
    }
  }

  return timedOut;
}

// ─── 5. Plan Approval Gate ────────────────────────────────────────────────────

export interface ApprovalGateResult {
  requiresApproval: boolean;
  reason: string;
  planSummary: string;
  riskLevel: "low" | "medium" | "high";
}

/**
 * Determine if a plan requires user approval before execution.
 * High-complexity or high-risk plans need explicit "go ahead".
 */
export function evaluateApprovalGate(graph: TaskGraph, complexityScore: number): ApprovalGateResult {
  const stats = getGraphStats(graph);
  const nodes = Array.from(graph.nodes.values());

  // Risk assessment
  let riskLevel: "low" | "medium" | "high" = "low";
  const reasons: string[] = [];

  // Many nodes = higher risk
  if (stats.total >= 6) { riskLevel = "high"; reasons.push(`${stats.total} nodes (large plan)`); }
  else if (stats.total >= 4) { riskLevel = "medium"; reasons.push(`${stats.total} nodes`); }

  // High complexity score
  if (complexityScore >= 7) { riskLevel = "high"; reasons.push(`complexity score ${complexityScore}`); }
  else if (complexityScore >= 5) { if (riskLevel === "low") riskLevel = "medium"; reasons.push(`complexity score ${complexityScore}`); }

  // Multiple agents involved
  const agents = new Set(nodes.map((n) => n.agent));
  if (agents.size >= 3) { if (riskLevel === "low") riskLevel = "medium"; reasons.push(`${agents.size} different agents`); }

  // Code modification nodes
  const codeNodes = nodes.filter((n) => n.type === "code");
  if (codeNodes.length >= 3) { riskLevel = "high"; reasons.push(`${codeNodes.length} code modification steps`); }

  const requiresApproval = riskLevel === "high";

  const planSummary = nodes.map((n) => `  ${n.type === "code" ? "✎" : n.type === "verify" ? "✓" : n.type === "research" ? "🔍" : "○"} ${n.title} [${n.agent}]`).join("\n");

  return {
    requiresApproval,
    reason: reasons.join("; "),
    planSummary,
    riskLevel,
  };
}

/**
 * Format approval gate for user display.
 */
export function formatApprovalGate(result: ApprovalGateResult): string {
  if (!result.requiresApproval) return "";
  return [
    `\n⚠️ PLAN APPROVAL REQUIRED (risk: ${result.riskLevel})`,
    `Reason: ${result.reason}`,
    `\nProposed plan:`,
    result.planSummary,
    `\nReply "go ahead" or "proceed" to execute, or provide alternative instructions.`,
  ].join("\n");
}

// ─── 6. Conflict Detection ────────────────────────────────────────────────────

export interface FileConflict {
  path: string;
  nodeIds: string[];
  type: "concurrent_write" | "write_after_delete";
}

/**
 * Detect potential file conflicts between running/ready nodes.
 */
export function detectFileConflicts(graph: TaskGraph): FileConflict[] {
  const conflicts: FileConflict[] = [];
  const fileToNodes = new Map<string, { nodeId: string; type: Artifact["type"] }[]>();

  // Collect file references from running and ready nodes
  const activeNodes = Array.from(graph.nodes.values()).filter((n) => n.status === "running" || n.status === "ready");

  for (const node of activeNodes) {
    // Check output artifacts from completed upstream nodes that inform this node's work
    if (node.output?.artifacts) {
      for (const artifact of node.output.artifacts) {
        if (!fileToNodes.has(artifact.path)) fileToNodes.set(artifact.path, []);
        fileToNodes.get(artifact.path)!.push({ nodeId: node.id, type: artifact.type });
      }
    }
    // Check input prompt for file references
    const fileRefs = node.input.prompt.match(/\b[\w/.-]+\.(ts|js|tsx|jsx|py|rs|go|java|rb|php|json|yaml|yml)\b/g) ?? [];
    for (const ref of fileRefs) {
      if (!fileToNodes.has(ref)) fileToNodes.set(ref, []);
      fileToNodes.get(ref)!.push({ nodeId: node.id, type: "modified" });
    }
  }

  // Find conflicts (same file referenced by multiple active nodes)
  for (const [path, refs] of fileToNodes) {
    if (refs.length > 1) {
      const nodeIds = [...new Set(refs.map((r) => r.nodeId))];
      if (nodeIds.length > 1) {
        const hasDelete = refs.some((r) => r.type === "deleted");
        conflicts.push({
          path,
          nodeIds,
          type: hasDelete ? "write_after_delete" : "concurrent_write",
        });
      }
    }
  }

  return conflicts;
}

/**
 * Format conflict warnings.
 */
export function formatConflictWarnings(conflicts: FileConflict[]): string {
  if (conflicts.length === 0) return "";
  const lines = conflicts.map((c) => `- ${c.path}: ${c.type} (nodes: ${c.nodeIds.join(", ")})`);
  return `\n⚠️ FILE CONFLICTS DETECTED:\n${lines.join("\n")}\nConsider serializing these nodes to avoid corruption.`;
}

// ─── 7. Token Budget ──────────────────────────────────────────────────────────

export interface TokenBudget {
  estimatedUsed: number;
  limit: number;
  remaining: number;
  warningThreshold: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

export interface TokenBudgetTracker {
  record(tokens: number): void;
  getState(): TokenBudget;
  isAllowed(estimatedCost: number): boolean;
}

export function createTokenBudgetTracker(limit = 500_000, warningPct = 0.8): TokenBudgetTracker {
  let used = 0;
  const warningThreshold = Math.round(limit * warningPct);

  return {
    record(tokens: number): void {
      used += tokens;
    },
    getState(): TokenBudget {
      return {
        estimatedUsed: used,
        limit,
        remaining: Math.max(0, limit - used),
        warningThreshold,
        isOverBudget: used > limit,
        isNearLimit: used > warningThreshold,
      };
    },
    isAllowed(estimatedCost: number): boolean {
      return used + estimatedCost <= limit;
    },
  };
}

/**
 * Estimate token cost for dispatching a node.
 */
export function estimateNodeTokenCost(node: TaskNode): number {
  const promptTokens = Math.ceil(node.input.prompt.length / 4);
  const contextTokens = node.input.context.reduce((sum, f) => sum + Math.ceil((f.key.length + f.value.length) / 4), 0);
  // Estimate response tokens (roughly 2x prompt for code tasks, 1x for research)
  const responseMultiplier = node.type === "code" ? 2 : node.type === "research" ? 1.5 : 1;
  return Math.round((promptTokens + contextTokens) * (1 + responseMultiplier));
}

// ─── 8. Rollback/Compensation ─────────────────────────────────────────────────

export interface RollbackPlan {
  steps: RollbackStep[];
  canAutoRollback: boolean;
  reason: string;
}

export interface RollbackStep {
  type: "git_stash" | "git_revert" | "file_restore" | "manual";
  description: string;
  command?: string;
  files?: string[];
}

/**
 * Generate a rollback plan based on artifacts produced by failed orchestration.
 */
export function generateRollbackPlan(graph: TaskGraph): RollbackPlan {
  const completedNodes = Array.from(graph.nodes.values()).filter((n) => n.status === "done");
  const failedNodes = Array.from(graph.nodes.values()).filter((n) => n.status === "failed" || n.status === "blocked");

  if (completedNodes.length === 0) {
    return { steps: [], canAutoRollback: true, reason: "No changes were made" };
  }

  // Collect all artifacts from completed nodes
  const allArtifacts = completedNodes.flatMap((n) => n.output?.artifacts ?? []);
  const modifiedFiles = allArtifacts.filter((a) => a.type === "modified").map((a) => a.path);
  const createdFiles = allArtifacts.filter((a) => a.type === "created").map((a) => a.path);

  const steps: RollbackStep[] = [];

  if (modifiedFiles.length > 0 || createdFiles.length > 0) {
    // Prefer git-based rollback
    steps.push({
      type: "git_stash",
      description: `Stash all orchestrated changes (${modifiedFiles.length} modified, ${createdFiles.length} created)`,
      command: "git stash push -m 'orchestration-rollback'",
      files: [...modifiedFiles, ...createdFiles],
    });
  }

  const canAutoRollback = steps.length > 0 && steps.every((s) => s.type === "git_stash" || s.type === "git_revert");

  return {
    steps,
    canAutoRollback,
    reason: failedNodes.length > 0
      ? `${failedNodes.length} node(s) failed after ${completedNodes.length} completed`
      : "Rollback requested",
  };
}

/**
 * Format rollback plan for display.
 */
export function formatRollbackPlan(plan: RollbackPlan): string {
  if (plan.steps.length === 0) return "No rollback needed — no changes were made.";
  const lines = plan.steps.map((s, i) => `${i + 1}. [${s.type}] ${s.description}${s.command ? `\n   $ ${s.command}` : ""}`);
  return `Rollback plan (${plan.canAutoRollback ? "auto" : "manual"}):\n${lines.join("\n")}`;
}

// ─── 9. Structured Logging ────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface OrchestrationLogger {
  log(level: LogLevel, event: string, message: string, metadata?: Record<string, unknown>): void;
  getEntries(level?: LogLevel): LogEntry[];
  getRecentEntries(count?: number): LogEntry[];
  clear(): void;
}

export function createOrchestrationLogger(maxEntries = 500): OrchestrationLogger {
  const entries: LogEntry[] = [];
  const levelOrder: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  return {
    log(level: LogLevel, event: string, message: string, metadata?: Record<string, unknown>): void {
      entries.push({ timestamp: new Date().toISOString(), level, event, message, metadata });
      if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries);
    },
    getEntries(level?: LogLevel): LogEntry[] {
      if (!level) return [...entries];
      const minLevel = levelOrder[level];
      return entries.filter((e) => levelOrder[e.level] >= minLevel);
    },
    getRecentEntries(count = 20): LogEntry[] {
      return entries.slice(-count);
    },
    clear(): void {
      entries.length = 0;
    },
  };
}

// ─── 10. Health Self-Check ────────────────────────────────────────────────────

export interface HealthCheckResult {
  healthy: boolean;
  checks: HealthCheck[];
  summary: string;
}

export interface HealthCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/**
 * Run health checks on the orchestration system.
 */
export function runHealthCheck(graph: TaskGraph | null, logger: OrchestrationLogger, rateLimiter: RateLimiter, tokenBudget: TokenBudgetTracker): HealthCheckResult {
  const checks: HealthCheck[] = [];

  // Check 1: Graph consistency
  if (graph) {
    const stats = getGraphStats(graph);
    const hasOrphans = Array.from(graph.nodes.values()).some((n) => {
      return n.dependencies.some((dep) => !graph.nodes.has(dep));
    });
    checks.push({
      name: "graph_consistency",
      passed: !hasOrphans,
      detail: hasOrphans ? "Graph has orphan dependencies" : `Graph OK: ${stats.total} nodes`,
    });

    // Check 2: No stuck nodes (running for too long without timeout detection)
    const running = getRunningNodes(graph);
    const stuckThreshold = 15 * 60 * 1000; // 15 min
    const stuck = running.filter((n) => n.startedAt && Date.now() - Date.parse(n.startedAt) > stuckThreshold);
    checks.push({
      name: "no_stuck_nodes",
      passed: stuck.length === 0,
      detail: stuck.length > 0 ? `${stuck.length} node(s) running > 15min` : "No stuck nodes",
    });
  } else {
    checks.push({ name: "graph_consistency", passed: true, detail: "No active graph" });
    checks.push({ name: "no_stuck_nodes", passed: true, detail: "No active graph" });
  }

  // Check 3: Logger not full of errors
  const recentErrors = logger.getEntries("error").filter((e) => Date.now() - Date.parse(e.timestamp) < 5 * 60 * 1000);
  checks.push({
    name: "error_rate",
    passed: recentErrors.length < 10,
    detail: recentErrors.length >= 10 ? `${recentErrors.length} errors in last 5min` : `${recentErrors.length} recent errors`,
  });

  // Check 4: Rate limiter not exhausted
  const rateState = rateLimiter.getState();
  checks.push({
    name: "rate_limiter",
    passed: rateState.activationsThisSession < 10,
    detail: `${rateState.activationsThisSession} activations this session`,
  });

  // Check 5: Token budget not exceeded
  const budgetState = tokenBudget.getState();
  checks.push({
    name: "token_budget",
    passed: !budgetState.isOverBudget,
    detail: budgetState.isOverBudget ? `Over budget: ${budgetState.estimatedUsed}/${budgetState.limit}` : `${budgetState.remaining} tokens remaining`,
  });

  const healthy = checks.every((c) => c.passed);
  const failedChecks = checks.filter((c) => !c.passed);
  const summary = healthy
    ? `Healthy: ${checks.length} checks passed`
    : `Unhealthy: ${failedChecks.map((c) => c.name).join(", ")} failed`;

  return { healthy, checks, summary };
}

/**
 * Format health check for display.
 */
export function formatHealthCheck(result: HealthCheckResult): string {
  const lines = result.checks.map((c) => `  ${c.passed ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  return `Health: ${result.healthy ? "OK" : "DEGRADED"}\n${lines.join("\n")}`;
}
