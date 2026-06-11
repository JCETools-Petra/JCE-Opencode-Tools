import { describe, test, expect } from "bun:test";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { OrchestrationController } from "../../src/plugin/lib/orchestration/controller.js";

const NOW = () => "2026-01-01T00:00:00.000Z";

function makeController(): OrchestrationController {
  return new OrchestrationController({ projectRoot: mkdtempSync(join(tmpdir(), "jce-controller-")), now: NOW });
}

describe("OrchestrationController — graph lifecycle safety", () => {
  test("createPlan clears stale node→task mappings from a prior graph", () => {
    const c = makeController();
    c.routeIntent("implement feature A");
    c.createPlan("implement feature A");

    const dispatch = c.getNextDispatch();
    expect(dispatch.length).toBeGreaterThan(0);
    const firstNodeId = dispatch[0].nodeId;
    c.mapNodeToTask(firstNodeId, "task-old-123");
    expect(c.getNodeForTask("task-old-123")).toBe(firstNodeId);

    // Creating a brand-new plan must invalidate the old mapping so a
    // late-completing old task cannot resolve to a stale node id.
    c.createPlan("implement feature B");
    expect(c.getNodeForTask("task-old-123")).toBeUndefined();
  });

  test("collectResult tolerates an unknown node id instead of throwing", () => {
    const c = makeController();
    c.routeIntent("fix the bug");
    c.createPlan("fix the bug");

    // A late/orphaned result for a node that does not exist must not throw
    // (a throw is turned into a spurious blocker by the caller).
    expect(() => c.collectResult("nonexistent-node", "## Summary\nlate result")).not.toThrow();
    const result = c.collectResult("nonexistent-node", "## Summary\nlate result");
    expect(result.status).toBe("success");
    expect(result.confidence).toBe(0);
    expect(result.blockers).toHaveLength(0);
  });

  test("replacing an in-flight graph records a replanning event", () => {
    const c = makeController();
    c.routeIntent("implement feature A");
    c.createPlan("implement feature A");
    c.createPlan("implement feature B");

    const events = c.getStatus().events;
    expect(events.some((e) => e.type === "graph.replanning" && /Replacing in-flight graph/.test(e.detail ?? ""))).toBe(true);
  });

  test("keeps superseded graphs in registry and can switch active graph", () => {
    const c = makeController();
    c.routeIntent("implement feature A");
    const first = c.createPlan("implement feature A");
    const second = c.createPlan("implement feature B");

    expect(c.getGraphRegistrySnapshot().graphIds).toEqual([first.id, second.id]);
    expect(c.getGraphRegistrySnapshot().activeGraphId).toBe(second.id);
    expect(c.switchActiveGraph(first.id)).toBe(true);
    expect(c.getGraph()?.id).toBe(first.id);
    expect(c.switchActiveGraph("missing")).toBe(false);
  });

  test("getNextDispatchAll dispatches across multiple graphs tagged by graphId", () => {
    const c = makeController();
    c.routeIntent("implement feature A");
    const first = c.createPlan("implement feature A");
    const second = c.createPlan("implement feature B");

    const dispatched = c.getNextDispatchAll();
    expect(dispatched.length).toBeGreaterThan(0);
    // Every dispatch is tagged with a known graph id.
    const knownIds = new Set([first.id, second.id]);
    for (const d of dispatched) {
      expect(knownIds.has(d.graphId)).toBe(true);
      expect(typeof d.nodeId).toBe("string");
    }
  });

  test("collectResultForGraph routes result to the owning graph and restores active pointer", () => {
    const c = makeController();
    c.routeIntent("implement feature A");
    const first = c.createPlan("implement feature A");
    const second = c.createPlan("implement feature B");
    // second is active after creation
    expect(c.getGraph()?.id).toBe(second.id);

    const dispatched = c.getNextDispatchAll();
    const firstGraphDispatch = dispatched.find((d) => d.graphId === first.id);
    expect(firstGraphDispatch).toBeDefined();

    const result = c.collectResultForGraph(first.id, firstGraphDispatch!.nodeId, "## Summary\ndone");
    expect(result.nodeId).toBe(firstGraphDispatch!.nodeId);
    // Active graph pointer must be restored to second after collecting into first.
    expect(c.getGraph()?.id).toBe(second.id);
  });

  test("collectResultForGraph throws on unknown graph id", () => {
    const c = makeController();
    c.routeIntent("implement feature A");
    c.createPlan("implement feature A");
    expect(() => c.collectResultForGraph("missing-graph", "n", "## Summary\nx")).toThrow();
  });
});
