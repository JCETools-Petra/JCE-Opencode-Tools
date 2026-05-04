import { describe, test, expect } from "bun:test";
import {
  parseSessionMeta,
  formatSessionMeta,
  incrementSession,
  markUpdated,
  isStale,
  computeContentHash,
  type SessionMeta,
  type StalenessConfig,
} from "../../src/lib/context-session.js";
import {
  MAX_STALENESS_DAYS,
  MAX_SESSIONS_WITHOUT_UPDATE,
} from "../../src/lib/context-template.js";

// ─── Constants ───────────────────────────────────────────────

describe("context-template staleness constants", () => {
  test("MAX_STALENESS_DAYS is 7", () => {
    expect(MAX_STALENESS_DAYS).toBe(7);
  });

  test("MAX_SESSIONS_WITHOUT_UPDATE is 5", () => {
    expect(MAX_SESSIONS_WITHOUT_UPDATE).toBe(5);
  });
});

// ─── parseSessionMeta ────────────────────────────────────────

describe("parseSessionMeta()", () => {
  test("parses valid metadata with all fields", () => {
    const content = `# Project Context
<!-- session: 2026-05-04T10:30:00Z | count: 47 | last-prune: 2026-05-03 | last-update: 2026-05-04T09:00:00Z | content-hash: a1b2c3d4 | stale-sessions: 2 -->
> Auto-maintained by AI.

## Stack
- TypeScript
`;
    const meta = parseSessionMeta(content);
    expect(meta).not.toBeNull();
    expect(meta!.lastSession).toBe("2026-05-04T10:30:00Z");
    expect(meta!.count).toBe(47);
    expect(meta!.lastPrune).toBe("2026-05-03");
    expect(meta!.lastUpdate).toBe("2026-05-04T09:00:00Z");
    expect(meta!.contentHash).toBe("a1b2c3d4");
    expect(meta!.sessionsWithoutUpdate).toBe(2);
  });

  test("parses metadata with only required fields", () => {
    const content = `# Project Context
<!-- session: 2026-05-04T10:30:00Z | count: 1 -->
> Auto-maintained by AI.
`;
    const meta = parseSessionMeta(content);
    expect(meta).not.toBeNull();
    expect(meta!.lastSession).toBe("2026-05-04T10:30:00Z");
    expect(meta!.count).toBe(1);
    expect(meta!.lastPrune).toBeUndefined();
    expect(meta!.lastUpdate).toBeUndefined();
    expect(meta!.contentHash).toBeUndefined();
    expect(meta!.sessionsWithoutUpdate).toBeUndefined();
  });

  test("returns null when no metadata present", () => {
    const content = `# Project Context
> Auto-maintained by AI.

## Stack
- TypeScript
`;
    expect(parseSessionMeta(content)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseSessionMeta("")).toBeNull();
  });

  test("parses metadata with some optional fields missing", () => {
    const content = `# Project Context
<!-- session: 2026-05-04T10:30:00Z | count: 10 | last-prune: 2026-05-01 -->
`;
    const meta = parseSessionMeta(content);
    expect(meta).not.toBeNull();
    expect(meta!.lastSession).toBe("2026-05-04T10:30:00Z");
    expect(meta!.count).toBe(10);
    expect(meta!.lastPrune).toBe("2026-05-01");
    expect(meta!.lastUpdate).toBeUndefined();
    expect(meta!.contentHash).toBeUndefined();
    expect(meta!.sessionsWithoutUpdate).toBeUndefined();
  });
});

// ─── formatSessionMeta ───────────────────────────────────────

