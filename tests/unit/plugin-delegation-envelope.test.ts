import { describe, expect, test } from "bun:test";
import { buildDelegationEnvelope, formatDelegationEnvelope } from "../../src/plugin/lib/delegation-envelope.ts";

describe("delegation envelope", () => {
  test("formats 6-section task envelope with task, outcome, tools, must do, must not do, context", () => {
    const envelope = buildDelegationEnvelope({
      goal: "Inspect runtime recovery",
      prompt: "Check retry behavior",
      agent: "explorer",
      expectedOutcome: "Report on retry logic correctness",
      requiredTools: ["Read", "Grep"],
      mustDo: ["Verify retry count increments"],
      mustNotDo: ["Do not modify source files"],
      context: ["src/plugin/tools/dispatch.ts contains retry logic"],
    });

    const text = formatDelegationEnvelope(envelope);

    expect(text).toContain("## 1. TASK\nInspect runtime recovery");
    expect(text).toContain("## 2. EXPECTED OUTCOME\nReport on retry logic correctness");
    expect(text).toContain("## 3. REQUIRED TOOLS\n- Read\n- Grep");
    expect(text).toContain("## 4. MUST DO\n- Verify retry count increments");
    expect(text).toContain("## 5. MUST NOT DO\n- Do not modify source files");
    expect(text).toContain("## 6. CONTEXT\n- src/plugin/tools/dispatch.ts contains retry logic");
    expect(text).toContain("## Output Contract");
    expect(envelope.outputContract).toContain("## Summary");
    expect(envelope.outputContract).toContain("## Verification");
  });

  test("uses safe defaults when optional fields are omitted", () => {
    const envelope = buildDelegationEnvelope({
      goal: "Research CLI state",
      prompt: "Inspect status command",
      agent: "explorer",
    });

    const text = formatDelegationEnvelope(envelope);

    expect(text).toContain("## 1. TASK\nResearch CLI state");
    expect(text).toContain("## 2. EXPECTED OUTCOME");
    expect(text).toContain("## 4. MUST DO");
    expect(text).toContain("Preserve existing user changes");
    expect(text).toContain("## 5. MUST NOT DO");
    expect(text).toContain("Do not modify unrelated files");
    expect(envelope.mustDo).toContain("Preserve existing user changes");
    expect(envelope.mustNotDo).toContain("Do not modify unrelated files");
  });

  test("deduplicates must do and must not do entries", () => {
    const envelope = buildDelegationEnvelope({
      goal: "Check tests",
      prompt: "Run tests",
      agent: "explorer",
      mustDo: ["Run bun test", "Run bun test"],
      mustNotDo: ["Do not commit", "Do not commit"],
    });

    expect(envelope.mustDo.filter((item) => item === "Run bun test")).toHaveLength(1);
    expect(envelope.mustNotDo.filter((item) => item === "Do not commit")).toHaveLength(1);
  });

  test("merges legacy fields into 6-section format", () => {
    const envelope = buildDelegationEnvelope({
      goal: "Fix bug",
      prompt: "Debug the issue",
      agent: "oracle",
      constraints: ["Do not break API"],
      nonGoals: ["refactor unrelated code"],
      allowedFiles: ["src/lib/config.ts"],
    });

    expect(envelope.mustDo).toContain("Do not break API");
    expect(envelope.mustNotDo).toContain("Do not: refactor unrelated code");
    expect(envelope.context).toContain("Allowed file: src/lib/config.ts");
  });
});
