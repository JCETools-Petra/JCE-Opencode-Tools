import { describe, test, expect } from "bun:test";
import { detectWorkstreams } from "../../src/plugin/lib/orchestration/workstream-detector.js";

describe("detectWorkstreams", () => {
  describe("precision — does NOT split single workstreams", () => {
    test("plain single task", () => {
      expect(detectWorkstreams("fix the login crash in auth.ts").isMulti).toBe(false);
    });

    test("sequential prose (do X then Y) stays single", () => {
      expect(detectWorkstreams("refactor the controller and then run the tests").isMulti).toBe(false);
    });

    test("empty message", () => {
      expect(detectWorkstreams("").isMulti).toBe(false);
    });

    test("list with only one actionable item is not multi", () => {
      const msg = "Please do this:\n1. implement the feature\nThat is all.";
      expect(detectWorkstreams(msg).isMulti).toBe(false);
    });

    test("non-action bullet list is not multi", () => {
      const msg = "- the build is green\n- coverage is 80%\n- docs look fine";
      expect(detectWorkstreams(msg).isMulti).toBe(false);
    });
  });

  describe("recall — splits explicit multi-workstream messages", () => {
    test("numbered list of independent actions", () => {
      const msg = "Handle these:\n1. audit the security module\n2. refactor the frontend dashboard\n3. prepare the release";
      const result = detectWorkstreams(msg);
      expect(result.isMulti).toBe(true);
      expect(result.workstreams).toHaveLength(3);
      expect(result.workstreams[0]).toContain("audit the security");
    });

    test("bulleted list of independent actions", () => {
      const msg = "- implement pagination\n- fix the failing tests\n- update the changelog";
      const result = detectWorkstreams(msg);
      expect(result.isMulti).toBe(true);
      expect(result.workstreams).toHaveLength(3);
    });

    test("explicit parallel framing across action clauses", () => {
      const result = detectWorkstreams("in parallel, audit the API and refactor the database layer");
      expect(result.isMulti).toBe(true);
      expect(result.workstreams.length).toBeGreaterThanOrEqual(2);
    });

    test("indonesian parallel framing", () => {
      const result = detectWorkstreams("secara paralel, perbaiki bug login dan refactor modul pembayaran");
      expect(result.isMulti).toBe(true);
      expect(result.workstreams.length).toBeGreaterThanOrEqual(2);
    });

    test("caps workstreams at maxWorkstreams", () => {
      const msg = "1. fix module a\n2. fix module b\n3. fix module c\n4. fix module d\n5. fix module e";
      const result = detectWorkstreams(msg, 4);
      expect(result.workstreams).toHaveLength(4);
    });
  });
});
