import { describe, expect, test } from "bun:test";
import { buildPreFinalGuard } from "../../src/plugin/lib/pre-final-guard.js";
import { createEmptyRuntimeState } from "../../src/plugin/lib/runtime-state.js";
import { createWorkflowRun } from "../../src/plugin/lib/workflow.js";

describe("buildPreFinalGuard", () => {
  test("returns empty string when no workflow is active", () => {
    expect(buildPreFinalGuard(createEmptyRuntimeState("2026-01-01T00:00:00.000Z"))).toBe("");
  });

  test("injects active workflow verification context", () => {
    const memory = createEmptyRuntimeState("2026-01-01T00:00:00.000Z");
    memory.activeWorkflow = createWorkflowRun({ id: "workflow-1", goal: "fix bug", now: "2026-01-01T00:00:00.000Z" });
    memory.blockers = [{ id: "b1", reason: "missing tests" }];
    const guard = buildPreFinalGuard(memory);
    expect(guard).toContain("JCE Pre-Final Guard");
    expect(guard).toContain("workflow-1");
    expect(guard).toContain("Verification evidence recorded: no");
    expect(guard).toContain("Active blockers: 1");
  });
});
