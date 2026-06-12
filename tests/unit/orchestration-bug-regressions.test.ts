import { describe, expect, test } from "bun:test";
import { determineSkillsForMessage } from "../../src/plugin/lib/skill-loader.js";
import { matchWorkflowTemplate } from "../../src/plugin/lib/orchestration/workflow-templates.js";
import { pruneMemoryV2, createEmptyMemoryV2 } from "../../src/plugin/lib/orchestration/execution-memory-v2.js";
import { evaluateCompletionGate } from "../../src/plugin/lib/orchestration/intelligence.js";
import {
  createTaskGraph,
  addNode,
  addEdge,
  transitionNode,
  completeNode,
  deriveGraphStatus,
} from "../../src/plugin/lib/orchestration/task-graph.js";
import { shouldEnforceContinuation } from "../../src/plugin/hooks/todo-enforcer.js";
import type { Decision, Fact } from "../../src/plugin/lib/orchestration/types.js";

const NOW = "2026-01-01T00:00:00.000Z";

// ─── Batch A ─────────────────────────────────────────────────

describe("regression: skill routing (#1 android false-positive)", () => {
  test("'permission' in a React prompt does NOT route to Android", () => {
    const skills = determineSkillsForMessage("add a permission check to this React component");
    expect(skills).not.toContain("android-kotlin");
    expect(skills).not.toContain("android-security");
    expect(skills).toContain("react");
  });

  test("genuine Android permission prompt still routes to Android", () => {
    const skills = determineSkillsForMessage("the app crashes requesting android.permission.CAMERA in AndroidManifest");
    expect(skills.some((s) => s.startsWith("android-"))).toBe(true);
  });
});

describe("regression: workflow template minComplexity (#4)", () => {
  test("trivial single-word goal does NOT trigger a full template", () => {
    // Below minComplexity (2) → no template.
    expect(matchWorkflowTemplate("incident", 0)).toBeNull();
    expect(matchWorkflowTemplate("restructure", 1)).toBeNull();
  });

  test("complex goal above threshold still matches its template", () => {
    expect(matchWorkflowTemplate("production is down after deploy, multiple users impacted, need rollback", 5)?.id).toBe("incident-response");
  });
});

// ─── Batch B ─────────────────────────────────────────────────

describe("regression: decision prune does not exceed limit (#3)", () => {
  test("over-budget active decisions never produce a negative slice", () => {
    const mem = createEmptyMemoryV2(NOW);
    // 60 active decisions (> maxDecisions 50) + 100 inactive.
    const decisions: Decision[] = [];
    for (let i = 0; i < 60; i++) decisions.push({ id: `a${i}`, description: "d", reasoning: "r", alternatives: [], status: "active", madeAt: NOW });
    for (let i = 0; i < 100; i++) decisions.push({ id: `s${i}`, description: "d", reasoning: "r", alternatives: [], status: "superseded", madeAt: NOW });
    mem.decisions = decisions;
    const pruned = pruneMemoryV2(mem, NOW);
    // All 60 active kept, 0 inactive (budget exhausted) — never the buggy 150.
    expect(pruned.decisions.length).toBe(60);
    expect(pruned.decisions.every((d) => d.status === "active")).toBe(true);
  });
});

describe("regression: NaN timestamps get pruned (#11)", () => {
  test("a fact with an unparseable expiresAt is removed, not kept forever", () => {
    const mem = createEmptyMemoryV2(NOW);
    const good: Fact = { id: "f1", key: "k1", value: "v", source: "agent", confidence: 0.9, discoveredAt: NOW };
    const corrupt: Fact = { id: "f2", key: "k2", value: "v", source: "agent", confidence: 0.9, discoveredAt: NOW, expiresAt: "not-a-date" };
    mem.facts = [good, corrupt];
    const pruned = pruneMemoryV2(mem, NOW);
    expect(pruned.facts.find((f) => f.id === "f2")).toBeUndefined();
    expect(pruned.facts.find((f) => f.id === "f1")).toBeDefined();
  });
});

describe("regression: all-cancelled graph does not pass completion gate (#5)", () => {
  test("a graph whose only node is cancelled is NOT completable", () => {
    let g = createTaskGraph({ id: "ac", goal: "x", now: NOW });
    g = addNode(g, { id: "n1", type: "code", title: "build", description: "", agent: "self", prompt: "p" }, NOW);
    g = transitionNode(g, "n1", "cancelled", NOW);
    const gate = evaluateCompletionGate(g);
    expect(gate.canComplete).toBe(false);
    expect(gate.blockers.some((b) => /cancelled/i.test(b))).toBe(true);
  });
});

// ─── Batch C ─────────────────────────────────────────────────

describe("regression: stuck-graph deadlock detection (#2)", () => {
  test("a failed dependency that strands its dependent marks the graph failed (not stuck executing)", () => {
    let g = createTaskGraph({ id: "dl", goal: "x", now: NOW });
    g = addNode(g, { id: "a", type: "code", title: "A", description: "", agent: "self", prompt: "p" }, NOW);
    g = addNode(g, { id: "b", type: "code", title: "B", description: "", agent: "self", prompt: "p", dependencies: ["a"] }, NOW);
    g = addEdge(g, { from: "a", to: "b", type: "blocks" }, NOW);
    // A runs and fails permanently; B is stranded in pending.
    g = transitionNode(g, "a", "ready", NOW);
    g = transitionNode(g, "a", "running", NOW);
    g = transitionNode(g, "a", "failed", NOW);
    const status = deriveGraphStatus(g);
    expect(status).toBe("failed");
  });

  test("a healthy in-progress graph is still 'executing' (no false deadlock)", () => {
    let g = createTaskGraph({ id: "ok", goal: "x", now: NOW });
    g = addNode(g, { id: "a", type: "code", title: "A", description: "", agent: "self", prompt: "p" }, NOW);
    g = addNode(g, { id: "b", type: "code", title: "B", description: "", agent: "self", prompt: "p", dependencies: ["a"] }, NOW);
    g = addEdge(g, { from: "a", to: "b", type: "blocks" }, NOW);
    g = transitionNode(g, "a", "ready", NOW);
    g = transitionNode(g, "a", "running", NOW);
    g = completeNode(g, "a", { summary: "s", artifacts: [], evidence: [], newFacts: [], confidence: 0.9 }, NOW);
    // B is now pending with a satisfied dependency — the graph must NOT be
    // falsely marked failed by the deadlock detector (the real regression guard).
    const status = deriveGraphStatus(g);
    expect(status).not.toBe("failed");
  });
});

// ─── Batch D ─────────────────────────────────────────────────

describe("regression: todo-enforcer ignores code blocks (#9)", () => {
  test("a markdown checklist inside a fenced code block does NOT trigger enforcement", () => {
    const messages = [
      { role: "assistant", content: "Here is an example todo format:\n```md\n- [ ] do the thing\n```\nAll done." },
    ];
    expect(shouldEnforceContinuation(messages)).toBe(false);
  });

  test("a real (non-code) incomplete checklist still triggers enforcement", () => {
    const messages = [
      { role: "assistant", content: "- [ ] Fix bug\n- [x] Write test" },
    ];
    expect(shouldEnforceContinuation(messages)).toBe(true);
  });

  test("JSON with pending status inside a code block does NOT trigger", () => {
    const messages = [
      { role: "assistant", content: "Example output:\n```json\n[{\"status\": \"pending\"}]\n```\nFinished." },
    ];
    expect(shouldEnforceContinuation(messages)).toBe(false);
  });
});
