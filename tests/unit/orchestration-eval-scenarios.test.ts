import { describe, expect, test } from "bun:test";
import { parseAgentResult, type AgentRequest } from "../../src/plugin/lib/orchestration/agent-protocol.js";

function request(requireEvidence = true): AgentRequest {
  return {
    taskId: "task-eval",
    nodeId: "eval-node",
    agent: "oracle",
    goal: "Evaluate orchestration behavior",
    prompt: "Evaluate",
    context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
    expectations: { requiredSections: ["Summary", "Files", "Verification", "Risks"], requireEvidence, minConfidence: 0.7 },
  };
}

describe("orchestration eval scenarios", () => {
  test("legacy prose verification cannot fully complete evidence-required task", () => {
    const raw = `## Summary
Done.

## Files
- src/a.ts

## Verification
$ bun test
1 pass, 0 fail
exit code: 0

## Risks
- none`;

    const result = parseAgentResult(raw, request(true));
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.status).toBe("partial");
    expect(result.confidence).toBeLessThan(0.7);
  });

  test("structured evidence and result can complete evidence-required task", () => {
    const raw = [
      "## Summary",
      "Done.",
      "",
      "## Files",
      "- src/a.ts",
      "",
      "## Verification",
      "$ bun test",
      "1 pass, 0 fail",
      "exit code: 0",
      "```jce-evidence",
      '[{"type":"test_result","command":"bun test","exitCode":0,"passed":1,"failed":0}]',
      "```",
      "```jce-result",
      '{"summary":"Done with structured metadata","files":[{"path":"src/a.ts","action":"modified"}],"risks":[],"facts":[]}',
      "```",
      "",
      "## Risks",
      "- none",
    ].join("\n");

    const result = parseAgentResult(raw, request(true));
    expect(result.status).toBe("success");
    expect(result.summary).toBe("Done with structured metadata");
    expect(result.artifacts.map((a) => a.path)).toEqual(["src/a.ts"]);
  });

  test("malformed structured result falls back to Markdown artifacts", () => {
    const raw = `## Summary
Done.

## Files
Modified src/fallback.ts

## Verification
not required

\`\`\`jce-result
{ broken json ]
\`\`\`

## Risks
- none`;

    const result = parseAgentResult(raw, request(false));
    expect(result.artifacts.map((a) => a.path)).toContain("src/fallback.ts");
  });
});
