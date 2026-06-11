import { describe, test, expect } from "bun:test";
import { extractProjectFacts } from "../../src/plugin/lib/orchestration/fact-extraction.js";

describe("extractProjectFacts", () => {
  describe("precision (no false positives)", () => {
    test("ignores read/grep file contents that merely mention tool names", () => {
      // A source file that imports jest types and references webpack in a comment.
      const fileContents = `import type { Config } from "jest";
// We migrated away from webpack to vite last year.
const runner = "jest"; // legacy name kept for compatibility`;
      expect(extractProjectFacts("read", fileContents)).toEqual([]);
      expect(extractProjectFacts("grep", fileContents)).toEqual([]);
    });

    test("ignores non-execution tools entirely", () => {
      const out = "$ bun test\n61 pass, 0 fail";
      expect(extractProjectFacts("read", out)).toEqual([]);
      expect(extractProjectFacts("glob", out)).toEqual([]);
      expect(extractProjectFacts("write", out)).toEqual([]);
    });

    test("ignores too-short or too-long output", () => {
      expect(extractProjectFacts("bash", "bun")).toEqual([]);
      expect(extractProjectFacts("bash", "$ bun test\n61 pass".padEnd(10001, "x"))).toEqual([]);
    });

    test("bare mention of 'bun test' without a result summary is not a fact", () => {
      const out = "Remember to run bun test before committing your changes please";
      expect(extractProjectFacts("bash", out)).toEqual([]);
    });
  });

  describe("recall (real execution signals)", () => {
    test("detects bun test from invocation + summary", () => {
      const out = "$ bun test\n61 pass, 0 fail\nRan 61 tests";
      const facts = extractProjectFacts("bash", out);
      expect(facts.find((f) => f.key === "test.runner")?.value).toBe("bun test");
    });

    test("detects tsc typecheck from TS error", () => {
      const out = "src/index.ts(12,3): error TS2741: Property missing";
      const facts = extractProjectFacts("bash", out);
      expect(facts.find((f) => f.key === "build.typecheck")?.value).toBe("tsc");
      expect(facts.find((f) => f.key === "last.error.type")?.value).toBe("typescript");
    });

    test("detects package manager from install invocation", () => {
      const facts = extractProjectFacts("bash", "$ bun install\nbun install v1.1\nDone");
      expect(facts.find((f) => f.key === "package.manager")?.value).toBe("bun");
    });

    test("detects facts from sub-agent (task) output", () => {
      const out = "## Verification\n$ cargo test\ntest result: ok. 12 passed; 0 failed";
      const facts = extractProjectFacts("task", out);
      expect(facts.find((f) => f.key === "test.runner")?.value).toBe("cargo test");
    });

    test("detects syntax/reference errors", () => {
      expect(extractProjectFacts("bash", "Uncaught SyntaxError: unexpected token in JSON".padEnd(30, " "))
        .find((f) => f.key === "last.error.type")?.value).toBe("syntax");
      expect(extractProjectFacts("bash", "ReferenceError: foo is not defined at module".padEnd(30, " "))
        .find((f) => f.key === "last.error.type")?.value).toBe("reference");
    });
  });
});
