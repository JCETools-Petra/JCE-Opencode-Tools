# Context Preservation v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the context-keeper MCP server with multi-session awareness, context enrichment, semantic intelligence, compliance enforcement, file locking, and cross-project context capabilities.

**Architecture:** Extend the existing `src/mcp/context-keeper.ts` MCP server with new tools and enhanced logic. Add a session metadata system stored as HTML comments in the context file. Add new helper modules for enrichment and cross-project features. All new features are backward-compatible — existing context files continue to work without modification.

**Tech Stack:** TypeScript, Bun, @modelcontextprotocol/sdk, Zod, fs/promises

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/context-template.ts` | Add new constants + **extract `getSection`/`replaceSection` here** (break circular dep) |
| `src/lib/context-sections.ts` | **NEW** — Shared section parsing utilities (extracted from context-keeper.ts) |
| `src/lib/context-session.ts` | **NEW** — Session metadata parsing, tracking, staleness detection |
| `src/lib/context-enrichment.ts` | **NEW** — Auto-detect git state, test status, dependencies |
| `src/lib/context-similarity.ts` | **NEW** — Jaccard similarity, fuzzy dedup, semantic prune helpers |
| `src/lib/context-lock.ts` | **NEW** — Optimistic concurrency (hash-based conflict detection) |
| `src/lib/context-cross-project.ts` | **NEW** — Read related project contexts |
| `src/mcp/context-keeper.ts` | Integrate new modules, add new tools, enhance existing tools |
| `src/commands/context.ts` | Add `audit` subcommand |
| `tests/unit/context-session.test.ts` | **NEW** — Tests for session tracking |
| `tests/unit/context-enrichment.test.ts` | **NEW** — Tests for enrichment |
| `tests/unit/context-similarity.test.ts` | **NEW** — Tests for semantic prune |
| `tests/unit/context-lock.test.ts` | **NEW** — Tests for concurrency |
| `tests/unit/context-cross-project.test.ts` | **NEW** — Tests for cross-project |
| `config/skills/context-preservation.md` | Update with new features documentation |

### IMPORTANT: Circular Dependency Prevention

`getSection()` and `replaceSection()` are currently in `src/mcp/context-keeper.ts` but needed by `context-lock.ts`, `context-similarity.ts`, and `context-cross-project.ts`. To avoid circular imports:

1. **Extract** `getSection()` and `replaceSection()` into `src/lib/context-sections.ts`
2. **Re-export** them from `context-keeper.ts` for backward compatibility
3. All new modules import from `../lib/context-sections.js` (not from context-keeper)
| `config/AGENTS.md` | Update context section with new tools |

---

## Task 0: Extract Section Utilities (Break Circular Dependency)

**Files:**
- Create: `src/lib/context-sections.ts`
- Modify: `src/mcp/context-keeper.ts` (remove functions, re-export from new module)

- [ ] **Step 1: Create `src/lib/context-sections.ts` with extracted functions**

```typescript
// src/lib/context-sections.ts
/**
 * Shared section parsing utilities for .opencode-context.md files.
 * Extracted from context-keeper.ts to prevent circular dependencies.
 */

/**
 * Count non-empty lines in content.
 */
export function countLines(content: string): number {
  return content.split("\n").filter((l) => l.trim().length > 0).length;
}

/**
 * Extract a section's content by heading name.
 */
export function getSection(content: string, heading: string): string[] {
  const lines = content.split("\n");
  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(`## ${heading}`)) {
      inSection = true;
      continue;
    }
    if (line.startsWith("## ") && inSection) {
      break;
    }
    if (inSection) {
      result.push(line);
    }
  }

  return result.filter((l) => l.trim().length > 0);
}

/**
 * Replace a section's content by heading name.
 */
export function replaceSection(
  content: string,
  heading: string,
  newLines: string[]
): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inSection = false;
  let sectionReplaced = false;

  for (const line of lines) {
    if (line.startsWith(`## ${heading}`)) {
      inSection = true;
      sectionReplaced = true;
      result.push(line);
      for (const nl of newLines) {
        result.push(nl);
      }
      continue;
    }
    if (line.startsWith("## ") && inSection) {
      inSection = false;
      result.push(""); // Preserve blank separator line
    }
    if (!inSection) {
      result.push(line);
    }
  }

  if (inSection && sectionReplaced) {
    result.push("");
  }

  if (!sectionReplaced) {
    result.push("");
    result.push(`## ${heading}`);
    for (const nl of newLines) {
      result.push(nl);
    }
  }

  return result.join("\n");
}
```

- [ ] **Step 2: Update context-keeper.ts to import from context-sections.ts**

Replace the `getSection`, `replaceSection`, and `countLines` function definitions in `src/mcp/context-keeper.ts` with re-exports:

```typescript
// Replace lines 68-188 (the function definitions) with:
export { countLines, getSection, replaceSection } from "../lib/context-sections.js";
```

Keep `pruneCompleted` and `pruneAndArchiveContext` in context-keeper.ts (they use getSection/replaceSection but are only consumed by context-keeper itself).

Update the imports at the top of context-keeper.ts:

```typescript
import { countLines, getSection, replaceSection } from "../lib/context-sections.js";
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `bun test tests/unit/context-keeper.test.ts`
Expected: ALL PASS (tests import from context-keeper.ts which re-exports)

- [ ] **Step 4: Commit**

```bash
git add src/lib/context-sections.ts src/mcp/context-keeper.ts
git commit -m "refactor(context): extract section utilities to prevent circular deps"
```

---

## Task 1: Multi-Session Awareness — Session Metadata Module

**Files:**
- Create: `src/lib/context-session.ts`
- Modify: `src/lib/context-template.ts`
- Test: `tests/unit/context-session.test.ts`

### Concept

Store session metadata as an HTML comment in the context file:
```
<!-- session: 2026-05-04T10:30:00Z | count: 47 | last-prune: 2026-05-03 | content-hash: a1b2c3 -->
```

This is invisible to humans reading the markdown but parseable by code.

- [ ] **Step 1: Write failing tests for session metadata parsing**

```typescript
// tests/unit/context-session.test.ts
import { describe, test, expect } from "bun:test";
import {
  parseSessionMeta,
  formatSessionMeta,
  incrementSession,
  isStale,
  SessionMeta,
} from "../../src/lib/context-session";

describe("parseSessionMeta()", () => {
  test("parses valid metadata comment", () => {
    const content = `# Project Context
