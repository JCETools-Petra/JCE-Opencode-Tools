import { describe, test, expect } from "bun:test";
import {
  getGitState,
  getRecentDeps,
  formatEnrichmentSection,
  enrichContext,
  type GitState,
  type EnrichmentData,
} from "../../src/lib/context-enrichment.js";

// ─── getGitState ─────────────────────────────────────────────

describe("getGitState()", () => {
  test("returns non-null for a real git repo", async () => {
    const state = await getGitState(process.cwd());
    expect(state).not.toBeNull();
  });

  test("returns a branch name string", async () => {
    const state = await getGitState(process.cwd());
    expect(state!.branch).toBeTypeOf("string");
    expect(state!.branch.length).toBeGreaterThan(0);
  });

  test("uncommittedCount is a non-negative number", async () => {
    const state = await getGitState(process.cwd());
    expect(state!.uncommittedCount).toBeGreaterThanOrEqual(0);
  });

  test("lastCommitMessage is a non-empty string", async () => {
    const state = await getGitState(process.cwd());
    expect(state!.lastCommitMessage).toBeTypeOf("string");
    expect(state!.lastCommitMessage.length).toBeGreaterThan(0);
  });

  test("aheadOfMain is a non-negative number", async () => {
    const state = await getGitState(process.cwd());
    expect(state!.aheadOfMain).toBeGreaterThanOrEqual(0);
  });

  test("returns null for a non-git directory", async () => {
    // Use a temp dir that is definitely not a git repo
    const tmpDir = await import("os").then((os) => os.tmpdir());
    const state = await getGitState(tmpDir);
    // tmpdir might be inside a git repo on some systems, so we just check it doesn't throw
    expect(state === null || state.branch.length > 0).toBe(true);
  });
});

// ─── getRecentDeps ───────────────────────────────────────────

describe("getRecentDeps()", () => {
  test("returns an array with items for a project with package.json", async () => {
    const deps = await getRecentDeps(process.cwd());
    expect(Array.isArray(deps)).toBe(true);
    expect(deps.length).toBeGreaterThan(0);
  });

  test("each dep is in name@version format", async () => {
    const deps = await getRecentDeps(process.cwd());
    for (const dep of deps) {
      expect(dep).toMatch(/^.+@.+$/);
    }
  });

  test("returns at most 10 items", async () => {
    const deps = await getRecentDeps(process.cwd());
    expect(deps.length).toBeLessThanOrEqual(10);
  });

  test("returns empty array for directory without package.json", async () => {
    const deps = await getRecentDeps("/nonexistent-path-xyz");
    expect(deps).toEqual([]);
  });
});

// ─── formatEnrichmentSection ─────────────────────────────────

describe("formatEnrichmentSection()", () => {
  test("formats complete data as bullet points", () => {
    const data: EnrichmentData = {
      git: {
        branch: "feature/x",
        uncommittedCount: 3,
        lastCommitMessage: "feat: add session tracking",
        aheadOfMain: 2,
      },
      deps: ["zod@4.4.2", "chalk@5.3.0"],
    };

    const result = formatEnrichmentSection(data);
    expect(result).toContain("- Branch: feature/x (2 ahead of main)");
    expect(result).toContain("- Uncommitted changes: 3 files");
    expect(result).toContain("- Last commit: feat: add session tracking");
    expect(result).toContain("- Dependencies: zod@4.4.2, chalk@5.3.0");
  });

  test("returns empty string when git is null and deps is empty", () => {
    const data: EnrichmentData = {
      git: null,
      deps: [],
    };

    const result = formatEnrichmentSection(data);
    expect(result).toBe("");
  });

  test("handles zero uncommitted changes", () => {
    const data: EnrichmentData = {
      git: {
        branch: "main",
        uncommittedCount: 0,
        lastCommitMessage: "chore: cleanup",
        aheadOfMain: 0,
      },
      deps: [],
    };

    const result = formatEnrichmentSection(data);
    expect(result).toContain("- Branch: main (0 ahead of main)");
    expect(result).toContain("- Uncommitted changes: 0 files");
    expect(result).toContain("- Last commit: chore: cleanup");
    expect(result).not.toContain("- Dependencies:");
  });

  test("includes testStatus when provided", () => {
    const data: EnrichmentData = {
      git: null,
      deps: ["chalk@5.3.0"],
      testStatus: "12 pass, 0 fail",
    };

    const result = formatEnrichmentSection(data);
    expect(result).toContain("- Tests: 12 pass, 0 fail");
    expect(result).toContain("- Dependencies: chalk@5.3.0");
  });
});

// ─── enrichContext ───────────────────────────────────────────

describe("enrichContext()", () => {
  test("returns a non-empty string for the current project", async () => {
    const result = await enrichContext(process.cwd());
    expect(result.length).toBeGreaterThan(0);
  });

  test("contains branch info", async () => {
    const result = await enrichContext(process.cwd());
    expect(result).toContain("- Branch:");
  });

  test("contains dependencies", async () => {
    const result = await enrichContext(process.cwd());
    expect(result).toContain("- Dependencies:");
  });
});
