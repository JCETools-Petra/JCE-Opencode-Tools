import { describe, expect, test } from "bun:test";
import { extractChangedFilesFromTool } from "../../src/plugin/lib/changed-files.js";

describe("extractChangedFilesFromTool", () => {
  test("extracts direct write/edit path args", () => {
    expect(extractChangedFilesFromTool("write", { filePath: "src/index.ts" }, "ok")).toEqual(["src/index.ts"]);
    expect(extractChangedFilesFromTool("edit", { path: "README.md" }, "ok")).toEqual(["README.md"]);
  });

  test("extracts apply_patch file headers", () => {
    const patchText = `*** Begin Patch
*** Add File: src/new.ts
+export const x = 1;
*** Update File: src/old.ts
@@
-old
+new
*** Move to: src/renamed.ts
*** Delete File: src/dead.ts
*** End Patch`;
    expect(extractChangedFilesFromTool("apply_patch", { patchText }, "Success")).toEqual([
      "src/new.ts",
      "src/old.ts",
      "src/dead.ts",
      "src/renamed.ts",
    ]);
  });

  test("extracts git status and diff changed paths from bash output", () => {
    const status = " M src/plugin/index.ts\nA  tests/unit/new.test.ts\nR  src/old.ts -> src/new.ts";
    expect(extractChangedFilesFromTool("bash", { command: "git status --porcelain" }, status)).toEqual([
      "src/plugin/index.ts",
      "tests/unit/new.test.ts",
      "src/new.ts",
    ]);

    const diff = "diff --git a/src/a.ts b/src/a.ts\nindex 123..456 100644";
    expect(extractChangedFilesFromTool("bash", { command: "git diff" }, diff)).toEqual(["src/a.ts"]);
  });

  test("ignores arbitrary prose without clear paths", () => {
    expect(extractChangedFilesFromTool("bash", { command: "echo hello" }, "changed lots of things maybe")).toEqual([]);
  });

  test("extracts common mutating shell command paths", () => {
    expect(extractChangedFilesFromTool("bash", { command: "Set-Content -LiteralPath \"src/a.ts\" -Value hi" }, "")).toEqual(["src/a.ts"]);
    expect(extractChangedFilesFromTool("bash", { command: "echo hi > docs/out.md" }, "")).toEqual(["docs/out.md"]);
    expect(extractChangedFilesFromTool("bash", { command: "Remove-Item -LiteralPath tests/old.test.ts" }, "")).toEqual(["tests/old.test.ts"]);
  });
});
