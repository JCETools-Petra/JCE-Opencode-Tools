import { describe, test, expect } from "bun:test";
import {
  buildAgentRequest,
  formatAgentRequestAsPrompt,
  parseAgentResult,
  resultToNodeOutput,
} from "../../src/plugin/lib/orchestration/agent-protocol.js";
import type { TaskNode, AgentContext, AgentRequest } from "../../src/plugin/lib/orchestration/index.js";

const NOW = "2026-01-01T00:00:00.000Z";

function makeNode(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: "n1",
    type: "code",
    title: "Fix the bug",
    description: "Fix the login crash",
    agent: "oracle",
    status: "running",
    dependencies: [],
    input: {
      prompt: "Fix the login crash in auth.ts",
      context: [{ id: "f1", key: "framework", value: "express", source: "tool", confidence: 0.9, discoveredAt: NOW }],
      constraints: [{ id: "c1", description: "Don't break existing tests", origin: "user", active: true, createdAt: NOW }],
      expectedOutput: { sections: ["Summary", "Files", "Verification"], requireEvidence: true, minConfidence: 0.7 },
      skills: ["software-engineering", "typescript"],
    },
    output: undefined,
    evidence: [],
    retryPolicy: { maxRetries: 2, strategy: ["same", "different_approach", "escalate_user"], currentRetry: 0 },
    priority: 5,
    createdAt: NOW,
    startedAt: NOW,
    ...overrides,
  };
}

function makeContext(): AgentContext {
  return {
    facts: [{ id: "f2", key: "runtime", value: "bun", source: "tool", confidence: 0.95, discoveredAt: NOW }],
    constraints: [],
    priorArtifacts: [],
    skills: ["software-engineering"],
  };
}