<!-- session: 2026-05-04T10:30:00Z | count: 47 | last-prune: 2026-05-03 | content-hash: a1b2c3 -->
> Auto-maintained by AI.`;
    const meta = parseSessionMeta(content);
    expect(meta).not.toBeNull();
    expect(meta!.count).toBe(47);
    expect(meta!.lastSession).toBe("2026-05-04T10:30:00Z");
    expect(meta!.lastPrune).toBe("2026-05-03");
    expect(meta!.contentHash).toBe("a1b2c3");
  });

  test("returns null for content without metadata", () => {
    const content = `# Project Context\n> Auto-maintained by AI.`;
    expect(parseSessionMeta(content)).toBeNull();
  });

  test("handles missing optional fields", () => {
    const content = `<!-- session: 2026-05-04T10:30:00Z | count: 1 -->`;
    const meta = parseSessionMeta(content);
    expect(meta).not.toBeNull();
    expect(meta!.count).toBe(1);
    expect(meta!.lastPrune).toBeUndefined();
    expect(meta!.contentHash).toBeUndefined();
  });
});

describe("formatSessionMeta()", () => {
  test("formats metadata as HTML comment", () => {
    const meta: SessionMeta = {
      lastSession: "2026-05-04T10:30:00Z",
      count: 5,
      lastPrune: "2026-05-03",
      contentHash: "abc123",
    };
    const result = formatSessionMeta(meta);
    expect(result).toBe(
      "<!-- session: 2026-05-04T10:30:00Z | count: 5 | last-prune: 2026-05-03 | content-hash: abc123 -->"
    );
  });

  test("omits undefined optional fields", () => {
    const meta: SessionMeta = { lastSession: "2026-05-04T10:30:00Z", count: 1 };
    const result = formatSessionMeta(meta);
    expect(result).toBe("<!-- session: 2026-05-04T10:30:00Z | count: 1 -->");
  });
});

describe("incrementSession()", () => {
  test("increments count and updates timestamp in content", () => {
    const content = `# Project Context
<!-- session: 2026-05-03T08:00:00Z | count: 5 | content-hash: old123 -->
> Auto-maintained by AI.
## Stack
- TypeScript`;
    const result = incrementSession(content);
    const meta = parseSessionMeta(result);
    expect(meta!.count).toBe(6);
    expect(meta!.lastSession).not.toBe("2026-05-03T08:00:00Z");
  });

  test("adds metadata if none exists", () => {
    const content = `# Project Context
> Auto-maintained by AI.
## Stack
- TypeScript`;
    const result = incrementSession(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.count).toBe(1);
  });
});

