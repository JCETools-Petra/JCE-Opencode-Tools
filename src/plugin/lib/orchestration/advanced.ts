/**
 * Advanced Orchestration — Cutting-edge AI orchestration capabilities
 * 
 * 1. Speculative Execution (race 2 approaches, pick winner)
 * 2. Self-Reflection Loop (agent reviews own output before done)
 * 3. Adaptive Model Selection (switch model by complexity/confidence)
 * 4. Memory Consolidation (abstract patterns from wisdom history)
 * 5. Multi-Agent Consensus (2 agents must agree on critical decisions)
 */

import type {
  TaskGraph,
  TaskNode,
  TaskNodeOutput,
  AgentRole,
  Evidence,
  Fact,
  WisdomEntryV2,
  TaskLearningV2,
  IntentType,
} from "./types.js";
import { aggregateEvidence } from "./evidence-system.js";

// ─── 1. Speculative Execution ─────────────────────────────────────────────────

export interface SpeculativeCandidate {
  id: string;
  approach: string;
  prompt: string;
  agent: AgentRole;
  priority: number;
}

export interface SpeculativeResult {
  candidateId: string;
  output: TaskNodeOutput;
  score: number;
  reasons: string[];
}

export interface SpeculativeDecision {
  winnerId: string;
  winnerScore: number;
  loserId: string;
  loserScore: number;
  reason: string;
  margin: number;
}

/**
 * Determine if a node should use speculative execution.
 * Speculative execution is valuable when:
 * - The task is ambiguous (multiple valid approaches)
 * - The cost of wrong approach is high (code changes that are hard to undo)
 * - Confidence in the plan is low
 */
export function shouldSpeculate(node: TaskNode, graphConfidence: number): boolean {
  // Only speculate on code and research nodes (most ambiguous)
  if (node.type !== "code" && node.type !== "research") return false;
  // Only speculate when confidence is moderate (too low = need more info, too high = just do it)
  if (graphConfidence > 0.8 || graphConfidence < 0.2) return false;
  // Only speculate on high-priority nodes (worth the extra cost)
  if (node.priority < 7) return false;
  // Don't speculate on retries (already tried one approach)
  if (node.retryPolicy.currentRetry > 0) return false;
  return true;
}

/**
 * Generate two alternative approaches for speculative execution.
 */
export function generateSpeculativeCandidates(node: TaskNode): [SpeculativeCandidate, SpeculativeCandidate] {
  const basePrompt = node.input.prompt;

  // Approach A: Direct/conventional approach
  const candidateA: SpeculativeCandidate = {
    id: `${node.id}-spec-a`,
    approach: "direct",
    prompt: `${basePrompt}\n\n## Approach Constraint\nUse the most straightforward, conventional approach. Prefer simplicity and readability over cleverness.`,
    agent: node.agent,
    priority: node.priority,
  };

  // Approach B: Alternative/creative approach
  const candidateB: SpeculativeCandidate = {
    id: `${node.id}-spec-b`,
    approach: "alternative",
    prompt: `${basePrompt}\n\n## Approach Constraint\nConsider an alternative approach that might be more robust or elegant. Think about edge cases and long-term maintainability.`,
    agent: node.agent === "self" ? "oracle" : node.agent, // Use oracle for second opinion
    priority: node.priority,
  };

  return [candidateA, candidateB];
}

/**
 * Evaluate and compare two speculative results, picking the winner.
 */
export function evaluateSpeculativeResults(resultA: SpeculativeResult, resultB: SpeculativeResult): SpeculativeDecision {
  const scoreA = computeSpeculativeScore(resultA);
  const scoreB = computeSpeculativeScore(resultB);

  const winner = scoreA >= scoreB ? resultA : resultB;
  const loser = scoreA >= scoreB ? resultB : resultA;

  return {
    winnerId: winner.candidateId,
    winnerScore: Math.max(scoreA, scoreB),
    loserId: loser.candidateId,
    loserScore: Math.min(scoreA, scoreB),
    reason: `${winner.candidateId} scored ${Math.round(Math.max(scoreA, scoreB) * 100)}% vs ${Math.round(Math.min(scoreA, scoreB) * 100)}%: ${winner.reasons.join("; ")}`,
    margin: Math.abs(scoreA - scoreB),
  };
}

