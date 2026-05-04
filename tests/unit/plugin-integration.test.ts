import { describe, expect, test } from "bun:test";

const mockInput = {
  client: {} as any,
  project: {} as any,
  directory: "/tmp",
  worktree: "/tmp",
  serverUrl: new URL("http://localhost:3000"),
  $: {} as any,
  experimental_workspace: { register: () => {} },
} as any;

describe("plugin integration", () => {
  test("plugin server returns hooks with tools and event handler", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(mockInput);

    expect(hooks.tool).toBeDefined();
    expect(hooks.tool!.dispatch).toBeDefined();
    expect(hooks.tool!.bg_status).toBeDefined();
    expect(hooks.tool!.bg_collect).toBeDefined();
    expect(hooks.event).toBeDefined();
    expect(hooks.config).toBeDefined();
    expect(hooks["tool.execute.after"]).toBeDefined();
  });

  test("config hook injects 5 agents", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(mockInput);

    const config: any = { agent: {} };
    await hooks.config!(config);
    expect(Object.keys(config.agent)).toHaveLength(5);
    expect(config.agent.sisyphus).toBeDefined();
    expect(config.agent.oracle).toBeDefined();
    expect(config.agent.librarian).toBeDefined();
    expect(config.agent.explorer).toBeDefined();
    expect(config.agent.frontend).toBeDefined();
  });

  test("config hook does not overwrite existing agents", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(mockInput);

    const existingAgent = { model: "custom-model", systemPrompt: "custom" };
    const config: any = { agent: { sisyphus: existingAgent } };
    await hooks.config!(config);
    expect(config.agent.sisyphus).toBe(existingAgent);
    expect(config.agent.oracle).toBeDefined();
  });

  test("config hook creates agent object if missing", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(mockInput);

    const config: any = {};
    await hooks.config!(config);
    expect(Object.keys(config.agent)).toHaveLength(5);
  });

  test("tool.execute.after appends warning for excessive comments", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(mockInput);

    const input = { tool: "Write", sessionID: "s", callID: "c", args: { filePath: "test.ts" } };
    // 10 lines, 5 are comments = 50% ratio > 40% threshold
    const output = {
      title: "Write",
      output: "// comment\n// comment\n// comment\n// comment\n// comment\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;",
      metadata: {},
    };
    await hooks["tool.execute.after"]!(input, output);
    expect(output.output).toContain("COMMENT CHECK");
  });

  test("tool.execute.after does not warn for normal code", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(mockInput);

    const input = { tool: "Write", sessionID: "s", callID: "c", args: { filePath: "test.ts" } };
    const output = {
      title: "Write",
      output: "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\n// one comment",
      metadata: {},
    };
    await hooks["tool.execute.after"]!(input, output);
    expect(output.output).not.toContain("COMMENT CHECK");
  });
});