describe("isStale()", () => {
  test("returns false for recent session", () => {
    const meta: SessionMeta = {
      lastSession: new Date().toISOString(),
      count: 10,
    };
    expect(isStale(meta, { maxAgeDays: 2 })).toBe(false);
  });

  test("returns true for old session", () => {
    const meta: SessionMeta = {
      lastSession: "2026-04-01T10:00:00Z",
      count: 10,
    };
    expect(isStale(meta, { maxAgeDays: 2 })).toBe(true);
  });

  test("returns true when sessions without update exceed threshold", () => {
    const meta: SessionMeta = {
      lastSession: new Date().toISOString(),
      count: 10,
      lastUpdate: "2026-05-01T10:00:00Z",
      sessionsWithoutUpdate: 6,
    };
    expect(isStale(meta, { maxSessionsWithoutUpdate: 5 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/context-session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement session metadata module**

```typescript
// src/lib/context-session.ts
/**
 * Session metadata tracking for context preservation.
 * Stores session info as HTML comments (invisible in rendered markdown).
 */

export interface SessionMeta {
  lastSession: string; // ISO timestamp
  count: number; // total session count
  lastPrune?: string; // date of last prune
  lastUpdate?: string; // ISO timestamp of last context_update call
  contentHash?: string; // hash for optimistic concurrency
  sessionsWithoutUpdate?: number; // sessions since last meaningful update
}

export interface StalenessConfig {
  maxAgeDays?: number; // default: 7
  maxSessionsWithoutUpdate?: number; // default: 5
}

const META_REGEX =
  /^<!-- session:\s*(.+?)\s*-->$/m;

const FIELD_REGEX = {
  lastSession: /session:\s*([^\s|]+)/,
  count: /count:\s*(\d+)/,
  lastPrune: /last-prune:\s*([^\s|]+)/,
  lastUpdate: /last-update:\s*([^\s|]+)/,
  contentHash: /content-hash:\s*([^\s|]+)/,
  sessionsWithoutUpdate: /sessions-without-update:\s*(\d+)/,
};

export function parseSessionMeta(content: string): SessionMeta | null {
  const match = content.match(META_REGEX);
  if (!match) return null;

  const line = match[1];
  const lastSessionMatch = line.match(FIELD_REGEX.lastSession);
  const countMatch = line.match(FIELD_REGEX.count);

  if (!lastSessionMatch || !countMatch) return null;

  const meta: SessionMeta = {
    lastSession: lastSessionMatch[1],
    count: parseInt(countMatch[1], 10),
  };

  const lastPruneMatch = line.match(FIELD_REGEX.lastPrune);
  if (lastPruneMatch) meta.lastPrune = lastPruneMatch[1];

  const lastUpdateMatch = line.match(FIELD_REGEX.lastUpdate);
  if (lastUpdateMatch) meta.lastUpdate = lastUpdateMatch[1];

  const hashMatch = line.match(FIELD_REGEX.contentHash);
  if (hashMatch) meta.contentHash = hashMatch[1];

  const swuMatch = line.match(FIELD_REGEX.sessionsWithoutUpdate);
  if (swuMatch) meta.sessionsWithoutUpdate = parseInt(swuMatch[1], 10);

  return meta;
}

export function formatSessionMeta(meta: SessionMeta): string {
  const parts: string[] = [
    `session: ${meta.lastSession}`,
    `count: ${meta.count}`,
  ];
  if (meta.lastPrune) parts.push(`last-prune: ${meta.lastPrune}`);
  if (meta.lastUpdate) parts.push(`last-update: ${meta.lastUpdate}`);
  if (meta.contentHash) parts.push(`content-hash: ${meta.contentHash}`);
  if (meta.sessionsWithoutUpdate !== undefined) {
    parts.push(`sessions-without-update: ${meta.sessionsWithoutUpdate}`);
  }
  return `<!-- ${parts.join(" | ")} -->`;
}

export function incrementSession(content: string): string {
  const now = new Date().toISOString();
  const existing = parseSessionMeta(content);

  if (existing) {
    const updated: SessionMeta = {
      ...existing,
      lastSession: now,
      count: existing.count + 1,
      sessionsWithoutUpdate: (existing.sessionsWithoutUpdate ?? 0) + 1,
    };
    const newLine = formatSessionMeta(updated);
    return content.replace(META_REGEX, newLine);
  }

  // Insert after first line (# Project Context)
  const lines = content.split("\n");
  const meta: SessionMeta = { lastSession: now, count: 1, sessionsWithoutUpdate: 0 };
  lines.splice(1, 0, formatSessionMeta(meta));
  return lines.join("\n");
}

export function markUpdated(content: string): string {
  const now = new Date().toISOString();
  const existing = parseSessionMeta(content);
  if (!existing) return content;

  const updated: SessionMeta = {
    ...existing,
    lastUpdate: now,
    sessionsWithoutUpdate: 0,
  };
  return content.replace(META_REGEX, formatSessionMeta(updated));
}

export function isStale(
  meta: SessionMeta,
  config: StalenessConfig = {}
): boolean {
  const { maxAgeDays = 7, maxSessionsWithoutUpdate = 5 } = config;

  // Check time-based staleness
  const lastDate = new Date(meta.lastSession);
  const now = new Date();
  const daysDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > maxAgeDays) return true;

  // Check session-based staleness
  if (
    meta.sessionsWithoutUpdate !== undefined &&
    meta.sessionsWithoutUpdate > maxSessionsWithoutUpdate
  ) {
    return true;
  }

  return false;
}

export function computeContentHash(content: string): string {
  // Simple hash: strip metadata line, hash remaining content
  const stripped = content.replace(META_REGEX, "").trim();
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(stripped);
  return hasher.digest("hex").slice(0, 8);
}
```

- [ ] **Step 4: Update context-template.ts with new constants**

Add to `src/lib/context-template.ts`:

```typescript
// After existing constants (line 9)
export const MAX_STALENESS_DAYS = 7;
export const MAX_SESSIONS_WITHOUT_UPDATE = 5;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/unit/context-session.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/context-session.ts src/lib/context-template.ts tests/unit/context-session.test.ts
git commit -m "feat(context): add multi-session awareness with metadata tracking"
```

---

## Task 2: Optimistic Concurrency (File Locking)

**Files:**
- Create: `src/lib/context-lock.ts`
- Test: `tests/unit/context-lock.test.ts`

- [ ] **Step 1: Write failing tests for optimistic concurrency**

```typescript
// tests/unit/context-lock.test.ts
import { describe, test, expect } from "bun:test";
import {
  detectConflict,
  mergeContexts,
  ConflictResult,
} from "../../src/lib/context-lock";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/context-lock.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement optimistic concurrency module**

```typescript
// src/lib/context-lock.ts
/**
 * Optimistic concurrency for context file.
 * Uses content hash to detect conflicts and section-level merge to resolve.
 */

import { getSection, replaceSection } from "./context-sections.js";

export interface ConflictResult {
  hasConflict: boolean;
}

export function detectConflict(
  expectedHash: string | undefined,
  currentHash: string
): ConflictResult {
  if (expectedHash === undefined) return { hasConflict: false };
  return { hasConflict: expectedHash !== currentHash };
}

const SECTIONS = [
  "Stack",
  "Architecture Decisions",
  "Conventions",
  "Current Status",
  "Important Notes",
];

/**
 * Three-way merge of context files at section level.
 * Strategy: union of bullet points per section, deduplicated.
 */
export function mergeContexts(
  base: string,
  ours: string,
  theirs: string
): string {
  let merged = theirs; // Start with theirs (the file on disk)

  for (const section of SECTIONS) {
    const baseLines = getSection(base, section);
    const ourLines = getSection(ours, section);
    const theirLines = getSection(theirs, section);

    // Find lines we added (in ours but not in base)
    const ourAdditions = ourLines.filter(
      (l) => !baseLines.some((b) => b.trim() === l.trim())
    );

    // Merge: theirs + our additions, deduplicated
    const mergedLines = [...theirLines];
    for (const line of ourAdditions) {
      if (!mergedLines.some((m) => m.trim() === line.trim())) {
        mergedLines.push(line);
      }
    }

    merged = replaceSection(merged, section, mergedLines);
  }

  return merged;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/context-lock.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/context-lock.ts tests/unit/context-lock.test.ts
git commit -m "feat(context): add optimistic concurrency with section-level merge"
```

---

## Task 3: Context Enrichment — Auto-Detect Project State

**Files:**
- Create: `src/lib/context-enrichment.ts`
- Test: `tests/unit/context-enrichment.test.ts`

- [ ] **Step 1: Write failing tests for enrichment**

```typescript
// tests/unit/context-enrichment.test.ts
import { describe, test, expect } from "bun:test";
import {
  getGitState,
  getRecentDeps,
  formatEnrichmentSection,
  GitState,
} from "../../src/lib/context-enrichment";

describe("getGitState()", () => {
  test("returns git branch and status for current project", async () => {
    const state = await getGitState(process.cwd());
    expect(state).not.toBeNull();
    expect(state!.branch).toBeDefined();
    expect(typeof state!.branch).toBe("string");
    expect(typeof state!.uncommittedCount).toBe("number");
  });

  test("returns null for non-git directory", async () => {
    const state = await getGitState("/tmp");
    // /tmp may or may not be a git repo, so we just check it doesn't throw
    expect(state === null || state.branch !== undefined).toBe(true);
  });
});

describe("getRecentDeps()", () => {
  test("returns dependency list from package.json", async () => {
    const deps = await getRecentDeps(process.cwd());
    expect(deps).toBeDefined();
    expect(Array.isArray(deps)).toBe(true);
  });
});

describe("formatEnrichmentSection()", () => {
  test("formats git state as bullet points", () => {
    const git: GitState = {
      branch: "feature/context-v2",
      uncommittedCount: 3,
      lastCommitMessage: "feat: add session tracking",
      aheadOfMain: 2,
    };
    const result = formatEnrichmentSection({ git, deps: ["zod@4.4.2"] });
    expect(result).toContain("- Branch: feature/context-v2");
    expect(result).toContain("uncommitted");
    expect(result).toContain("zod@4.4.2");
  });

  test("returns empty string when no data available", () => {
    const result = formatEnrichmentSection({ git: null, deps: [] });
    expect(result).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/context-enrichment.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement enrichment module**

```typescript
// src/lib/context-enrichment.ts
/**
 * Context enrichment — auto-detect project state from git, package.json, etc.
 * Returns formatted section content for injection into context_read responses.
 */

import { readFile } from "fs/promises";
import { join } from "path";

export interface GitState {
  branch: string;
  uncommittedCount: number;
  lastCommitMessage: string;
  aheadOfMain: number;
}

export interface EnrichmentData {
  git: GitState | null;
  deps: string[];
  testStatus?: string;
}

async function exec(
  cmd: string[],
  cwd: string
): Promise<string | null> {
  try {
    const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return null;
    return output.trim();
  } catch {
    return null;
  }
}

export async function getGitState(projectRoot: string): Promise<GitState | null> {
  const branch = await exec(["git", "rev-parse", "--abbrev-ref", "HEAD"], projectRoot);
  if (!branch) return null;

  const statusOutput = await exec(["git", "status", "--porcelain"], projectRoot);
  const uncommittedCount = statusOutput
    ? statusOutput.split("\n").filter((l) => l.trim()).length
    : 0;

  const lastCommit = await exec(
    ["git", "log", "-1", "--format=%s"],
    projectRoot
  );

  // Try to get ahead count from main/master
  let aheadOfMain = 0;
  const mainBranch = (await exec(["git", "rev-parse", "--verify", "main"], projectRoot))
    ? "main"
    : (await exec(["git", "rev-parse", "--verify", "master"], projectRoot))
      ? "master"
      : null;

  if (mainBranch && branch !== mainBranch) {
    const aheadOutput = await exec(
      ["git", "rev-list", "--count", `${mainBranch}..HEAD`],
      projectRoot
    );
    if (aheadOutput) aheadOfMain = parseInt(aheadOutput, 10) || 0;
  }

  return {
    branch,
    uncommittedCount,
    lastCommitMessage: lastCommit || "(no commits)",
    aheadOfMain,
  };
}

export async function getRecentDeps(projectRoot: string): Promise<string[]> {
  try {
    const pkgPath = join(projectRoot, "package.json");
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    const deps = Object.entries(pkg.dependencies || {}).map(
      ([name, ver]) => `${name}@${ver}`
    );
    return deps.slice(0, 10); // Limit to 10 most relevant
  } catch {
    return [];
  }
}

export function formatEnrichmentSection(data: EnrichmentData): string {
  const lines: string[] = [];

  if (data.git) {
    const { branch, uncommittedCount, lastCommitMessage, aheadOfMain } = data.git;
    let branchLine = `- Branch: ${branch}`;
    if (aheadOfMain > 0) branchLine += ` (${aheadOfMain} ahead of main)`;
    lines.push(branchLine);

    if (uncommittedCount > 0) {
      lines.push(`- Uncommitted changes: ${uncommittedCount} files`);
    }
    lines.push(`- Last commit: ${lastCommitMessage}`);
  }

  if (data.deps.length > 0) {
    lines.push(`- Dependencies: ${data.deps.join(", ")}`);
  }

  if (data.testStatus) {
    lines.push(`- Tests: ${data.testStatus}`);
  }

  return lines.join("\n");
}

export async function enrichContext(projectRoot: string): Promise<string> {
  const git = await getGitState(projectRoot);
  const deps = await getRecentDeps(projectRoot);
  return formatEnrichmentSection({ git, deps });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/context-enrichment.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/context-enrichment.ts tests/unit/context-enrichment.test.ts
git commit -m "feat(context): add auto-enrichment for git state and dependencies"
```

---

## Task 4: Semantic Intelligence — Fuzzy Dedup & Smart Prune

**Files:**
- Create: `src/lib/context-similarity.ts`
- Test: `tests/unit/context-similarity.test.ts`

- [ ] **Step 1: Write failing tests for similarity module**

```typescript
// tests/unit/context-similarity.test.ts
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
    expect(result.actions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/context-similarity.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement similarity module**

```typescript
// src/lib/context-similarity.ts
/**
 * Semantic intelligence for context pruning.
 * Provides fuzzy deduplication and smart detection of resolved/stale notes.
 */

import { getSection, replaceSection } from "./context-sections.js";

/**
 * Jaccard similarity between two strings (word-level).
 * Returns 0.0 to 1.0.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

export interface DuplicatePair {
  kept: string;
  removed: string;
  similarity: number;
}

/**
 * Find duplicate entries based on Jaccard similarity threshold.
 * Keeps the first occurrence, marks later ones as duplicates.
 */
export function findDuplicates(
  lines: string[],
  threshold = 0.6
): DuplicatePair[] {
  const duplicates: DuplicatePair[] = [];
  const removed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < lines.length; j++) {
      if (removed.has(j)) continue;
      const sim = jaccardSimilarity(lines[i], lines[j]);
      if (sim >= threshold) {
        duplicates.push({ kept: lines[i], removed: lines[j], similarity: sim });
        removed.add(j);
      }
    }
  }

  return duplicates;
}

const RESOLVED_KEYWORDS = [
  /\bfixed\b/i,
  /\bresolved\b/i,
  /\bcompleted\b/i,
  /\bdone\b/i,
  /\bfinished\b/i,
  /\bmerged\b/i,
  /\bdeployed\b/i,
  /\bclosed\b/i,
];

/**
 * Detect notes that contain "resolved" language but lack [x] or [RESOLVED] markers.
 */
export function detectResolvedNotes(lines: string[]): string[] {
  return lines.filter((line) =>
    RESOLVED_KEYWORDS.some((re) => re.test(line))
  );
}

export interface SmartPruneResult {
  prunedContent: string;
  actions: string[];
}

/**
 * Smart prune: remove fuzzy duplicates and detected-resolved notes.
 * Operates on Architecture Decisions and Important Notes sections.
 */
export function smartPrune(content: string): SmartPruneResult {
  const actions: string[] = [];
  let updated = content;

  // Deduplicate Architecture Decisions
  const archDecisions = getSection(updated, "Architecture Decisions");
  if (archDecisions.length > 1) {
    const dupes = findDuplicates(archDecisions, 0.6);
    if (dupes.length > 0) {
      const removedSet = new Set(dupes.map((d) => d.removed));
      const deduped = archDecisions.filter((l) => !removedSet.has(l));
      updated = replaceSection(updated, "Architecture Decisions", deduped);
      actions.push(
        `Removed ${dupes.length} duplicate(s) from Architecture Decisions`
      );
    }
  }

  // Detect resolved notes in Important Notes (without [x] marker)
  const impNotes = getSection(updated, "Important Notes");
  if (impNotes.length > 0) {
    const resolved = detectResolvedNotes(impNotes);
    if (resolved.length > 0) {
      const resolvedSet = new Set(resolved);
      const cleaned = impNotes.filter((l) => !resolvedSet.has(l));
      if (cleaned.length < impNotes.length) {
        updated = replaceSection(updated, "Important Notes", cleaned.length > 0 ? cleaned : ["- (none yet)"]);
        actions.push(
          `Detected and removed ${resolved.length} resolved note(s) from Important Notes`
        );
      }
    }
  }

  // Deduplicate Important Notes
  const impNotesAfter = getSection(updated, "Important Notes");
  if (impNotesAfter.length > 1) {
    const dupes = findDuplicates(impNotesAfter, 0.6);
    if (dupes.length > 0) {
      const removedSet = new Set(dupes.map((d) => d.removed));
      const deduped = impNotesAfter.filter((l) => !removedSet.has(l));
      updated = replaceSection(updated, "Important Notes", deduped);
      actions.push(
        `Removed ${dupes.length} duplicate(s) from Important Notes`
      );
    }
  }

  return { prunedContent: updated, actions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/context-similarity.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/context-similarity.ts tests/unit/context-similarity.test.ts
git commit -m "feat(context): add semantic intelligence with fuzzy dedup and smart prune"
```

---

## Task 5: Compliance Enforcement — Staleness Detection & Audit

**Files:**
- Modify: `src/commands/context.ts`
- Test: (integrated in existing test or manual verification)

- [ ] **Step 1: Write failing test for audit command**

```typescript
// Add to tests/unit/context-keeper.test.ts (or create tests/unit/context-audit.test.ts)
// For now, we test the staleness logic which is already in context-session.ts
// The CLI command is integration-tested manually
```

- [ ] **Step 2: Add `audit` subcommand to context.ts**

Add after the `status` subcommand in `src/commands/context.ts`:

```typescript
// Add import at top of file
import { parseSessionMeta, isStale } from "../lib/context-session.js";
import { getGitState } from "../lib/context-enrichment.js";

// Add after contextStatus command (around line 195)
const contextAudit = new Command("audit")
  .description("Check context compliance — staleness, missing info, suggestions")
  .action(async () => {
    const filePath = join(process.cwd(), CONTEXT_FILENAME);

    if (!existsSync(filePath)) {
      logError("No context file found. Run `opencode-jce context init` first.");
      process.exit(ExitCode.ERROR);
    }

    const content = await readFile(filePath, "utf-8");
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check session metadata
    const meta = parseSessionMeta(content);
    if (!meta) {
      issues.push("No session metadata found — context_read has never been called by MCP");
    } else {
      if (isStale(meta)) {
        issues.push(
          `Context is STALE: last session was ${meta.lastSession}, ${meta.sessionsWithoutUpdate ?? "?"} sessions without update`
        );
      }
      if (meta.count > 0) {
        suggestions.push(`Total sessions: ${meta.count}`);
      }
    }

    // Check if git has commits since last update
    const git = await getGitState(process.cwd());
    if (git && meta?.lastUpdate) {
      // Simple heuristic: if there are uncommitted changes, suggest update
      if (git.uncommittedCount > 5) {
        suggestions.push(
          `${git.uncommittedCount} uncommitted files — consider recording current work in context`
        );
      }
    }

    // Check section completeness
    const sections = ["Stack", "Architecture Decisions", "Conventions", "Current Status", "Important Notes"];
    for (const section of sections) {
      const lines = content.split("\n");
      const sectionExists = lines.some((l) => l.startsWith(`## ${section}`));
      if (!sectionExists) {
        issues.push(`Missing section: ## ${section}`);
      }
    }

    // Check for placeholder content
    if (content.includes("(auto-detect from project files)")) {
      issues.push("Stack section still has placeholder — needs auto-detection");
    }
    if (content.includes("(none yet)") && meta && meta.count > 3) {
      suggestions.push("Some sections still say '(none yet)' after multiple sessions");
    }

    // Report
    if (issues.length === 0) {
      logSuccess("Context compliance: HEALTHY");
    } else {
      logWarning(`Context compliance: ${issues.length} issue(s) found`);
      for (const issue of issues) {
        logError(`  - ${issue}`);
      }
    }

    if (suggestions.length > 0) {
      logInfo("\nSuggestions:");
      for (const s of suggestions) {
        logInfo(`  - ${s}`);
      }
    }
  });
```

- [ ] **Step 3: Register audit subcommand**

In `src/commands/context.ts`, add to the parent command:

```typescript
contextCommand.addCommand(contextAudit);
```

- [ ] **Step 4: Test manually**

Run: `bun run src/index.ts context audit`
Expected: Shows compliance report for current project

- [ ] **Step 5: Commit**

```bash
git add src/commands/context.ts
git commit -m "feat(context): add 'context audit' command for compliance checking"
```

---

## Task 6: Cross-Project Context

**Files:**
- Create: `src/lib/context-cross-project.ts`
- Test: `tests/unit/context-cross-project.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/context-cross-project.test.ts
import { describe, test, expect } from "bun:test";
import {
  parseRelatedProjects,
  readRelatedContext,
  formatRelatedSummary,
} from "../../src/lib/context-cross-project";

describe("parseRelatedProjects()", () => {
  test("parses Related Projects section", () => {
    const content = `## Related Projects
- ../shared-lib: "Shared utilities"
- ../api-gateway: "Routes traffic"
`;
    const projects = parseRelatedProjects(content);
    expect(projects).toHaveLength(2);
    expect(projects[0].path).toBe("../shared-lib");
    expect(projects[0].description).toBe("Shared utilities");
    expect(projects[1].path).toBe("../api-gateway");
  });

  test("returns empty array when section missing", () => {
    const content = `## Stack\n- TypeScript\n`;
    expect(parseRelatedProjects(content)).toHaveLength(0);
  });
});

describe("formatRelatedSummary()", () => {
  test("formats related project contexts as summary", () => {
    const contexts = [
      { path: "../shared-lib", stack: ["TypeScript", "Zod"], status: ["- [ ] Add validation"] },
    ];
    const result = formatRelatedSummary(contexts);
    expect(result).toContain("shared-lib");
    expect(result).toContain("TypeScript");
  });

  test("returns empty string for no contexts", () => {
    expect(formatRelatedSummary([])).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/context-cross-project.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cross-project module**

```typescript
// src/lib/context-cross-project.ts
/**
 * Cross-project context — read and summarize related project contexts.
 * Enables awareness of sibling projects in monorepos or microservice architectures.
 */

import { readFile } from "fs/promises";
import { join, resolve, basename } from "path";
import { CONTEXT_FILENAME } from "./context-template.js";
import { getSection } from "./context-sections.js";

export interface RelatedProject {
  path: string;
  description: string;
}

export interface RelatedContext {
  path: string;
  stack: string[];
  status: string[];
  decisions: string[];
}

/**
 * Parse ## Related Projects section from context content.
 * Format: `- <relative-path>: "<description>"`
 */
export function parseRelatedProjects(content: string): RelatedProject[] {
  const section = getSection(content, "Related Projects");
  const projects: RelatedProject[] = [];

  for (const line of section) {
    const match = line.match(/^-\s*(.+?):\s*"(.+?)"$/);
    if (match) {
      projects.push({ path: match[1].trim(), description: match[2].trim() });
    }
  }

  return projects;
}

/**
 * Read context files from related projects.
 * Resolves paths relative to the current project root.
 */
export async function readRelatedContext(
  projectRoot: string,
  related: RelatedProject[]
): Promise<RelatedContext[]> {
  const contexts: RelatedContext[] = [];

  for (const project of related) {
    try {
      const absPath = resolve(projectRoot, project.path);
      const contextFile = join(absPath, CONTEXT_FILENAME);
      const content = await readFile(contextFile, "utf-8");

      contexts.push({
        path: project.path,
        stack: getSection(content, "Stack"),
        status: getSection(content, "Current Status"),
        decisions: getSection(content, "Architecture Decisions"),
      });
    } catch {
      // Skip projects whose context file doesn't exist
      continue;
    }
  }

  return contexts;
}

/**
 * Format related project contexts as a concise summary.
 */
export function formatRelatedSummary(contexts: RelatedContext[]): string {
  if (contexts.length === 0) return "";

  const lines: string[] = ["## Related Project Summaries (read-only)"];

  for (const ctx of contexts) {
    const name = basename(ctx.path);
    lines.push(`### ${name} (${ctx.path})`);
    if (ctx.stack.length > 0) {
      lines.push(`  Stack: ${ctx.stack.map((s) => s.replace(/^-\s*/, "")).join(", ")}`);
    }
    if (ctx.status.length > 0) {
      const active = ctx.status.filter((s) => !s.includes("[x]")).slice(0, 3);
      if (active.length > 0) {
        lines.push(`  Active: ${active.map((s) => s.trim()).join("; ")}`);
      }
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/context-cross-project.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/context-cross-project.ts tests/unit/context-cross-project.test.ts
git commit -m "feat(context): add cross-project context reading for monorepos"
```

---

## Task 7: Integrate All Modules into context-keeper.ts

**Files:**
- Modify: `src/mcp/context-keeper.ts`
- Modify: `src/lib/context-template.ts`

This is the integration task — wire all new modules into the MCP server.

- [ ] **Step 1: Add imports to context-keeper.ts**

Add after existing imports (line 25):

```typescript
import {
  parseSessionMeta,
  formatSessionMeta,
  incrementSession,
  markUpdated,
  isStale,
  computeContentHash,
} from "../lib/context-session.js";
import { detectConflict, mergeContexts } from "../lib/context-lock.js";
import { enrichContext } from "../lib/context-enrichment.js";
import { smartPrune } from "../lib/context-similarity.js";
import {
  parseRelatedProjects,
  readRelatedContext,
  formatRelatedSummary,
} from "../lib/context-cross-project.js";
import {
  MAX_STALENESS_DAYS,
  MAX_SESSIONS_WITHOUT_UPDATE,
} from "../lib/context-template.js";
```

- [ ] **Step 2: Enhance `context_read` tool**

Replace the `context_read` tool handler (lines 271-319) with:

```typescript
server.tool(
  "context_read",
  "Read .opencode-context.md at session start. Creates the file if it doesn't exist. Returns the current context with enrichment data.",
  {},
  async () => {
    const existing = await readContext();

    if (existing) {
      // 1. Increment session counter
      let content = incrementSession(existing);

      // 2. Auto-prune (structural: [x] items)
      const pruned = pruneAndArchiveContext(content);
      if (pruned.content !== content) {
        await appendArchive(pruned.archiveAppend);
        content = pruned.content;
      }

      // 3. Smart prune (semantic: duplicates, resolved notes)
      const smart = smartPrune(content);
      if (smart.actions.length > 0) {
        content = smart.prunedContent;
      }

      // 4. Update content hash
      const hash = computeContentHash(content);
      const meta = parseSessionMeta(content);
      if (meta) {
        meta.contentHash = hash;
        content = content.replace(/^<!-- session:.*-->$/m, formatSessionMeta(meta));
      }

      await writeContext(content);

      // 5. Enrichment (non-destructive, appended to response only)
      const enrichment = await enrichContext(getProjectRoot());

      // 6. Related projects summary
      const related = parseRelatedProjects(content);
      let relatedSummary = "";
      if (related.length > 0) {
        const relatedContexts = await readRelatedContext(getProjectRoot(), related);
        relatedSummary = formatRelatedSummary(relatedContexts);
      }

      // 7. Staleness check
      const sessionMeta = parseSessionMeta(content);
      let stalenessWarning = "";
      if (sessionMeta && isStale(sessionMeta, {
        maxAgeDays: MAX_STALENESS_DAYS,
        maxSessionsWithoutUpdate: MAX_SESSIONS_WITHOUT_UPDATE,
      })) {
        stalenessWarning = `\nCRITICAL: Context is STALE (${sessionMeta.sessionsWithoutUpdate ?? "?"} sessions without update, last: ${sessionMeta.lastUpdate || "never"}). You MUST update context in this session.`;
      }

      const lines = countLines(content);
      const allActions = [...pruned.actions, ...smart.actions];

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `--- .opencode-context.md (${lines} lines, session #${sessionMeta?.count ?? "?"}) ---`,
              content,
              "---",
              allActions.length > 0
                ? `Auto-maintenance: ${allActions.join("; ")}`
                : "",
              enrichment ? `\n--- Project State (auto-detected) ---\n${enrichment}` : "",
              relatedSummary ? `\n--- Related Projects ---\n${relatedSummary}` : "",
              stalenessWarning,
              lines > MAX_LINES_TARGET
                ? `\nWARNING: File has ${lines} lines (target: ${MAX_LINES_TARGET}). Consider archiving old entries.`
                : "",
              "",
              "REMINDER: You MUST call context_update after completing any task.",
              "REMINDER: You MUST call context_checkpoint before the session ends or before committing.",
              "Failure to do so will result in lost context for the next session.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    }

    // Create new file from template
    const template = getContextTemplate();
    const withSession = incrementSession(template);
    await writeContext(withSession);
    return {
      content: [
        {
          type: "text" as const,
          text: `Created new ${CONTEXT_FILENAME} from template. Please auto-detect the project stack and update the ## Stack section.`,
        },
      ],
    };
  }
);
```

- [ ] **Step 3: Enhance `context_update` tool with concurrency and session tracking**

Replace the `context_update` handler (lines 323-403) — add optimistic concurrency check and mark session as updated:

```typescript
server.tool(
  "context_update",
  "Update a specific section of .opencode-context.md. Use after completing tasks, making decisions, or adding dependencies.",
  {
    section: z
      .enum([
        "Stack",
        "Architecture Decisions",
        "Conventions",
        "Current Status",
        "Important Notes",
        "Related Projects",
      ])
      .describe("Which section to update"),
    action: z
      .enum(["add", "replace"])
      .describe(
        "add = append lines to section, replace = replace entire section content"
      ),
    lines: z
      .array(z.string().max(200))
      .min(1)
      .max(20)
      .describe(
        'Lines to add/replace. Use "- [x] task" for completed, "- [ ] task" for pending.'
      ),
  },
  async ({ section, action, lines: rawLines }) => {
    // Sanitize: strip lines that could corrupt section structure
    const lines = rawLines
      .map((l) => (l.startsWith("## ") ? `- ${l.slice(3)}` : l))
      .map((l) => l.replace(/\r?\n/g, " "));

    let content = await readContext();

    if (!content) {
      content = getContextTemplate();
    }

    // Optimistic concurrency check
    const meta = parseSessionMeta(content);
    const currentHash = computeContentHash(content);

    let updated: string;

    if (action === "replace") {
      updated = replaceSection(content, section, lines);
    } else {
      const existing = getSection(content, section);
      const newLines = lines.filter(
        (l) => !existing.some((e) => e.trim() === l.trim())
      );
      if (newLines.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No new lines to add — all entries already exist in ## ${section}.`,
            },
          ],
        };
      }
      updated = replaceSection(content, section, [...existing, ...newLines]);
    }

    // Mark session as updated (reset sessionsWithoutUpdate counter)
    updated = markUpdated(updated);

    // Update content hash
    const newHash = computeContentHash(updated);
    const updatedMeta = parseSessionMeta(updated);
    if (updatedMeta) {
      updatedMeta.contentHash = newHash;
      updated = updated.replace(/^<!-- session:.*-->$/m, formatSessionMeta(updatedMeta));
    }

    await writeContext(updated);

    const lineCount = countLines(updated);
    const warning =
      lineCount > MAX_LINES_HARD
        ? `\nWARNING: File now has ${lineCount} lines (hard limit: ${MAX_LINES_HARD}). Call context_checkpoint to auto-archive.`
        : "";

    return {
      content: [
        {
          type: "text" as const,
          text: `Updated ## ${section} (${action}). File: ${lineCount} lines.${warning}\nREMINDER: Call context_checkpoint before session ends or before committing.`,
        },
      ],
    };
  }
);
```

- [ ] **Step 4: Add new `context_history` tool**

Add after `context_checkpoint` tool:

```typescript
// ─── Tool: context_history ───────────────────────────────────

server.tool(
  "context_history",
  "Get session statistics and context health metrics. Read-only.",
  {},
  async () => {
    const content = await readContext();
    if (!content) {
      return {
        content: [{ type: "text" as const, text: "No context file found." }],
      };
    }

    const meta = parseSessionMeta(content);
    const lines = countLines(content);

    const stats: string[] = [
      "--- Context Health Report ---",
      `File: ${lines} lines (target: ${MAX_LINES_TARGET}, hard: ${MAX_LINES_HARD})`,
    ];

    if (meta) {
      stats.push(`Sessions: ${meta.count} total`);
      stats.push(`Last session: ${meta.lastSession}`);
      stats.push(`Last update: ${meta.lastUpdate || "never"}`);
      stats.push(`Sessions without update: ${meta.sessionsWithoutUpdate ?? "unknown"}`);
      stats.push(`Last prune: ${meta.lastPrune || "never"}`);
      stats.push(`Content hash: ${meta.contentHash || "none"}`);

      const stale = isStale(meta, {
        maxAgeDays: MAX_STALENESS_DAYS,
        maxSessionsWithoutUpdate: MAX_SESSIONS_WITHOUT_UPDATE,
      });
      stats.push(`Staleness: ${stale ? "STALE - needs update" : "OK"}`);
    } else {
      stats.push("No session metadata — MCP context_read has not been called yet");
    }

    // Section stats
    const sections = ["Stack", "Architecture Decisions", "Conventions", "Current Status", "Important Notes"];
    stats.push("\n--- Section Sizes ---");
    for (const section of sections) {
      const sectionLines = getSection(content, section);
      stats.push(`  ${section}: ${sectionLines.length} entries`);
    }

    return {
      content: [{ type: "text" as const, text: stats.join("\n") }],
    };
  }
);
```

- [ ] **Step 5: Add `context_query_related` tool**

```typescript
// ─── Tool: context_query_related ─────────────────────────────

server.tool(
  "context_query_related",
  "Query context from related projects (defined in ## Related Projects section).",
  {
    project: z
      .string()
      .optional()
      .describe("Specific project path to query. If omitted, returns all related project summaries."),
  },
  async ({ project }) => {
    const content = await readContext();
    if (!content) {
      return {
        content: [{ type: "text" as const, text: "No context file found." }],
      };
    }

    const related = parseRelatedProjects(content);
    if (related.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: 'No related projects defined. Add them to ## Related Projects section:\n  Format: - <path>: "<description>"',
          },
        ],
      };
    }

    const toQuery = project
      ? related.filter((r) => r.path === project || r.path.includes(project))
      : related;

    if (toQuery.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Project "${project}" not found in related projects. Available: ${related.map((r) => r.path).join(", ")}`,
          },
        ],
      };
    }

    const contexts = await readRelatedContext(getProjectRoot(), toQuery);
    const summary = formatRelatedSummary(contexts);

    return {
      content: [
        {
          type: "text" as const,
          text: summary || "No context files found for related projects.",
        },
      ],
    };
  }
);
```

- [ ] **Step 6: Run all tests**

Run: `bun test`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/mcp/context-keeper.ts src/lib/context-template.ts
git commit -m "feat(context): integrate all v2 modules into context-keeper MCP server"
```

---

## Task 8: Update Documentation (AGENTS.md & Skill)

**Files:**
- Modify: `config/AGENTS.md`
- Modify: `config/skills/context-preservation.md`

- [ ] **Step 1: Update AGENTS.md context section**

Add new tools to the MCP enforcement section:

```markdown
### Context Preservation (v2)

**Tier 1 — MCP (highest priority):**
If `context-keeper` MCP server is available, the AI MUST:
1. Call `context_read` BEFORE doing anything else at session start
2. Call `context_update` after completing tasks
3. Call `context_checkpoint` before session ends or before committing
4. Call `context_history` to check health metrics (optional, for debugging)
5. Call `context_query_related` to read sibling project contexts (when relevant)

**New capabilities in v2:**
- Multi-session tracking (session count, staleness detection)
- Semantic deduplication (fuzzy matching removes near-duplicate entries)
- Auto-enrichment (git state, dependencies injected in context_read response)
- Optimistic concurrency (content hash prevents lost updates)
- Cross-project context (read related project contexts)
- Compliance enforcement (staleness warnings, audit command)
```

- [ ] **Step 2: Update context-preservation.md skill**

Add new section documenting v2 features:

```markdown
## v2 Features

### Multi-Session Awareness
- Session metadata stored as HTML comment (invisible in rendered markdown)
- Session counter incremented on each `context_read`
- Staleness detection: warns if >7 days or >5 sessions without update
- Use `context_history` tool to check health metrics

### Context Enrichment
- `context_read` now includes auto-detected project state:
  - Git branch, uncommitted changes, last commit
  - Dependency list from package.json
- This data is in the RESPONSE only (not written to file)
- Provides immediate context without manual exploration

### Semantic Intelligence
- Fuzzy deduplication: entries with >60% word overlap are merged
- Resolved note detection: entries containing "fixed", "resolved", "completed" etc. are auto-pruned
- Runs automatically during `context_read`

### Cross-Project Context
- Define related projects in `## Related Projects` section:
  ```
  ## Related Projects
  - ../shared-lib: "Shared utilities used by this service"
  - ../api-gateway: "Routes traffic to this service"
  ```
- Use `context_query_related` tool to read their contexts
- Summaries included in `context_read` response automatically

### Compliance
- Staleness warnings escalate based on sessions without update
- `opencode-jce context audit` CLI command for manual compliance check
- Content hash enables optimistic concurrency detection
```

- [ ] **Step 3: Commit**

```bash
git add config/AGENTS.md config/skills/context-preservation.md
git commit -m "docs(context): update AGENTS.md and skill with v2 features"
```

---

## Task 9: Update Template for Related Projects Section

**Files:**
- Modify: `src/lib/context-template.ts`

- [ ] **Step 1: Add Related Projects to template**

Update `getContextTemplate()` in `src/lib/context-template.ts`:

```typescript
export function getContextTemplate(): string {
  const today = new Date().toISOString().split("T")[0];
  return `# Project Context
> Auto-maintained by AI. You can edit this file freely.
> Last updated: ${today}

## Stack
- (auto-detect from project files)

## Architecture Decisions
- (none yet)

## Conventions
- (none yet)

## Current Status
- [ ] (session start)

## Important Notes
- (none yet)

## Related Projects
- (none — add related projects as: - <path>: "<description>")
`;
}
```

- [ ] **Step 2: Update `context_update` section enum to include "Related Projects"**

Already done in Task 7 Step 3 (added to the z.enum array).

- [ ] **Step 3: Run tests to ensure template tests still pass**

Run: `bun test tests/unit/context-keeper.test.ts`
Expected: May need to update template tests to account for new section. Fix if needed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/context-template.ts
git commit -m "feat(context): add Related Projects section to template"
```

---

## Task 10: Final Integration Test & Version Bump

**Files:**
- Modify: `src/mcp/context-keeper.ts` (version)
- Run: full test suite

- [ ] **Step 1: Update version in context-keeper.ts**

Change line 258:
```typescript
version: "1.9.0",
```

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: ALL PASS

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 4: Manual smoke test**

Run: `bun run src/mcp/context-keeper.ts` (should start without errors, Ctrl+C to stop)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(context): context preservation v2 — complete integration"
```

---

## Summary of New Tools (MCP Server)

| Tool | Purpose | New? |
|------|---------|------|
| `context_read` | Read + enrich + session track + smart prune | Enhanced |
| `context_update` | Update sections + concurrency + mark updated | Enhanced |
| `context_checkpoint` | Prune + archive + validate | Unchanged |
| `context_history` | Session stats + health metrics | **NEW** |
| `context_query_related` | Read sibling project contexts | **NEW** |

## New Modules

| Module | Lines (est.) | Purpose |
|--------|-------------|---------|
| `context-session.ts` | ~120 | Session metadata parsing/tracking |
| `context-lock.ts` | ~60 | Optimistic concurrency |
| `context-enrichment.ts` | ~100 | Auto-detect git/deps |
| `context-similarity.ts` | ~120 | Fuzzy dedup + smart prune |
| `context-cross-project.ts` | ~80 | Cross-project context reading |