describe("formatSessionMeta()", () => {
  test("formats full metadata", () => {
    const meta: SessionMeta = {
      lastSession: "2026-05-04T10:30:00Z",
      count: 47,
      lastPrune: "2026-05-03",
      lastUpdate: "2026-05-04T09:00:00Z",
      contentHash: "a1b2c3d4",
      sessionsWithoutUpdate: 2,
    };
    const result = formatSessionMeta(meta);
    expect(result).toContain("session: 2026-05-04T10:30:00Z");
    expect(result).toContain("count: 47");
    expect(result).toContain("last-prune: 2026-05-03");
    expect(result).toContain("last-update: 2026-05-04T09:00:00Z");
    expect(result).toContain("content-hash: a1b2c3d4");
    expect(result).toContain("stale-sessions: 2");
    expect(result).toMatch(/^<!-- .+ -->$/);
  });

  test("formats minimal metadata (required fields only)", () => {
    const meta: SessionMeta = {
      lastSession: "2026-05-04T10:30:00Z",
      count: 1,
    };
    const result = formatSessionMeta(meta);
    expect(result).toContain("session: 2026-05-04T10:30:00Z");
    expect(result).toContain("count: 1");
    expect(result).not.toContain("last-prune:");
    expect(result).not.toContain("last-update:");
    expect(result).not.toContain("content-hash:");
    expect(result).not.toContain("stale-sessions:");
    expect(result).toMatch(/^<!-- .+ -->$/);
  });

  test("omits fields that are undefined", () => {
    const meta: SessionMeta = {
      lastSession: "2026-05-04T10:30:00Z",
      count: 5,
      lastPrune: "2026-05-01",
    };
    const result = formatSessionMeta(meta);
    expect(result).toContain("last-prune: 2026-05-01");
    expect(result).not.toContain("last-update:");
    expect(result).not.toContain("content-hash:");
    expect(result).not.toContain("stale-sessions:");
  });
});

// ─── incrementSession ────────────────────────────────────────

describe("incrementSession()", () => {
  test("increments count and updates timestamp on existing metadata", () => {
    const content = `# Project Context
<!-- session: 2026-05-03T10:00:00Z | count: 5 -->
> Auto-maintained by AI.

## Stack
- TypeScript
`;
    const result = incrementSession(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.count).toBe(6);
    // Timestamp should be recent (within last few seconds)
    const now = Date.now();
    const metaTime = new Date(meta!.lastSession).getTime();
    expect(now - metaTime).toBeLessThan(5000);
  });

  test("inserts metadata when none exists", () => {
    const content = `# Project Context
> Auto-maintained by AI.

## Stack
- TypeScript
`;
    const result = incrementSession(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.count).toBe(1);
    // Should be inserted after first line
    const lines = result.split("\n");
    expect(lines[0]).toBe("# Project Context");
    expect(lines[1]).toMatch(/^<!-- session: .+ -->$/);
  });

  test("increments sessionsWithoutUpdate when present", () => {
    const content = `# Project Context
<!-- session: 2026-05-03T10:00:00Z | count: 5 | stale-sessions: 2 -->
> Auto-maintained by AI.
`;
    const result = incrementSession(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.sessionsWithoutUpdate).toBe(3);
  });

  test("initializes sessionsWithoutUpdate to 1 when not present", () => {
    const content = `# Project Context
<!-- session: 2026-05-03T10:00:00Z | count: 5 -->
> Auto-maintained by AI.
`;
    const result = incrementSession(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.sessionsWithoutUpdate).toBe(1);
  });

  test("preserves other content unchanged", () => {
    const content = `# Project Context
<!-- session: 2026-05-03T10:00:00Z | count: 5 -->
> Auto-maintained by AI.

## Stack
- TypeScript
- Bun

## Important Notes
- Keep this note
`;
    const result = incrementSession(content);
    expect(result).toContain("## Stack");
    expect(result).toContain("- TypeScript");
    expect(result).toContain("- Bun");
    expect(result).toContain("## Important Notes");
    expect(result).toContain("- Keep this note");
  });
});

// ─── markUpdated ─────────────────────────────────────────────

describe("markUpdated()", () => {
  test("sets lastUpdate to current time", () => {
    const content = `# Project Context
<!-- session: 2026-05-04T10:00:00Z | count: 5 | stale-sessions: 3 -->
> Auto-maintained by AI.
`;
    const result = markUpdated(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.lastUpdate).toBeDefined();
    const now = Date.now();
    const updateTime = new Date(meta!.lastUpdate!).getTime();
    expect(now - updateTime).toBeLessThan(5000);
  });

  test("resets sessionsWithoutUpdate to 0", () => {
    const content = `# Project Context
<!-- session: 2026-05-04T10:00:00Z | count: 5 | stale-sessions: 3 -->
> Auto-maintained by AI.
`;
    const result = markUpdated(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.sessionsWithoutUpdate).toBe(0);
  });

  test("inserts metadata if none exists before marking updated", () => {
    const content = `# Project Context
> Auto-maintained by AI.
`;
    const result = markUpdated(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.lastUpdate).toBeDefined();
    expect(meta!.sessionsWithoutUpdate).toBe(0);
    expect(meta!.count).toBe(1);
  });

  test("preserves existing count and lastSession", () => {
    const content = `# Project Context
<!-- session: 2026-05-04T10:00:00Z | count: 42 -->
> Auto-maintained by AI.
`;
    const result = markUpdated(content);
    const meta = parseSessionMeta(result);
    expect(meta).not.toBeNull();
    expect(meta!.count).toBe(42);
    expect(meta!.lastSession).toBe("2026-05-04T10:00:00Z");
  });
});

