import { describe, expect, test } from "bun:test";
import { appendResearchOutputWarning, evaluateResearchOutput, RESEARCH_QUALITY_WARNING_PREFIX } from "../../src/plugin/lib/research-output-guard.ts";

const validReport = `# Research Scope
Question: verify API behavior.

# Short Answer
Use documented API.

# Evidence
| Claim | Source | Strength | Confidence |
| --- | --- | --- | --- |
| API supports option | Official docs | authoritative | High |

# Risks & Unknowns
- Version mismatch possible.

# Implementation Readiness
Ready

# Recommended Next Step
Implement minimal change.`;

describe("research output guard", () => {
  test("accepts valid structured researcher output", () => {
    const result = evaluateResearchOutput(validReport);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(appendResearchOutputWarning(validReport)).toBe(validReport);
  });

  test("warns when required section is missing", () => {
    const text = validReport.replace("# Evidence\n", "");
    const result = evaluateResearchOutput(text);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("Section: Evidence");
    expect(appendResearchOutputWarning(text)).toContain(RESEARCH_QUALITY_WARNING_PREFIX);
  });

  test("warns when evidence table column is missing", () => {
    const text = validReport.replace("| Claim | Source | Strength | Confidence |", "| Claim | Strength | Confidence |");
    const result = evaluateResearchOutput(text);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("Evidence table column: Source");
  });

  test("warns when readiness label is missing", () => {
    const text = validReport.replace("# Implementation Readiness\nReady", "# Implementation Readiness\nUnclear");
    const result = evaluateResearchOutput(text);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("Implementation Readiness label");
  });

  test("does not duplicate existing warning", () => {
    const invalid = validReport.replace("# Evidence\n", "");
    const warned = appendResearchOutputWarning(invalid);
    expect(appendResearchOutputWarning(warned)).toBe(warned);
  });
});
