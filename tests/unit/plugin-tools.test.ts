import { describe, expect, test } from "bun:test";
import { buildDispatchTool, buildStatusTool, buildCollectTool } from "../../src/plugin/tools/dispatch.ts";
import { BackgroundManager } from "../../src/plugin/background/manager.ts";

describe("plugin tools", () => {
  test("dispatch tool has description and args", () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const tool = buildDispatchTool(manager, {} as any);
    expect(tool.description).toContain("background");
    expect(tool.args).toBeDefined();
  });

  test("status tool returns formatted task list", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    manager.createTask({
      description: "Find endpoints",
      prompt: "p",
      agent: "explorer",
      parentSessionId: "s",
      parentMessageId: "m",
    });
    const tool = buildStatusTool(manager);
    const result = await tool.execute({} as any, {
      sessionID: "s",
      messageID: "m",
      agent: "explorer",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: () => { throw new Error("not implemented"); },
    } as any);
    expect(result).toContain("Find endpoints");
    expect(result).toContain("PENDING");
    expect(result).toContain("explorer");
  });

  test("status tool returns empty message when no tasks", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const tool = buildStatusTool(manager);
    const result = await tool.execute({} as any, {
      sessionID: "s",
      messageID: "m",
      agent: "explorer",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: () => { throw new Error("not implemented"); },
    } as any);
    expect(result).toBe("No background tasks.");
  });

  test("collect tool returns result for completed task", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({
      description: "test",
      prompt: "p",
      agent: "explorer",
      parentSessionId: "s",
      parentMessageId: "m",
    });
    manager.completeTask(task.id, "Found 5 API endpoints");
    const tool = buildCollectTool(manager);
    const result = await tool.execute({ taskId: task.id } as any, {
      sessionID: "s",
      messageID: "m",
      agent: "explorer",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: () => { throw new Error("not implemented"); },
    } as any);
    expect(result).toContain("Found 5 API endpoints");
  });

  test("collect tool reports pending status", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({
      description: "test",
      prompt: "p",
      agent: "explorer",
      parentSessionId: "s",
      parentMessageId: "m",
    });
    const tool = buildCollectTool(manager);
    const result = await tool.execute({ taskId: task.id } as any, {
      sessionID: "s",
      messageID: "m",
      agent: "explorer",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: () => { throw new Error("not implemented"); },
    } as any);
    expect(result).toContain("still pending");
  });

  test("collect tool reports error", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({
      description: "test",
      prompt: "p",
      agent: "explorer",
      parentSessionId: "s",
      parentMessageId: "m",
    });
    manager.failTask(task.id, "Network timeout");
    const tool = buildCollectTool(manager);
    const result = await tool.execute({ taskId: task.id } as any, {
      sessionID: "s",
      messageID: "m",
      agent: "explorer",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: () => { throw new Error("not implemented"); },
    } as any);
    expect(result).toContain("failed");
    expect(result).toContain("Network timeout");
  });
});
