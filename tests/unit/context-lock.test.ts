import { describe, test, expect } from "bun:test";
import { detectConflict, mergeContexts } from "../../src/lib/context-lock";

describe("detectConflict()", () => {
  test("returns no conflict when hash matches", () => {
    const result = detectConflict("abc123", "abc123");
    expect(result.hasConflict).toBe(false);
  });

  test("returns conflict when hash differs", () => {
    const result = detectConflict("abc123", "def456");
    expect(result.hasConflict).toBe(true);
  });

  test("returns no conflict when expected hash is undefined (first write)", () => {
    const result = detectConflict(undefined, "abc123");
    expect(result.hasConflict).toBe(false);
  });
});

describe("mergeContexts()", () => {
  test("merges non-overlapping additions from two versions", () => {
    const base = `## Stack\n- TypeScript\n\n## Current Status\n- [ ] Task A\n`;
    const ours = `## Stack\n- TypeScript\n\n## Current Status\n- [ ] Task A\n- [ ] Task B\n`;
    const theirs = `## Stack\n- TypeScript\n- Bun\n\n## Current Status\n- [ ] Task A\n`;
    const merged = mergeContexts(base, ours, theirs);
    expect(merged).toContain("- TypeScript");
    expect(merged).toContain("- Bun");
    expect(merged).toContain("- [ ] Task B");
  });

  test("deduplicates identical additions", () => {
    const base = `## Stack\n- TypeScript\n`;
    const ours = `## Stack\n- TypeScript\n- Bun\n`;
    const theirs = `## Stack\n- TypeScript\n- Bun\n`;
    const merged = mergeContexts(base, ours, theirs);
    const bunCount = (merged.match(/- Bun/g) || []).length;
    expect(bunCount).toBe(1);
  });

  test("preserves both sides on replace conflict", () => {
    const base = `## Current Status\n- [ ] Old task\n`;
    const ours = `## Current Status\n- [ ] Our task\n`;
    const theirs = `## Current Status\n- [ ] Their task\n`;
    const merged = mergeContexts(base, ours, theirs);
    expect(merged).toContain("Our task");
    expect(merged).toContain("Their task");
  });
});