// ─── isStale ─────────────────────────────────────────────────

describe("isStale()", () => {
  test("returns false for recent session", () => {
    const meta: SessionMeta = {
      lastSession: new Date().toISOString(),
      count: 5,
      sessionsWithoutUpdate: 0,
    };
    expect(isStale(meta)).toBe(false);
  });

  test("returns true when session is older than maxAgeDays", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const meta: SessionMeta = {
      lastSession: oldDate.toISOString(),
      count: 5,
      sessionsWithoutUpdate: 0,
    };
    expect(isStale(meta)).toBe(true);
  });

  test("returns true when too many sessions without update", () => {
    const meta: SessionMeta = {
      lastSession: new Date().toISOString(),
      count: 10,
      sessionsWithoutUpdate: 6,
    };
    expect(isStale(meta)).toBe(true);
  });

  test("returns false when sessionsWithoutUpdate is exactly at threshold", () => {
    const meta: SessionMeta = {
      lastSession: new Date().toISOString(),
      count: 10,
      sessionsWithoutUpdate: 5,
    };
    expect(isStale(meta)).toBe(false);
  });

  test("returns false when sessionsWithoutUpdate is undefined", () => {
    const meta: SessionMeta = {
      lastSession: new Date().toISOString(),
      count: 5,
    };
    expect(isStale(meta)).toBe(false);
  });

  test("respects custom maxAgeDays config", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const meta: SessionMeta = {
      lastSession: threeDaysAgo.toISOString(),
      count: 5,
      sessionsWithoutUpdate: 0,
    };
    const config: StalenessConfig = { maxAgeDays: 2 };
    expect(isStale(meta, config)).toBe(true);
  });

  test("respects custom maxSessionsWithoutUpdate config", () => {
    const meta: SessionMeta = {
      lastSession: new Date().toISOString(),
      count: 10,
      sessionsWithoutUpdate: 3,
    };
    const config: StalenessConfig = { maxSessionsWithoutUpdate: 2 };
    expect(isStale(meta, config)).toBe(true);
  });

  test("returns true when age is exactly at threshold", () => {
    const exactlySevenDaysAgo = new Date();
    exactlySevenDaysAgo.setDate(exactlySevenDaysAgo.getDate() - 7);
    // Subtract a small buffer to ensure we're past the threshold
    exactlySevenDaysAgo.setHours(exactlySevenDaysAgo.getHours() - 1);
    const meta: SessionMeta = {
      lastSession: exactlySevenDaysAgo.toISOString(),
      count: 5,
      sessionsWithoutUpdate: 0,
    };
    expect(isStale(meta)).toBe(true);
  });
});

// ─── computeContentHash ──────────────────────────────────────

describe("computeContentHash()", () => {
  test("returns 8-character hex string", () => {
    const hash = computeContentHash("some content here");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  test("returns consistent hash for same content", () => {
    const hash1 = computeContentHash("hello world");
    const hash2 = computeContentHash("hello world");
    expect(hash1).toBe(hash2);
  });

  test("returns different hash for different content", () => {
    const hash1 = computeContentHash("content A");
    const hash2 = computeContentHash("content B");
    expect(hash1).not.toBe(hash2);
  });

  test("strips metadata line before hashing", () => {
    const withMeta = `# Project Context
<!-- session: 2026-05-04T10:30:00Z | count: 47 -->
> Auto-maintained by AI.

## Stack
- TypeScript
`;
    const withoutMeta = `# Project Context
> Auto-maintained by AI.

## Stack
- TypeScript
`;
    expect(computeContentHash(withMeta)).toBe(computeContentHash(withoutMeta));
  });

  test("handles empty content", () => {
    const hash = computeContentHash("");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