describe("Agent Protocol", () => {
  describe("buildAgentRequest", () => {
    test("builds structured request from node", () => {
      const node = makeNode();
      const ctx = makeContext();
      const request = buildAgentRequest(node, ctx);

      expect(request.taskId).toBe("task-n1");
      expect(request.nodeId).toBe("n1");
      expect(request.agent).toBe("oracle");
      expect(request.goal).toBe("Fix the bug");
      expect(request.prompt).toBe("Fix the login crash in auth.ts");
      expect(request.context.facts).toHaveLength(2); // node facts + context facts
      expect(request.context.constraints).toHaveLength(1);
      expect(request.expectations.requiredSections).toEqual(["Summary", "Files", "Verification"]);
      expect(request.expectations.requireEvidence).toBe(true);
    });

    test("includes retry info when provided", () => {
      const node = makeNode();
      const ctx = makeContext();
      const request = buildAgentRequest(node, ctx, {
        attempt: 2,
        maxAttempts: 3,
        previousFailure: "timeout",
        strategy: "different_approach",
        priorEvidence: ["first attempt timed out after 30s"],
      });

      expect(request.retryInfo).toBeDefined();
      expect(request.retryInfo!.attempt).toBe(2);
      expect(request.retryInfo!.strategy).toBe("different_approach");
    });
  });

  describe("formatAgentRequestAsPrompt", () => {
    test("formats request into readable prompt", () => {
      const node = makeNode();
      const ctx = makeContext();
      const request = buildAgentRequest(node, ctx);
      const prompt = formatAgentRequestAsPrompt(request);

      expect(prompt).toContain("## Goal");
      expect(prompt).toContain("Fix the bug");
      expect(prompt).toContain("## Task");
      expect(prompt).toContain("Fix the login crash in auth.ts");
      expect(prompt).toContain("## Known Facts");
      expect(prompt).toContain("framework");
      expect(prompt).toContain("## Constraints");
      expect(prompt).toContain("Don't break existing tests");
      expect(prompt).toContain("## Output Contract");
      expect(prompt).toContain("Summary");
    });

    test("includes retry context when present", () => {
      const node = makeNode();
      const ctx = makeContext();
      const request = buildAgentRequest(node, ctx, {
        attempt: 2,
        maxAttempts: 3,
        previousFailure: "test failed",
        strategy: "different_approach",
        priorEvidence: ["auth.test.ts line 42 assertion failed"],
      });
      const prompt = formatAgentRequestAsPrompt(request);

      expect(prompt).toContain("## Retry Context");
      expect(prompt).toContain("Attempt 2 of 3");
      expect(prompt).toContain("different_approach");
      expect(prompt).toContain("test failed");
    });
  });

  describe("parseAgentResult", () => {
    test("parses well-structured agent output", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Fix the bug",
        prompt: "Fix it",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary", "Files", "Verification", "Risks"], requireEvidence: true, minConfidence: 0.6 },
      };

      const raw = `## Summary
Fixed the login crash by handling null user session.

## Files
- Modified src/auth.ts
- Modified tests/auth.test.ts

## Verification
$ bun test
61 pass, 0 fail
exit code: 0

$ tsc --noEmit
exit code: 0

## Risks
- None identified`;

      const result = parseAgentResult(raw, request);
      expect(result.status).toBe("partial");
      expect(result.summary).toContain("Fixed the login crash");
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.blockers).toHaveLength(0);
    });

    test("parses output with failing tests", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Fix the bug",
        prompt: "Fix it",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary", "Verification"], requireEvidence: true, minConfidence: 0.6 },
      };

      const raw = `## Summary
Attempted fix but tests still fail.

## Verification
$ bun test
58 pass, 3 fail
exit code: 1`;

      const result = parseAgentResult(raw, request);
      expect(result.evidence.some((e) => e.exitCode === 1)).toBe(true);
      expect(result.confidence).toBeLessThan(0.7);
    });

    test("parses output with blockers", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Fix the bug",
        prompt: "Fix it",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary", "Risks"], requireEvidence: false, minConfidence: 0.3 },
      };

      const raw = `## Summary
Cannot proceed without database access.

## Risks
- Need database credentials to reproduce
- Production data required for testing`;

      const result = parseAgentResult(raw, request);
      expect(result.status).toBe("blocked");
      expect(result.blockers).toHaveLength(2);
      expect(result.blockers[0]).toContain("database credentials");
    });

    test("handles unstructured output gracefully", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "explorer",
        goal: "Find files",
        prompt: "Find them",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary"], requireEvidence: false, minConfidence: 0.3 },
      };

      const raw = "I found the files in src/lib/ directory. The main entry is index.ts.";
      const result = parseAgentResult(raw, request);
      expect(result.summary).toBeTruthy();
      expect(result.status).toBe("failed"); // No sections, no evidence
    });

    test("extracts file artifacts from output", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Create files",
        prompt: "Create them",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary"], requireEvidence: false, minConfidence: 0.3 },
      };

      const raw = `## Summary
Created the new module.

Created src/orchestration/types.ts
Modified src/plugin/index.ts
Deleted src/old-workflow.ts`;

      const result = parseAgentResult(raw, request);
      expect(result.artifacts.length).toBeGreaterThanOrEqual(2);
    });

    test("prefers structured jce-evidence block over free-text regex", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Fix the bug",
        prompt: "Fix it",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary", "Verification"], requireEvidence: true, minConfidence: 0.6 },
      };

      const raw = `## Summary
Fixed it.

## Verification
Ran the tests, looks good (no exit codes written in prose).

\`\`\`jce-evidence
[{"type":"test_result","command":"bun test","exitCode":0,"passed":61,"failed":0},{"type":"type_check","command":"tsc --noEmit","exitCode":0}]
\`\`\``;

      const result = parseAgentResult(raw, request);
      expect(result.status).toBe("success");
      expect(result.evidence.length).toBe(2);
      const testEv = result.evidence.find((e) => e.type === "test_result");
      expect(testEv).toBeDefined();
      expect(testEv!.assertions[0].passed).toBe(true);
      expect(testEv!.confidence).toBe(1); // 61/61
      const typeEv = result.evidence.find((e) => e.type === "type_check");
      expect(typeEv!.exitCode).toBe(0);
      expect(typeEv!.confidence).toBe(0.9);
    });

    test("structured block surfaces failing tests with low confidence", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Fix the bug",
        prompt: "Fix it",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary", "Verification"], requireEvidence: true, minConfidence: 0.6 },
      };

      const raw = `## Summary
Still failing.

\`\`\`jce-evidence
[{"type":"test_result","command":"bun test","exitCode":1,"passed":58,"failed":3}]
\`\`\``;

      const result = parseAgentResult(raw, request);
      const testEv = result.evidence.find((e) => e.type === "test_result");
      expect(testEv).toBeDefined();
      expect(testEv!.assertions[0].passed).toBe(false);
      // A failing run must report LOW confidence in success, not the pass-ratio.
      expect(testEv!.confidence).toBe(0.1);
      expect(result.confidence).toBeLessThan(0.7);
    });

    test("falls back to regex when structured block is malformed JSON", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Fix the bug",
        prompt: "Fix it",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary", "Verification"], requireEvidence: true, minConfidence: 0.6 },
      };

      const raw = `## Summary
Fixed it.

## Verification
$ bun test
61 pass, 0 fail
exit code: 0

\`\`\`jce-evidence
{ this is not valid json ]
\`\`\``;

      const result = parseAgentResult(raw, request);
      // Malformed block must not crash and must fall back to regex evidence.
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence.some((e) => e.exitCode === 0)).toBe(true);
      expect(result.status).toBe("partial");
    });

    test("parses structured jce-result block for summary files facts and risks", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Fix the bug",
        prompt: "Fix it",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary", "Verification", "Files", "Risks"], requireEvidence: true, minConfidence: 0.6 },
      };

      const raw = [
        "## Summary",
        "Legacy summary should be overridden.",
        "",
        "## Verification",
        "ok",
        "```jce-evidence",
        '[{"type":"test_result","command":"bun test","exitCode":0,"passed":2,"failed":0}]',
        "```",
        "",
        "```jce-result",
        '{"summary":"Structured summary","files":[{"path":"src/a.ts","action":"modified"},{"path":"src/new.ts","action":"created"}],"risks":["No risks identified"],"facts":[{"key":"package.manager","value":"bun","confidence":0.9}]}',
        "```",
      ].join("\n");

      const result = parseAgentResult(raw, request);
      expect(result.status).toBe("success");
      expect(result.summary).toBe("Structured summary");
      expect(result.artifacts.map((a) => `${a.type}:${a.path}`)).toEqual(["modified:src/a.ts", "created:src/new.ts"]);
      expect(result.newFacts).toHaveLength(1);
      expect(result.newFacts[0].key).toBe("package.manager");
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe("resultToNodeOutput", () => {
    test("converts AgentResult to TaskNodeOutput", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Test",
        prompt: "Test",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary"], requireEvidence: false, minConfidence: 0.3 },
      };

      const raw = `## Summary\nDone successfully.`;
      const result = parseAgentResult(raw, request);
      const output = resultToNodeOutput(result);

      expect(output.summary).toBe(result.summary);
      expect(output.artifacts).toEqual(result.artifacts);
      expect(output.evidence).toEqual(result.evidence);
      expect(output.confidence).toBe(result.confidence);
    });

    test("truncates raw output over 5000 chars", () => {
      const request: AgentRequest = {
        taskId: "task-n1",
        nodeId: "n1",
        agent: "oracle",
        goal: "Test",
        prompt: "Test",
        context: { facts: [], constraints: [], priorArtifacts: [], skills: [] },
        expectations: { requiredSections: ["Summary"], requireEvidence: false, minConfidence: 0.3 },
      };

      const raw = `## Summary\n${"x".repeat(6000)}`;
      const result = parseAgentResult(raw, request);
      const output = resultToNodeOutput(result);

      expect(output.raw!.length).toBeLessThan(6000);
      expect(output.raw).toContain("[truncated]");
    });
  });
});
