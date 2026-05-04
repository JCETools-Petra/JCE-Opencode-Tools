import { describe, test, expect } from "bun:test";
import {
  parseRelatedProjects,
  formatRelatedSummary,
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
