import { buildDelegatedResultContractInstructions } from "./contracts.js";

export interface DelegationEnvelopeInput {
  goal: string;
  prompt: string;
  agent: string;
  expectedOutcome?: string;
  requiredTools?: string[];
  mustDo?: string[];
  mustNotDo?: string[];
  context?: string[];
  scope?: string;
  nonGoals?: string[];
  constraints?: string[];
  allowedFiles?: string[];
  expectedVerification?: string[];
  timeoutHint?: string;
}

export interface DelegationEnvelope {
  task: string;
  expectedOutcome: string;
  requiredTools: string[];
  mustDo: string[];
  mustNotDo: string[];
  context: string[];
  agent: string;
  outputContract: string;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function list(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

export function buildDelegationEnvelope(input: DelegationEnvelopeInput): DelegationEnvelope {
  return {
    task: input.goal,
    expectedOutcome: input.expectedOutcome ?? "Complete the task and return Summary, Files, Verification, and Risks.",
    requiredTools: unique(input.requiredTools ?? ["Read", "Grep", "Glob", "Bash", "Edit", "Write"]),
    mustDo: unique([
      ...(input.mustDo ?? []),
      ...(input.constraints ?? []),
      "Preserve existing user changes",
      "Verify results before reporting completion",
    ]),
    mustNotDo: unique([
      ...(input.mustNotDo ?? []),
      ...(input.nonGoals ?? []).map((ng) => `Do not: ${ng}`),
      "Do not modify unrelated files",
      "Do not invent APIs, paths, or behavior",
      "Do not claim completion without verification evidence",
    ]),
    context: unique([
      ...(input.context ?? []),
      ...(input.allowedFiles ?? []).map((f) => `Allowed file: ${f}`),
      input.scope ?? input.prompt,
    ]),
    agent: input.agent,
    outputContract: buildDelegatedResultContractInstructions(),
  };
}

export function formatDelegationEnvelope(envelope: DelegationEnvelope): string {
  return [
    "# Delegated Task Envelope",
    "",
    "## 1. TASK",
    envelope.task,
    "",
    "## 2. EXPECTED OUTCOME",
    envelope.expectedOutcome,
    "",
    "## 3. REQUIRED TOOLS",
    list(envelope.requiredTools),
    "",
    "## 4. MUST DO",
    list(envelope.mustDo),
    "",
    "## 5. MUST NOT DO",
    list(envelope.mustNotDo),
    "",
    "## 6. CONTEXT",
    list(envelope.context),
    "",
    "## Assigned Agent",
    envelope.agent,
    "",
    "## Output Contract",
    envelope.outputContract,
  ].join("\n");
}
