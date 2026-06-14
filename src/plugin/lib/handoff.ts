import { listOrNone } from "./shared-predicates.js";

const REQUIRED_HANDOFF_SECTIONS = ["Status", "Completed", "Blocker", "Evidence", "Next Options"] as const;

export interface HandoffReportInput {
  status: "blocked" | "awaiting_user";
  completed: string[];
  blocker: string;
  evidence: string[];
  nextOptions: string[];
}

export interface HandoffValidation {
  valid: boolean;
  missing: string[];
}

export function buildHandoffReport(input: HandoffReportInput): string {
  return [
    "## Status",
    input.status,
    "",
    "## Completed",
    listOrNone(input.completed),
    "",
    "## Blocker",
    input.blocker,
    "",
    "## Evidence",
    listOrNone(input.evidence),
    "",
    "## Next Options",
    listOrNone(input.nextOptions),
  ].join("\n");
}

export function validateHandoffReport(text: string): HandoffValidation {
  const missing = REQUIRED_HANDOFF_SECTIONS.filter((section) => !text.includes(`## ${section}`));
  return { valid: missing.length === 0, missing: [...missing] };
}
