import { describe, expect, test } from "bun:test";
import { scoreDelegatedContract } from "../../src/plugin/lib/delegated-contract-scoring.js";
import { buildDelegatedResultContractInstructions } from "../../src/plugin/lib/contracts.js";
import { summarizeCapabilities } from "../../src/plugin/lib/environment-capabilities.js";
import { createEmptyRuntimeState, createFailureMemoryEntry, addFailureMemory } from "../../src/plugin/lib/runtime-state.ts";
import { formatJceWorkerReport, getJceWorkerNextAction } from "../../src/plugin/lib/jce-worker-report.ts";

describe("next action and environment upgrades", () => {
  test("delegated contract scoring marks weak output for follow-up", () => {
    const score = scoreDelegatedContract("Summary only. No verification.");
    expect(score.needsFollowup).toBe(true);
  });

  test("delegated contract requests structured jce-evidence", () => {
    const contract = buildDelegatedResultContractInstructions();
    expect(contract).toContain("```jce-evidence");
    expect(contract).toContain("```jce-result");
    expect(contract).toContain("exitCode");
    expect(contract).toContain("If no command ran");
  });

  test("structured evidence scores higher than legacy prose verification", () => {
    const legacy = scoreDelegatedContract("## Summary\nDone\n## Files\n- x\n## Verification\n- tests pass, 0 fail\n## Risks\n- none");
    const structured = scoreDelegatedContract("## Summary\nDone\n## Files\n- x\n## Verification\n- tests pass\n```jce-evidence\n[{\"type\":\"test_result\",\"command\":\"bun test\",\"exitCode\":0,\"passed\":1,\"failed\":0}]\n```\n## Risks\n- none");
    expect(structured.verificationQuality).toBeGreaterThan(legacy.verificationQuality);
    expect(structured.total).toBeGreaterThan(legacy.total);
  });

  test("environment capability summary formats capability matrix", () => {
    const lines = summarizeCapabilities({ git: true, gh: false, bash: false, adb: false, bun: true, browser: false, ci: true });
    expect(lines).toContain("git: available");
    expect(lines).toContain("gh: missing");
  });

  test("operator report includes environment capability section", () => {
    let memory = createEmptyRuntimeState("2026-05-06T00:00:00.000Z");
    memory = addFailureMemory(memory, createFailureMemoryEntry({ signature: "sig", summary: "fail", failedCommands: ["bun test"] }));
    const output = formatJceWorkerReport(memory);
    expect(output).toContain("Environment Capabilities");
  });

  test("next action remains actionable with empty runtime", () => {
    const action = getJceWorkerNextAction(createEmptyRuntimeState("2026-05-06T00:00:00.000Z"));
    expect(action.length).toBeGreaterThan(5);
  });
});