function computeSpeculativeScore(result: SpeculativeResult): number {
  let score = 0;
  const reasons: string[] = [];

  // Evidence quality (40% weight)
  const evidenceScore = aggregateEvidence(result.output.evidence);
  score += evidenceScore.overallConfidence * 0.4;
  if (evidenceScore.isVerified) reasons.push("verified");

  // Confidence (30% weight)
  score += result.output.confidence * 0.3;
  if (result.output.confidence > 0.8) reasons.push("high confidence");

  // No blockers (20% weight)
  if (!result.output.blockers || result.output.blockers.length === 0) {
    score += 0.2;
    reasons.push("no blockers");
  }

  // Artifacts produced (10% weight)
  if (result.output.artifacts.length > 0) {
    score += 0.1;
    reasons.push(`${result.output.artifacts.length} artifacts`);
  }

  result.score = score;
  result.reasons = reasons;
  return score;
}

// ─── 2. Self-Reflection Loop ──────────────────────────────────────────────────

export interface ReflectionResult {
  approved: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  revisedOutput?: TaskNodeOutput;
}

/**
 * Determine if a node's output should go through self-reflection.
 * Reflection is valuable for code changes and high-stakes decisions.
 */
export function shouldReflect(node: TaskNode, output: TaskNodeOutput): boolean {
  // Always reflect on code changes
  if (node.type === "code" && output.artifacts.length > 0) return true;
  // Reflect when confidence is moderate (might have issues)
  if (output.confidence >= 0.4 && output.confidence <= 0.75) return true;
  // Reflect when there are potential blockers
  if (output.blockers && output.blockers.length > 0) return true;
  return false;
}

/**
 * Build a self-reflection prompt that asks the agent to review its own output.
 */
export function buildReflectionPrompt(node: TaskNode, output: TaskNodeOutput): string {
  return [
    `## Self-Reflection Task`,
    `You just completed: "${node.title}"`,
    ``,
    `## Your Output`,
    `Summary: ${output.summary}`,
    output.artifacts.length > 0 ? `Files changed: ${output.artifacts.map((a) => `${a.type} ${a.path}`).join(", ")}` : "",
    output.evidence.length > 0 ? `Evidence: ${output.evidence.map((e) => `${e.type}(${e.confidence})`).join(", ")}` : "",
    output.blockers?.length ? `Blockers: ${output.blockers.join(", ")}` : "",
    ``,
    `## Review Checklist`,
    `1. Does the output fully address the original task?`,
    `2. Are there edge cases not handled?`,
    `3. Could this break existing functionality?`,
    `4. Is the approach the simplest that works?`,
    `5. Are there security implications?`,
    ``,
    `## Instructions`,
    `If you find issues, describe them clearly.`,
    `If the output is good, confirm with "APPROVED" and explain why.`,
    `If changes are needed, describe the specific corrections.`,
    ``,
    `Return your review as:`,
    `## Reflection`,
    `Status: APPROVED or NEEDS_REVISION`,
    `Confidence: 0-100`,
    `Issues: (list any problems found)`,
    `Suggestions: (list improvements if any)`,
  ].filter(Boolean).join("\n");
}

/**
 * Parse a reflection response into structured result.
 */
