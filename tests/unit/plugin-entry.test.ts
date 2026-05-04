import { describe, expect, test } from "bun:test";

describe("plugin entry point", () => {
  test("exports a valid PluginModule with id and server function", async () => {
    const mod = await import("../../src/plugin/index.ts");
    expect(mod.default).toBeDefined();
    expect(mod.default.id).toBe("opencode-jce");
    expect(typeof mod.default.server).toBe("function");
  });

  test("server function returns a hooks object", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(
      {
        client: {} as any,
        project: {} as any,
        directory: "/tmp",
        worktree: "/tmp",
        serverUrl: new URL("http://localhost:3000"),
        $: {} as any,
        experimental_workspace: { register: () => {} },
      } as any,
    );
    expect(hooks).toBeDefined();
    expect(typeof hooks).toBe("object");
  });
});
