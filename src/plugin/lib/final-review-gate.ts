import { buildCompletionCertificate } from "./completion-certificate.js";
import type { PolicyProfile } from "./verification-gate.js";
import { evaluateWorkflowCompletionGate } from "./verification-gate.js";
import type { WorkflowRun } from "./workflow.js";
import { isRecord, hasAcceptedReview, hasAcceptedAllReviews, hasUnresolvedExhaustedRetry } from "./shared-predicates.js";

export interface FinalReviewGateInput {
  profile: PolicyProfile;
  changedFiles: string[];
  delegatedReviews: string[];
  residualRisks: string[];
  activeBlockers: unknown[];
  retryHistory: unknown[];
  delegatedWorkRequired?: boolean;
  policyReasons?: string[];
}

export interface FinalReviewGateResult {
  status: "pass" | "block";
  reasons: string[];
  summary: string;
  certificate: ReturnType<typeof buildCompletionCertificate>;
}

function describeBlocker(blocker: unknown): string {
  if (!isRecord(blocker)) return String(blocker);
  const reason = blocker.reason ?? blocker.handoffReason ?? blocker.failureReason ?? blocker.id;
  return typeof reason === "string" ? reason : JSON.stringify(blocker);
}

function retryId(entry: unknown): string {
  return isRecord(entry) && typeof entry.id === "string" ? entry.id : "unknown";
}

function routePolicyReasons(run: WorkflowRun, gateReasons: string[], accepted: boolean): string[] {
  if (!run.route) return [];
  if (run.route.intent === "completion_claim" && gateReasons.length > 0) {
    return ["Completion claim route requires fresh verification evidence before reporting done."];
  }
  if (run.route.intent === "review" && !accepted) return ["Review route requires accepted review evidence before completion."];
  if (run.route.intent === "bugfix" && gateReasons.length > 0) {
    return ["Bugfix route requires regression-focused verification evidence before completion."];
  }
  return [];
}

export function evaluateFinalReviewGate(run: WorkflowRun, input: FinalReviewGateInput): FinalReviewGateResult {
  const gate = evaluateWorkflowCompletionGate(run, input.profile);
  const certificate = buildCompletionCertificate(run, {
    profile: input.profile,
    changedFiles: input.changedFiles,
    delegatedReviews: input.delegatedReviews,
    residualRisks: input.residualRisks,
  });
  const accepted = hasAcceptedReview(input.delegatedReviews);
  const allAccepted = hasAcceptedAllReviews(input.delegatedReviews);
  const reasons = [
    ...gate.reasons,
    ...routePolicyReasons(run, gate.reasons, accepted),
    ...(input.policyReasons ?? []),
    ...input.activeBlockers.map((blocker) => `Active blocker remains: ${describeBlocker(blocker)}`),
    ...input.retryHistory.filter(hasUnresolvedExhaustedRetry).map((entry) => `Retry history contains unresolved exhausted recovery: ${retryId(entry)}`),
  ];

  if (run.status === "blocked" || run.blocker) reasons.push(run.blocker?.reason ?? "Workflow is blocked.");
  if (!certificate.valid) reasons.push("Completion certificate is not valid.");
  if (input.delegatedWorkRequired && !allAccepted) reasons.push("Delegated review has not been accepted yet.");

  const uniqueReasons = Array.from(new Set(reasons));
  const status = uniqueReasons.length === 0 ? "pass" : "block";
  return {
    status,
    reasons: uniqueReasons,
    certificate,
    summary: status === "pass" ? "Final review gate passed." : `Final review gate blocked: ${uniqueReasons.join("; ")}`,
  };
}
