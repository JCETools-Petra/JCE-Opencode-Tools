import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyContextAutocapture,
  buildContextCaptureEntries,
  buildSessionSummary,
  compactContextContent,
  readProjectFacts,
  writeProjectFacts,
} from "../../src/lib/context-autocapture.ts";
import { getContextTemplate } from "../../src/lib/context-template.ts";

describe("context autocapture", () => {
  test("builds high-confidence continuity entries", () => {
    const entries = buildContextCaptureEntries({
      summary: "Continue Android checkout crash fix",
      changedFiles: ["app/src/main/AndroidManifest.xml", "app/build.gradle.kts"],
      verification: ["./gradlew :app:assembleDebug passed"],
      nextSteps: ["run :app:testDebugUnitTest"],
      android: { module: ":app", packageName: "com.example.app", commands: ["./gradlew :app:assembleDebug"] },
    });

    expect(entries.some((entry) => entry.section === "Current Status" && entry.line.includes("Continue Android"))).toBe(true);
    expect(entries.some((entry) => entry.section === "Important Notes" && entry.line.includes("Last verified"))).toBe(true);
    expect(entries.some((entry) => entry.line.includes("package com.example.app"))).toBe(true);
  });

  test("applies autocapture entries to context content", () => {
    const result = applyContextAutocapture(getContextTemplate(), {
      summary: "Implement context autocapture",
      changedFiles: ["src/lib/context-autocapture.ts"],
    });

    expect(result.content).toContain("Implement context autocapture");
    expect(result.content).toContain("Last touched files: src/lib/context-autocapture.ts");
  });

  test("builds session summary lines", () => {
    const lines = buildSessionSummary({
      summary: "Fix build",
      verification: ["bun test passed"],
      blockers: ["adb device unavailable"],
      nextSteps: ["connect emulator"],
    });

    expect(lines).toContain("- Fix build");
    expect(lines).toContain("- Verified: bun test passed.");
    expect(lines).toContain("- Blocker: adb device unavailable.");
    expect(lines).toContain("- Next: connect emulator.");
  });

  test("compacts duplicate status and notes", () => {
    const content = `${getContextTemplate()}\n## Extra\n- keep`;
    const noisy = content.replace("## Current Status\n- [ ] (session start)", "## Current Status\n- [ ] Same task\n- [ ] Same task\n- [ ] Other task");
    const result = compactContextContent(noisy);
    expect(result.content.match(/Same task/g)?.length).toBe(1);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  test("writes structured project facts", async () => {
    const root = mkdtempSync(join(tmpdir(), "opencode-jce-context-facts-"));
    try {
      const facts = await writeProjectFacts(root, {
        changedFiles: ["app/src/main/java/MainActivity.kt"],
        verification: ["./gradlew :app:assembleDebug passed"],
        android: { module: ":app", packageName: "com.example.app" },
      });
      expect(facts.projectType).toBe("android");
      expect(facts.android?.packageName).toBe("com.example.app");
      expect((await readProjectFacts(root))?.verification).toContain("./gradlew :app:assembleDebug passed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
