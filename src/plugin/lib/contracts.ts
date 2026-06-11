export const REQUIRED_RESULT_SECTIONS = ["Summary", "Files", "Verification", "Risks"] as const;

export interface DelegatedResultCheck {
  valid: boolean;
  missing: string[];
}

export function buildDelegatedResultContractInstructions(): string {
  return [
    "Return your final answer in this format:",
    "## Summary",
    "...",
    "",
    "## Files",
    "- path or none",
    "",
    "## Verification",
    "- command/result or not run",
    "",
    "When commands are run, include a structured evidence block immediately after Verification:",
    "```jce-evidence",
    "[{\"type\":\"test_result\",\"command\":\"bun test\",\"exitCode\":0,\"passed\":61,\"failed\":0}]",
    "```",
    "If no command ran, state why in ## Verification instead of emitting fake evidence.",
    "",
    "Also include a structured result block for deterministic file/risk/fact parsing:",
    "```jce-result",
    "{\"summary\":\"...\",\"files\":[{\"path\":\"src/file.ts\",\"action\":\"modified\"}],\"risks\":[],\"facts\":[]}",
    "```",
    "",
    "## Risks",
    "- risk or none",
  ].join("\n");
}

export function validateDelegatedResultSections(text: string): DelegatedResultCheck {
  const missing = REQUIRED_RESULT_SECTIONS.filter((section) => !text.includes(`## ${section}`));
  return { valid: missing.length === 0, missing: [...missing] };
}
