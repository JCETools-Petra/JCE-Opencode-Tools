import { describe, test, expect } from "bun:test";
import {
  jaccardSimilarity,
  findDuplicates,
  smartPrune,
  detectResolvedNotes,
} from "../../src/lib/context-similarity";

describe("jaccardSimilarity()", () => {
  test("returns 1.0 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1.0);
  });

  test("returns 0.0 for completely different strings", () => {
    expect(jaccardSimilarity("abc", "xyz")).toBe(0.0);
  });

  test("returns value between 0 and 1 for partial overlap", () => {
    const sim = jaccardSimilarity("use postgresql database", "postgresql for database");
    expect(sim).toBeGreaterThan(0.4);
    expect(sim).toBeLessThan(1.0);
  });

  test("is case-insensitive", () => {
    expect(jaccardSimilarity("TypeScript", "typescript")).toBe(1.0);
  });

  test("returns 1.0 for two empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(1.0);
  });

  test("returns 0.0 for one empty and one non-empty", () => {
    expect(jaccardSimilarity("", "hello")).toBe(0.0);
    expect(jaccardSimilarity("hello", "")).toBe(0.0);
  });
});

describe("findDuplicates()", () => {
  test("finds semantically similar entries", () => {
    const lines = [
      "- Use PostgreSQL for database",
      "- PostgreSQL is the database choice",
      "- Deploy with Docker",
    ];
    const dupes = findDuplicates(lines, 0.6);
    expect(dupes.length).toBe(1);
    expect(dupes[0].kept).toBe("- Use PostgreSQL for database");
    expect(dupes[0].removed).toBe("- PostgreSQL is the database choice");
  });

  test("returns empty array when no duplicates", () => {
    const lines = ["- TypeScript", "- Docker", "- PostgreSQL"];
    const dupes = findDuplicates(lines, 0.6);
    expect(dupes.length).toBe(0);
  });

  test("does not double-count removed lines", () => {
    const lines = [
      "- Use PostgreSQL for database",
      "- PostgreSQL is the database choice",
      "- PostgreSQL database is used",
    ];
    const dupes = findDuplicates(lines, 0.6);
    // Line 1 and 2 are similar, line 2 removed.
    // Line 2 is already removed so line 3 compared against line 1 only.
    for (const d of dupes) {
      expect(d.kept).toBe("- Use PostgreSQL for database");
    }
  });
});

describe("detectResolvedNotes()", () => {
  test("detects notes with resolved keywords", () => {
    const lines = [
      "- Bug in auth module fixed yesterday",
      "- Performance issue resolved in v2",
      "- Need to add rate limiting",
      "- Migration completed successfully",
    ];
    const resolved = detectResolvedNotes(lines);
    expect(resolved).toContain("- Bug in auth module fixed yesterday");
    expect(resolved).toContain("- Performance issue resolved in v2");
    expect(resolved).toContain("- Migration completed successfully");
    expect(resolved).not.toContain("- Need to add rate limiting");
  });

  test("detects all resolved keywords", () => {
    const lines = [
      "- Task done",
      "- Feature finished",
      "- PR merged",
      "- App deployed",
      "- Issue closed",
    ];
    const resolved = detectResolvedNotes(lines);
    expect(resolved.length).toBe(5);
  });

  test("is case-insensitive", () => {
    const lines = ["- Bug FIXED", "- Issue RESOLVED"];
    const resolved = detectResolvedNotes(lines);
    expect(resolved.length).toBe(2);
  });
});

describe("smartPrune()", () => {
  test("removes duplicates and resolved notes from content", () => {
    const content = `## Architecture Decisions
- Use PostgreSQL for database
- PostgreSQL is the database choice
- Deploy with Docker

## Important Notes
- Bug fixed in auth
- Need to add rate limiting`;
    const result = smartPrune(content);
    expect(result.prunedContent).not.toContain("PostgreSQL is the database choice");
    expect(result.prunedContent).toContain("Use PostgreSQL for database");
    expect(result.prunedContent).toContain("Deploy with Docker");
    expect(result.prunedContent).not.toContain("Bug fixed in auth");
    expect(result.prunedContent).toContain("Need to add rate limiting");
    expect(result.actions.length).toBeGreaterThan(0);
  });

  test("replaces empty section with '- (none yet)'", () => {
    const content = `## Architecture Decisions
- (none yet)

## Important Notes
- Bug fixed in auth`;
    const result = smartPrune(content);
    expect(result.prunedContent).toContain("- (none yet)");
  });

  test("handles content with no sections to prune", () => {
    const content = `## Architecture Decisions
- Use TypeScript
- Deploy with Docker

## Important Notes
- Need to add rate limiting`;
    const result = smartPrune(content);
    expect(result.prunedContent).toContain("Use TypeScript");
    expect(result.prunedContent).toContain("Deploy with Docker");
    expect(result.prunedContent).toContain("Need to add rate limiting");
  });
});
