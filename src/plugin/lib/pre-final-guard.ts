import type { RuntimeState } from "./runtime-state.js";

export function buildPreFinalGuard(memory: RuntimeState): string {
  const workflow = memory.activeWorkflow;
  if (!workflow) return "";
  const hasEvidence = (memory.verificationEvidence ?? []).length > 0;
  const blockers = (memory.blockers ?? []).length;
  return [
    "\n\n<!-- JCE Pre-Final Guard -->",
    "Before any final completion claim:",
    "- Do not say done/fixed/complete unless workflow steps are complete and verification evidence is present.",
    `- Active workflow: ${workflow.id} (${workflow.status}).`,
    `- Verification evidence recorded: ${hasEvidence ? "yes" : "no"}.`,
    `- Active blockers: ${blockers}.`,
    "- If evidence or review is missing, continue work or report the blocker instead of finalizing.",
  ].join("\n");
}
