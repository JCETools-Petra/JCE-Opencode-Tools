import { describe, test, expect } from "bun:test";
import { $ } from "bun";

describe("CLI Commands", () => {
  test("--help shows all commands", async () => {
    const result = await $`bun run src/index.ts --help`.text();
    expect(result).toContain("validate");
    expect(result).toContain("use");
    expect(result).toContain("doctor");
    expect(result).toContain("uninstall");
    expect(result).toContain("update");
    expect(result).toContain("setup");
    expect(result).toContain("route");
    expect(result).toContain("tokens");
    expect(result).toContain("optimize");
    expect(result).toContain("agent");
    expect(result).toContain("prompts");
    expect(result).toContain("plugin");
    expect(result).toContain("team");
    expect(result).toContain("memory");
    expect(result).toContain("dashboard");
    expect(result).toContain("fallback");
  });

  test("--version shows version", async () => {
    const result = await $`bun run src/index.ts --version`.text();
    expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("validate command runs without crash", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "validate"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    // May exit 1 if no config deployed, but shouldn't crash
    expect([0, 1]).toContain(proc.exitCode);
  });

  test("use --list runs without crash", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "use", "--list"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    expect([0, 1]).toContain(proc.exitCode);
  });

  test("route command runs without crash", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "route", "hello world"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    // May exit 1 if no profiles deployed, but shouldn't crash
    expect([0, 1]).toContain(proc.exitCode);
  });

  test("agent list runs", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "agent", "list"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    expect([0, 1]).toContain(proc.exitCode);
  });

  test("prompts list runs without crash", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "prompts", "list"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    // May exit 0 with templates or 0 with "no templates" message
    expect([0, 1]).toContain(proc.exitCode);
  });
});