export function parseReflectionResult(raw: string): ReflectionResult {
  const approved = /\bAPPROVED\b/i.test(raw) && !/\bNEEDS_REVISION\b/i.test(raw);
  const confidenceMatch = raw.match(/Confidence:\s*(\d+)/i);
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) / 100 : (approved ? 0.85 : 0.4);

  const issuesSection = raw.match(/Issues?:\s*([\s\S]*?)(?:\n##|\nSuggestions?:|$)/i)?.[1] ?? "";
  const issues = issuesSection.split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l.length > 3 && !/^none\b/i.test(l));

  const suggestionsSection = raw.match(/Suggestions?:\s*([\s\S]*?)(?:\n##|$)/i)?.[1] ?? "";
  const suggestions = suggestionsSection.split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l.length > 3 && !/^none\b/i.test(l));

  return { approved, confidence, issues, suggestions };
}

// ─── 3. Adaptive Model Selection ──────────────────────────────────────────────

export interface ModelTier {
  id: string;
  name: string;
  costPerToken: number;
  capability: number; // 0-1 scale
  speedFactor: number; // relative speed (1 = baseline)
}

export interface ModelSelection {
  tier: ModelTier;
  reason: string;
  estimatedCost: number;
}

const MODEL_TIERS: ModelTier[] = [
  { id: "fast", name: "Fast/Cheap", costPerToken: 0.001, capability: 0.6, speedFactor: 3.0 },
  { id: "balanced", name: "Balanced", costPerToken: 0.005, capability: 0.8, speedFactor: 1.5 },
  { id: "powerful", name: "Powerful", costPerToken: 0.015, capability: 0.95, speedFactor: 1.0 },
  { id: "reasoning", name: "Deep Reasoning", costPerToken: 0.06, capability: 1.0, speedFactor: 0.5 },
];

/**
 * Select the optimal model tier for a node based on its characteristics.
 */
export function selectModelForNode(node: TaskNode, context: { graphConfidence: number; budgetRemaining: number; isSpeculative: boolean }): ModelSelection {
  const reasons: string[] = [];
  let targetCapability = 0.8; // default: balanced

  // Node type influences model choice
  if (node.type === "verify" || node.type === "shell") {
    targetCapability = 0.6; // Simple tasks → fast model
    reasons.push("simple verification task");
  } else if (node.type === "code" && node.priority >= 8) {
    targetCapability = 0.95; // Critical code → powerful model
    reasons.push("high-priority code change");
  } else if (node.type === "research") {
    targetCapability = 0.8; // Research → balanced
    reasons.push("research task");
  } else if (node.type === "plan") {
    targetCapability = 0.95; // Planning → powerful (decisions matter)
    reasons.push("planning requires strong reasoning");
  }

  // Low graph confidence → use more powerful model
  if (context.graphConfidence < 0.5) {
    targetCapability = Math.max(targetCapability, 0.9);
    reasons.push("low graph confidence");
  }

  // Speculative execution → use cheaper model (running 2x)
  if (context.isSpeculative) {
    targetCapability = Math.min(targetCapability, 0.8);
    reasons.push("speculative (cost-conscious)");
  }

  // Budget pressure → downgrade
  if (context.budgetRemaining < 50000) {
    targetCapability = Math.min(targetCapability, 0.6);
    reasons.push("budget pressure");
  }

  // Retry → upgrade model (previous attempt failed)
  if (node.retryPolicy.currentRetry > 0) {
    targetCapability = Math.min(targetCapability + 0.15, 1.0);
    reasons.push(`retry #${node.retryPolicy.currentRetry} → upgraded model`);
  }

  // Find best matching tier
  const tier = MODEL_TIERS.reduce((best, current) => {
    const bestDiff = Math.abs(best.capability - targetCapability);
    const currentDiff = Math.abs(current.capability - targetCapability);
    return currentDiff < bestDiff ? current : best;
  });

  const estimatedTokens = Math.ceil(node.input.prompt.length / 4) * 3; // prompt + estimated response
  const estimatedCost = estimatedTokens * tier.costPerToken;

  return { tier, reason: reasons.join("; "), estimatedCost };
}

/**
 * Determine if model should be upgraded mid-execution (after low-confidence result).
 */
export function shouldUpgradeModel(currentTier: ModelTier, confidence: number, retryCount: number): ModelTier | null {
  if (confidence >= 0.7) return null; // Good enough
  if (currentTier.id === "reasoning") return null; // Already at max

  const tierIndex = MODEL_TIERS.findIndex((t) => t.id === currentTier.id);
  if (tierIndex < 0 || tierIndex >= MODEL_TIERS.length - 1) return null;

  // Upgrade by 1 tier if confidence is low, by 2 if very low
  const upgradeSteps = confidence < 0.4 ? 2 : 1;
  const newIndex = Math.min(tierIndex + upgradeSteps, MODEL_TIERS.length - 1);
  return MODEL_TIERS[newIndex];
}

// ─── 4. Memory Consolidation ──────────────────────────────────────────────────

export interface ConsolidatedPattern {
  id: string;
  pattern: string;
  frequency: number;
  confidence: "low" | "medium" | "high";
  sourceWisdomIds: string[];
  createdAt: string;
  lastValidatedAt: string;
}

export interface ConsolidationResult {
  patterns: ConsolidatedPattern[];
  mergedWisdom: number;
  removedDuplicates: number;
  abstractedPatterns: number;
}

/**
 * Consolidate wisdom entries into higher-level patterns.
 * Run after N sessions to compress and abstract learnings.
 */
export function consolidateMemory(wisdom: WisdomEntryV2[], learnings: TaskLearningV2[], minFrequency = 2): ConsolidationResult {
  const patterns: ConsolidatedPattern[] = [];
  let mergedWisdom = 0;
  let removedDuplicates = 0;
  let abstractedPatterns = 0;

  // Step 1: Find duplicate/similar wisdom entries
  const groups = groupSimilarWisdom(wisdom);
  for (const group of groups) {
    if (group.length >= minFrequency) {
      // Abstract into a pattern
      const pattern = abstractPattern(group);
      patterns.push(pattern);
      abstractedPatterns++;
      mergedWisdom += group.length;
    }
  }

  // Step 2: Find recurring task patterns from learnings
  const taskPatterns = findRecurringTaskPatterns(learnings);
  for (const tp of taskPatterns) {
    patterns.push(tp);
    abstractedPatterns++;
  }

  // Step 3: Identify exact duplicates
  const seen = new Set<string>();
  for (const w of wisdom) {
    const normalized = w.learning.toLowerCase().trim();
    if (seen.has(normalized)) removedDuplicates++;
    seen.add(normalized);
  }

  return { patterns, mergedWisdom, removedDuplicates, abstractedPatterns };
}

function groupSimilarWisdom(wisdom: WisdomEntryV2[]): WisdomEntryV2[][] {
  const groups: WisdomEntryV2[][] = [];
  const assigned = new Set<string>();

  for (const w of wisdom) {
    if (assigned.has(w.id)) continue;
    const group = [w];
    assigned.add(w.id);

    const wTokens = new Set(w.learning.toLowerCase().split(/\s+/).filter((t) => t.length > 3));

    for (const other of wisdom) {
      if (assigned.has(other.id)) continue;
      const otherTokens = new Set(other.learning.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
      const overlap = [...wTokens].filter((t) => otherTokens.has(t)).length;
      const similarity = overlap / Math.max(wTokens.size, otherTokens.size);
      if (similarity > 0.5) {
        group.push(other);
        assigned.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

function abstractPattern(group: WisdomEntryV2[]): ConsolidatedPattern {
  // Find common tokens across all entries in the group
  const tokenSets = group.map((w) => new Set(w.learning.toLowerCase().split(/\s+/).filter((t) => t.length > 3)));
  const commonTokens = [...tokenSets[0]].filter((t) => tokenSets.every((s) => s.has(t)));

  // Build abstract pattern from common elements
  const pattern = commonTokens.length > 3
    ? `When dealing with ${commonTokens.slice(0, 5).join(", ")}: ${group[0].learning.slice(0, 100)}`
    : group[0].learning;

  const avgConfidence = group.reduce((sum, w) => sum + (w.confidence === "high" ? 3 : w.confidence === "medium" ? 2 : 1), 0) / group.length;

  return {
    id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pattern,
    frequency: group.length,
    confidence: avgConfidence >= 2.5 ? "high" : avgConfidence >= 1.5 ? "medium" : "low",
    sourceWisdomIds: group.map((w) => w.id),
    createdAt: new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
  };
}

function findRecurringTaskPatterns(learnings: TaskLearningV2[]): ConsolidatedPattern[] {
  const patterns: ConsolidatedPattern[] = [];
  const byType = new Map<IntentType, TaskLearningV2[]>();

  for (const l of learnings) {
    if (!byType.has(l.taskType)) byType.set(l.taskType, []);
    byType.get(l.taskType)!.push(l);
  }

  for (const [type, typeLearnings] of byType) {
    if (typeLearnings.length < 2) continue;

    // Find common recipe steps
    const allSteps = typeLearnings.flatMap((l) => l.successfulRecipe);
    const stepFreq = new Map<string, number>();
    for (const step of allSteps) {
      const normalized = step.toLowerCase().trim();
      stepFreq.set(normalized, (stepFreq.get(normalized) ?? 0) + 1);
    }

    const commonSteps = [...stepFreq.entries()]
      .filter(([_, freq]) => freq >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([step]) => step);

    if (commonSteps.length >= 2) {
      patterns.push({
        id: `pattern-task-${type}-${Date.now()}`,
        pattern: `For ${type} tasks: ${commonSteps.join(" → ")}`,
        frequency: typeLearnings.length,
        confidence: "medium",
        sourceWisdomIds: typeLearnings.map((l) => l.id),
        createdAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
      });
    }
  }

  return patterns;
}

/**
 * Determine if memory consolidation should run.
 */
export function shouldConsolidate(wisdom: WisdomEntryV2[], sessionCount: number): boolean {
  // Consolidate every 5 sessions or when wisdom exceeds 30 entries
  return sessionCount % 5 === 0 || wisdom.length > 30;
}

// ─── 5. Multi-Agent Consensus ─────────────────────────────────────────────────

export interface ConsensusRequest {
  question: string;
  context: string;
  agents: AgentRole[];
  requiredAgreement: number; // 0-1 (e.g., 0.66 = 2/3 must agree)
}

export interface AgentVote {
  agent: AgentRole;
  decision: string;
  confidence: number;
  reasoning: string;
}

export interface ConsensusResult {
  reached: boolean;
  decision: string;
  votes: AgentVote[];
  agreementLevel: number;
  dissent: string[];
}

/**
 * Determine if a decision requires multi-agent consensus.
 * Critical decisions that benefit from consensus:
 * - Architecture changes
 * - Security-sensitive modifications
 * - Breaking changes
 * - Deletion of significant code
 */
export function requiresConsensus(node: TaskNode): boolean {
  const prompt = node.input.prompt.toLowerCase();

  // Architecture decisions
  if (/\b(architect|design\s*decision|system\s*design|restructure)\b/.test(prompt)) return true;
  // Security changes
  if (/\b(auth|security|credential|secret|permission|access\s*control)\b/.test(prompt)) return true;
  // Breaking changes
  if (/\b(breaking\s*change|remove\s*api|deprecate|migration)\b/.test(prompt)) return true;
  // Large deletions
  if (/\b(delete|remove|drop)\s+(all|entire|module|service|package)\b/.test(prompt)) return true;

  return false;
}

/**
 * Build consensus prompts for multiple agents.
 */
export function buildConsensusPrompts(request: ConsensusRequest): Map<AgentRole, string> {
  const prompts = new Map<AgentRole, string>();

  for (const agent of request.agents) {
    prompts.set(agent, [
      `## Consensus Decision Required`,
      ``,
      `Question: ${request.question}`,
      ``,
      `Context:`,
      request.context,
      ``,
      `## Your Role`,
      `You are voting as the "${agent}" specialist.`,
      `Evaluate this decision from your expertise perspective.`,
      ``,
      `## Response Format`,
      `Decision: APPROVE or REJECT`,
      `Confidence: 0-100`,
      `Reasoning: (explain your vote in 2-3 sentences)`,
    ].join("\n"));
  }

  return prompts;
}

/**
 * Evaluate consensus from multiple agent votes.
 */
export function evaluateConsensus(votes: AgentVote[], requiredAgreement = 0.66): ConsensusResult {
  if (votes.length === 0) {
    return { reached: false, decision: "no_votes", votes: [], agreementLevel: 0, dissent: ["No votes received"] };
  }

  // Count decisions (normalize to APPROVE/REJECT)
  const approvals = votes.filter((v) => /\bapprove\b/i.test(v.decision));
  const rejections = votes.filter((v) => /\breject\b/i.test(v.decision));

  const agreementLevel = Math.max(approvals.length, rejections.length) / votes.length;
  const majorityDecision = approvals.length >= rejections.length ? "APPROVE" : "REJECT";
  const reached = agreementLevel >= requiredAgreement;

  // Weighted by confidence
  const weightedApproval = approvals.reduce((sum, v) => sum + v.confidence, 0);
  const weightedRejection = rejections.reduce((sum, v) => sum + v.confidence, 0);
  const finalDecision = weightedApproval >= weightedRejection ? "APPROVE" : "REJECT";

  const dissent = (finalDecision === "APPROVE" ? rejections : approvals)
    .map((v) => `${v.agent}: ${v.reasoning}`);

  return {
    reached,
    decision: reached ? finalDecision : "NO_CONSENSUS",
    votes,
    agreementLevel: Math.round(agreementLevel * 100) / 100,
    dissent,
  };
}

/**
 * Parse an agent's consensus vote from raw text.
 */
export function parseConsensusVote(raw: string, agent: AgentRole): AgentVote {
  const decisionMatch = raw.match(/Decision:\s*(APPROVE|REJECT)/i);
  const confidenceMatch = raw.match(/Confidence:\s*(\d+)/i);
  const reasoningMatch = raw.match(/Reasoning:\s*([\s\S]*?)(?:\n##|$)/i);

  return {
    agent,
    decision: decisionMatch?.[1] ?? "ABSTAIN",
    confidence: confidenceMatch ? parseInt(confidenceMatch[1], 10) / 100 : 0.5,
    reasoning: reasoningMatch?.[1]?.trim() ?? raw.slice(0, 200),
  };
}

/**
 * Format consensus result for display.
 */
export function formatConsensusResult(result: ConsensusResult): string {
  const voteLines = result.votes.map((v) => `  ${v.decision === "APPROVE" ? "✓" : "✗"} ${v.agent}: ${v.decision} (${Math.round(v.confidence * 100)}%) — ${v.reasoning.slice(0, 80)}`);
  const status = result.reached ? `Consensus ${result.decision}` : "NO CONSENSUS REACHED";
  return [
    `\n🗳️ MULTI-AGENT CONSENSUS: ${status}`,
    `Agreement: ${Math.round(result.agreementLevel * 100)}%`,
    `Votes:`,
    ...voteLines,
    result.dissent.length > 0 ? `Dissent: ${result.dissent.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}
