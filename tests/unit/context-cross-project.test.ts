import { describe, test, expect } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  parseRelatedProjects,
  formatRelatedSummary,
  readRelatedContext,
} from "../../src/lib/context-cross-project";

describe("parseRelatedProjects()", () => {
  test("parses Related Projects section", () => {
    const content = `## Related Projects\n- ../shared-lib: "Shared utilities"\n- ../api-gateway: "Routes traffic"\n`;
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

  test("parses quoted Windows absolute paths without splitting at drive colon", () => {
    const content = `## Related Projects\n- "C:\\repos\\api": "API service"\n`;
    const projects = parseRelatedProjects(content);
    expect(projects[0]).toEqual({ path: "C:\\repos\\api", description: "API service" });
  });
});

describe("readRelatedContext()", () => {
  test("skips traversal paths outside the project parent", async () => {
    const base = join(tmpdir(), `opencode-related-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const root = join(base, "workspace", "project");
    const outside = join(base, "outside");
    mkdirSync(root, { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, ".opencode-context.md"), "## Stack\n- Secret\n", "utf-8");

    try {
      const contexts = await readRelatedContext(root, [{ path: resolve(outside), description: "Outside" }]);
      expect(contexts).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("formatRelatedSummary()", () => {
  test("formats related project contexts as summary", () => {
    const contexts = [
      {
        path: "../shared-lib",
        stack: ["- TypeScript", "- Zod"],
        status: ["- [ ] Add validation"],
        decisions: [],
      },
    ];
    const result = formatRelatedSummary(contexts);
    expect(result).toContain("shared-lib");
    expect(result).toContain("TypeScript");
  });

  test("returns empty string for no contexts", () => {
    expect(formatRelatedSummary([])).toBe("");
  });
});
