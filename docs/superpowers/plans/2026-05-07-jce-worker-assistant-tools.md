# JCE-Worker Assistant Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only `jce_workflow` helper tooling so JCE-Worker can summarize workspace state, recommend verification, prepare safe staging plans, and check release readiness.

**Architecture:** Build pure workflow helper functions under `src/plugin/lib/workflow-assistant.ts`, then expose them through one plugin tool in `src/plugin/tools/workflow.ts`. Wire the tool into `src/plugin/index.ts` and update the JCE-Worker prompt with a short usage contract.

**Tech Stack:** TypeScript, Bun test runner, OpenCode plugin tool API, Node child_process/file-system helpers.

---

## File Structure

- Create `src/plugin/lib/workflow-assistant.ts`: pure-ish helpers for git status parsing, file classification, verification recipes, version sync checks, and formatted reports.
- Create `src/plugin/tools/workflow.ts`: OpenCode plugin tool wrapper for `jce_workflow` actions.
- Modify `src/plugin/index.ts`: register `jce_workflow` alongside dispatch/status/collect tools.
- Modify `src/plugin/agents/jce-worker.ts`: add short section teaching JCE-Worker when to use `jce_workflow`.
- Create `tests/unit/plugin-workflow-assistant.test.ts`: unit tests for pure helpers.
- Create `tests/unit/plugin-workflow-tool.test.ts`: unit tests for tool action routing and output shape.
- Modify `tests/unit/plugin-agents.test.ts`: assert JCE-Worker prompt references `jce_workflow`.
- Modify `tests/unit/plugin-entry.test.ts`: assert plugin server exposes `jce_workflow`.

## Task 1: Verification Recipes

**Files:**
- Create: `src/plugin/lib/workflow-assistant.ts`
- Test: `tests/unit/plugin-workflow-assistant.test.ts`

- [ ] **Step 1: Write failing verification recipe tests**

Create `tests/unit/plugin-workflow-assistant.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { buildVerificationRecipe } from "../../src/plugin/lib/workflow-assistant.ts";

describe("workflow assistant", () => {
  test("builds release verification recipe", () => {
    const result = buildVerificationRecipe("release");

    expect(result).toContain("Commands");
    expect(result).toContain("bun run typecheck");
    expect(result).toContain("bun test");
    expect(result).toContain("bun ./src/index.ts validate");
    expect(result).toContain("bash -n install.sh");
    expect(result).toContain("bun ./src/index.ts --version");
    expect(result).toContain("Success Criteria");
  });

  test("builds agent prompt verification recipe", () => {
    const result = buildVerificationRecipe("agent_prompt");

    expect(result).toContain("bun test tests/unit/plugin-agents.test.ts");
    expect(result).toContain("prompt markers");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: FAIL because `src/plugin/lib/workflow-assistant.ts` does not exist.

- [ ] **Step 3: Create minimal verification recipe implementation**

Create `src/plugin/lib/workflow-assistant.ts` with:

```ts
export type WorkflowTaskType = "agent_prompt" | "config" | "installer" | "release" | "docs" | "tests" | "unknown";

interface VerificationRecipe {
  commands: string[];
  successCriteria: string[];
  notes: string[];
}

const RECIPES: Record<WorkflowTaskType, VerificationRecipe> = {
  agent_prompt: {
    commands: [
      "bun test tests/unit/plugin-agents.test.ts --test-name-pattern \"jce-worker\"",
      "bun test",
    ],
    successCriteria: ["Focused prompt tests pass", "Prompt markers match expected behavior contract"],
    notes: ["Run full test suite when prompt change is release-bound."],
  },
  config: {
    commands: [
      "bun test tests/unit/update-config-hardening.test.ts tests/unit/plugin-config-hardening.test.ts",
      "bun ./src/index.ts validate",
      "bun run typecheck",
    ],
    successCriteria: ["Config hardening tests pass", "All bundled configs validate", "TypeScript exits 0"],
    notes: ["Review opencode.json merge behavior for user config preservation."],
  },
  installer: {
    commands: ["bash -n install.sh", "bun test tests/unit/audit-fixes.test.ts", "bun run typecheck"],
    successCriteria: ["Bash syntax check exits 0", "Installer/update regression tests pass", "TypeScript exits 0"],
    notes: ["Run PowerShell parser manually when pwsh is available."],
  },
  release: {
    commands: ["bun run typecheck", "bun test", "bun ./src/index.ts validate", "bash -n install.sh", "bun ./src/index.ts --version"],
    successCriteria: ["tsc --noEmit exits 0", "bun test reports 0 fail", "All config files are valid", "bash syntax check exits 0", "CLI version matches target release"],
    notes: ["Run safe_commit_plan before staging release files."],
  },
  docs: {
    commands: ["git diff -- docs"],
    successCriteria: ["Docs diff matches current behavior", "No stale commands or version references"],
    notes: ["No build required unless docs include generated examples."],
  },
  tests: {
    commands: ["bun test <target-test-file>", "bun test"],
    successCriteria: ["Targeted test passes", "Wider affected suite passes"],
    notes: ["Replace <target-test-file> with the file changed by the task."],
  },
  unknown: {
    commands: ["git diff --name-only", "bun run typecheck", "bun test"],
    successCriteria: ["Changed files are understood", "TypeScript exits 0", "Tests report 0 fail"],
    notes: ["Use conservative verification when task type is unclear."],
  },
};

function section(title: string, lines: string[]): string {
  return [title, ...(lines.length ? lines.map((line) => `- ${line}`) : ["- none"])].join("\n");
}

export function buildVerificationRecipe(taskType: WorkflowTaskType): string {
  const recipe = RECIPES[taskType] ?? RECIPES.unknown;
  return [
    section("Commands", recipe.commands),
    "",
    section("Success Criteria", recipe.successCriteria),
    "",
    section("Notes", recipe.notes),
  ].join("\n");
}
```

- [ ] **Step 4: Run recipe tests**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: PASS with 2 tests.

## Task 2: Safe Commit Plan Classifier

**Files:**
- Modify: `src/plugin/lib/workflow-assistant.ts`
- Modify: `tests/unit/plugin-workflow-assistant.test.ts`

- [ ] **Step 1: Add failing safe commit plan tests**

Append inside `describe("workflow assistant", () => { ... })` in `tests/unit/plugin-workflow-assistant.test.ts`:

```ts
import { buildSafeCommitPlan, parseGitStatusPorcelain } from "../../src/plugin/lib/workflow-assistant.ts";

test("parses porcelain git status", () => {
  const files = parseGitStatusPorcelain(" M src/plugin/index.ts\n?? docs/superpowers/plans/new.md\n?? .opencode-jce/cache.json\n");

  expect(files).toEqual([
    { status: "M", path: "src/plugin/index.ts" },
    { status: "??", path: "docs/superpowers/plans/new.md" },
    { status: "??", path: ".opencode-jce/cache.json" },
  ]);
});

test("safe commit plan excludes local context and includes docs only when requested", () => {
  const files = parseGitStatusPorcelain([
    " M src/plugin/index.ts",
    " M .opencode-context.md",
    "?? docs/superpowers/plans/new.md",
    "?? .opencode-jce/cache.json",
    "?? notes.txt",
    "?? .env.local",
  ].join("\n"));

  const withoutDocs = buildSafeCommitPlan(files, { includeDocs: false });
  expect(withoutDocs).toContain("Safe To Stage");
  expect(withoutDocs).toContain("src/plugin/index.ts");
  expect(withoutDocs).not.toContain("git add src/plugin/index.ts docs/superpowers/plans/new.md");
  expect(withoutDocs).toContain("Excluded");
  expect(withoutDocs).toContain(".opencode-context.md");
  expect(withoutDocs).toContain(".opencode-jce/cache.json");
  expect(withoutDocs).toContain(".env.local");

  const withDocs = buildSafeCommitPlan(files, { includeDocs: true });
  expect(withDocs).toContain("docs/superpowers/plans/new.md");
  expect(withDocs).toContain("git add src/plugin/index.ts docs/superpowers/plans/new.md");
});
```

Then fix the import at the top so it is one import:

```ts
import { buildSafeCommitPlan, buildVerificationRecipe, parseGitStatusPorcelain } from "../../src/plugin/lib/workflow-assistant.ts";
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: FAIL because `parseGitStatusPorcelain` and `buildSafeCommitPlan` are not implemented.

- [ ] **Step 3: Add classifier implementation**

Append to `src/plugin/lib/workflow-assistant.ts`:

```ts
export interface GitStatusFile {
  status: string;
  path: string;
}

export interface SafeCommitPlanOptions {
  includeDocs?: boolean;
  release?: boolean;
}

function normalizeStatus(code: string): string {
  const trimmed = code.trim();
  if (trimmed === "??") return "??";
  return trimmed || code.trim() || code.replace(/\s/g, "") || "M";
}

export function parseGitStatusPorcelain(output: string): GitStatusFile[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.startsWith("??") ? "??" : normalizeStatus(line.slice(0, 2));
      const path = line.startsWith("??") ? line.slice(3).trim() : line.slice(3).trim();
      return { status, path };
    });
}

function isDocsPlanOrSpec(path: string): boolean {
  return path.startsWith("docs/superpowers/specs/") || path.startsWith("docs/superpowers/plans/");
}

function isExcludedPath(path: string): boolean {
  const lower = path.toLowerCase();
  return path === ".opencode-context.md"
    || path === ".opencode-context-archive.md"
    || path.startsWith(".opencode-jce/")
    || path.startsWith(".env")
    || lower.includes("secret")
    || lower.includes("credential")
    || (/^[^/]+\.txt$/i).test(path);
}

function shellQuote(path: string): string {
  return /^[A-Za-z0-9_./-]+$/.test(path) ? path : `\"${path.replace(/\"/g, '\\\"')}\"`;
}

function bulletList(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- none"];
}

export function buildSafeCommitPlan(files: GitStatusFile[], options: SafeCommitPlanOptions = {}): string {
  const safe: string[] = [];
  const review: string[] = [];
  const excluded: string[] = [];

  for (const file of files) {
    if (isExcludedPath(file.path)) {
      excluded.push(file.path);
    } else if (isDocsPlanOrSpec(file.path) && !options.includeDocs) {
      review.push(`${file.path} (docs require includeDocs=true)`);
    } else {
      safe.push(file.path);
    }
  }

  const command = safe.length ? `git add ${safe.map(shellQuote).join(" ")}` : "No safe git add command available.";

  return [
    "Safe To Stage",
    ...bulletList(safe),
    "",
    "Review First",
    ...bulletList(review),
    "",
    "Excluded",
    ...bulletList(excluded),
    "",
    "Suggested Command",
    command,
  ].join("\n");
}
```

- [ ] **Step 4: Run safe commit plan tests**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: PASS with 4 tests.

## Task 3: Release Readiness Checker

**Files:**
- Modify: `src/plugin/lib/workflow-assistant.ts`
- Modify: `tests/unit/plugin-workflow-assistant.test.ts`

- [ ] **Step 1: Add failing release readiness tests**

Append inside `describe("workflow assistant", () => { ... })`:

```ts
import { buildReleaseReadyReport } from "../../src/plugin/lib/workflow-assistant.ts";

const syncedVersions = {
  "package.json": '{ "version": "2.0.9" }',
  "install.sh": 'VERSION="2.0.9"',
  "install.ps1": '$Version = "2.0.9"',
  "src/lib/constants.ts": 'export const VERSION = "2.0.9";',
  "src/lib/version.ts": 'export const CURRENT_CONFIG_VERSION = "2.0.9";',
  "src/mcp/context-keeper.ts": 'version: "2.0.9",',
  "README.md": "Version-2.0.9-green",
  "tests/unit/ui.test.ts": 'expect(output).toContain("v2.0.9");',
};

test("release readiness needs verification when versions are synced", () => {
  const result = buildReleaseReadyReport({
    targetVersion: "2.0.9",
    files: syncedVersions,
    statusFiles: parseGitStatusPorcelain(" M package.json\n M src/lib/constants.ts\n"),
    verificationEvidence: "",
  });

  expect(result).toContain("Status");
  expect(result).toContain("NEEDS_VERIFICATION");
  expect(result).toContain("Version Sync");
  expect(result).toContain("package.json: ok");
  expect(result).toContain("Required Verification");
});

test("release readiness reports version mismatch", () => {
  const result = buildReleaseReadyReport({
    targetVersion: "2.0.9",
    files: { ...syncedVersions, "README.md": "Version-2.0.8-green" },
    statusFiles: [],
    verificationEvidence: "623 pass 0 fail 2.0.9",
  });

  expect(result).toContain("NOT_READY");
  expect(result).toContain("README.md: missing 2.0.9");
});

test("release readiness rejects invalid target version", () => {
  const result = buildReleaseReadyReport({
    targetVersion: "v2",
    files: syncedVersions,
    statusFiles: [],
    verificationEvidence: "623 pass 0 fail",
  });

  expect(result).toContain("NOT_READY");
  expect(result).toContain("Invalid targetVersion");
});
```

Then fix the import at the top so it is one import:

```ts
import { buildReleaseReadyReport, buildSafeCommitPlan, buildVerificationRecipe, parseGitStatusPorcelain } from "../../src/plugin/lib/workflow-assistant.ts";
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: FAIL because `buildReleaseReadyReport` is not implemented.

- [ ] **Step 3: Add release readiness implementation**

Append to `src/plugin/lib/workflow-assistant.ts`:

```ts
const RELEASE_VERSION_FILES = [
  "package.json",
  "install.sh",
  "install.ps1",
  "src/lib/constants.ts",
  "src/lib/version.ts",
  "src/mcp/context-keeper.ts",
  "README.md",
  "tests/unit/ui.test.ts",
] as const;

export interface ReleaseReadyInput {
  targetVersion: string;
  files: Record<string, string | undefined>;
  statusFiles: GitStatusFile[];
  verificationEvidence?: string;
  includeDocs?: boolean;
}

function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function hasFreshVerificationEvidence(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const lower = value.toLowerCase();
  return lower.includes("0 fail") || lower.includes("exit 0") || lower.includes("passes") || lower.includes("passed");
}

export function buildReleaseReadyReport(input: ReleaseReadyInput): string {
  const blockers: string[] = [];
  const versionLines: string[] = [];

  if (!isSemver(input.targetVersion)) {
    blockers.push(`Invalid targetVersion: ${input.targetVersion}`);
  }

  for (const file of RELEASE_VERSION_FILES) {
    const content = input.files[file];
    if (content === undefined) {
      versionLines.push(`${file}: missing file content`);
      blockers.push(`${file} missing`);
      continue;
    }
    if (!content.includes(input.targetVersion)) {
      versionLines.push(`${file}: missing ${input.targetVersion}`);
      blockers.push(`${file} missing ${input.targetVersion}`);
      continue;
    }
    versionLines.push(`${file}: ok`);
  }

  const safePlan = buildSafeCommitPlan(input.statusFiles, { includeDocs: input.includeDocs, release: true });
  const hasVerification = hasFreshVerificationEvidence(input.verificationEvidence);
  const status = blockers.length ? "NOT_READY" : hasVerification ? "READY" : "NEEDS_VERIFICATION";

  return [
    "Status",
    status,
    "",
    "Version Sync",
    ...bulletList(versionLines),
    "",
    "Required Verification",
    ...bulletList(RECIPES.release.commands),
    "",
    "Safe Commit Plan",
    safePlan,
    "",
    "Blockers",
    ...bulletList(blockers),
  ].join("\n");
}
```

- [ ] **Step 4: Run release readiness tests**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: PASS with 7 tests.

## Task 4: Workspace Summary Helper

**Files:**
- Modify: `src/plugin/lib/workflow-assistant.ts`
- Modify: `tests/unit/plugin-workflow-assistant.test.ts`

- [ ] **Step 1: Add failing summary test**

Append inside `describe("workflow assistant", () => { ... })`:

```ts
import { buildWorkflowSummary } from "../../src/plugin/lib/workflow-assistant.ts";

test("workflow summary separates changed and local-only files", () => {
  const result = buildWorkflowSummary({
    scope: "release 2.0.9",
    files: parseGitStatusPorcelain(" M package.json\n?? .opencode-jce/cache.json\n?? notes.txt\n"),
    currentVersion: "2.0.9",
  });

  expect(result).toContain("Summary");
  expect(result).toContain("release 2.0.9");
  expect(result).toContain("Current version: 2.0.9");
  expect(result).toContain("Changed Files");
  expect(result).toContain("package.json");
  expect(result).toContain("Local-Only / Excluded Files");
  expect(result).toContain(".opencode-jce/cache.json");
  expect(result).toContain("notes.txt");
  expect(result).toContain("Suggested Next Step");
});
```

Then fix the import at the top so it is one import:

```ts
import { buildReleaseReadyReport, buildSafeCommitPlan, buildVerificationRecipe, buildWorkflowSummary, parseGitStatusPorcelain } from "../../src/plugin/lib/workflow-assistant.ts";
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: FAIL because `buildWorkflowSummary` is not implemented.

- [ ] **Step 3: Add summary implementation**

Append to `src/plugin/lib/workflow-assistant.ts`:

```ts
export interface WorkflowSummaryInput {
  scope?: string;
  files: GitStatusFile[];
  currentVersion?: string;
}

export function buildWorkflowSummary(input: WorkflowSummaryInput): string {
  const changed = input.files.filter((file) => !isExcludedPath(file.path)).map((file) => `${file.status} ${file.path}`);
  const excluded = input.files.filter((file) => isExcludedPath(file.path)).map((file) => `${file.status} ${file.path}`);
  const nextStep = changed.length
    ? "Run relevant verification, review diff, then commit only if user asks."
    : "No tracked work detected; clarify next task or inspect untracked files.";

  return [
    "Summary",
    `Scope: ${input.scope?.trim() || "current workspace"}`,
    `Current version: ${input.currentVersion || "unknown"}`,
    "",
    "Changed Files",
    ...bulletList(changed),
    "",
    "Local-Only / Excluded Files",
    ...bulletList(excluded),
    "",
    "Suggested Next Step",
    nextStep,
  ].join("\n");
}
```

- [ ] **Step 4: Run summary tests**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts
```

Expected: PASS with 8 tests.

## Task 5: Plugin Tool Wrapper

**Files:**
- Create: `src/plugin/tools/workflow.ts`
- Create: `tests/unit/plugin-workflow-tool.test.ts`

- [ ] **Step 1: Write failing tool tests**

Create `tests/unit/plugin-workflow-tool.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { buildWorkflowTool } from "../../src/plugin/tools/workflow.ts";

function context(directory = process.cwd()) {
  return {
    sessionID: "s",
    messageID: "m",
    agent: "jce-worker",
    directory,
    worktree: directory,
    abort: new AbortController().signal,
    metadata: () => {},
    ask: () => { throw new Error("not implemented"); },
  } as any;
}

describe("jce workflow tool", () => {
  test("returns verification recipe", async () => {
    const tool = buildWorkflowTool();
    const result = await tool.execute({ action: "verification_recipe", taskType: "release" } as any, context());

    expect(result).toContain("Commands");
    expect(result).toContain("bun run typecheck");
  });

  test("returns safe commit plan from supplied status text", async () => {
    const tool = buildWorkflowTool();
    const result = await tool.execute({
      action: "safe_commit_plan",
      gitStatus: " M src/plugin/index.ts\n?? .opencode-jce/cache.json\n",
      includeDocs: false,
    } as any, context());

    expect(result).toContain("Safe To Stage");
    expect(result).toContain("src/plugin/index.ts");
    expect(result).toContain("Excluded");
    expect(result).toContain(".opencode-jce/cache.json");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-workflow-tool.test.ts
```

Expected: FAIL because `src/plugin/tools/workflow.ts` does not exist.

- [ ] **Step 3: Create workflow tool wrapper**

Create `src/plugin/tools/workflow.ts` with:

```ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import type { ToolDefinition } from "@opencode-ai/plugin";
import {
  buildReleaseReadyReport,
  buildSafeCommitPlan,
  buildVerificationRecipe,
  buildWorkflowSummary,
  parseGitStatusPorcelain,
  type WorkflowTaskType,
} from "../lib/workflow-assistant.js";

const z = tool.schema;

function readGitStatus(cwd: string): string {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" });
  } catch (error) {
    return "";
  }
}

function readVersion(cwd: string): string | undefined {
  const constantsPath = join(cwd, "src/lib/constants.ts");
  if (!existsSync(constantsPath)) return undefined;
  const match = readFileSync(constantsPath, "utf8").match(/VERSION\s*=\s*"([^"]+)"/);
  return match?.[1];
}

function readReleaseFiles(cwd: string): Record<string, string | undefined> {
  const files = [
    "package.json",
    "install.sh",
    "install.ps1",
    "src/lib/constants.ts",
    "src/lib/version.ts",
    "src/mcp/context-keeper.ts",
    "README.md",
    "tests/unit/ui.test.ts",
  ];
  return Object.fromEntries(files.map((file) => {
    const path = join(cwd, file);
    return [file, existsSync(path) ? readFileSync(path, "utf8") : undefined];
  }));
}

export function buildWorkflowTool(): ToolDefinition {
  return tool({
    description: "Read-only JCE workflow helper for summaries, verification recipes, safe commit plans, and release readiness.",
    args: {
      action: z.enum(["summary", "verification_recipe", "safe_commit_plan", "release_ready"]),
      scope: z.string().optional(),
      taskType: z.enum(["agent_prompt", "config", "installer", "release", "docs", "tests", "unknown"]).optional(),
      includeDocs: z.boolean().optional(),
      release: z.boolean().optional(),
      targetVersion: z.string().optional(),
      verificationEvidence: z.string().optional(),
      gitStatus: z.string().optional().describe("Optional git status --porcelain text for tests or explicit input"),
    },
    async execute(args, context) {
      const cwd = context.directory || context.worktree || process.cwd();
      const statusText = typeof args.gitStatus === "string" ? args.gitStatus : readGitStatus(cwd);
      const statusFiles = parseGitStatusPorcelain(statusText);

      switch (args.action) {
      case "summary":
        return buildWorkflowSummary({ scope: args.scope as string | undefined, files: statusFiles, currentVersion: readVersion(cwd) });
      case "verification_recipe":
        return buildVerificationRecipe((args.taskType as WorkflowTaskType | undefined) ?? "unknown");
      case "safe_commit_plan":
        return buildSafeCommitPlan(statusFiles, { includeDocs: Boolean(args.includeDocs), release: Boolean(args.release) });
      case "release_ready":
        if (typeof args.targetVersion !== "string") return "Status\nNOT_READY\n\nBlockers\n- targetVersion is required";
        return buildReleaseReadyReport({
          targetVersion: args.targetVersion,
          files: readReleaseFiles(cwd),
          statusFiles,
          includeDocs: Boolean(args.includeDocs),
          verificationEvidence: args.verificationEvidence as string | undefined,
        });
      default:
        return "Unknown jce_workflow action.";
      }
    },
  });
}
```

- [ ] **Step 4: Run tool tests**

Run:

```bash
bun test tests/unit/plugin-workflow-tool.test.ts
```

Expected: PASS with 2 tests.

## Task 6: Plugin Registration

**Files:**
- Modify: `src/plugin/index.ts`
- Modify: `tests/unit/plugin-entry.test.ts`

- [ ] **Step 1: Add failing plugin registration test**

Append inside `describe("plugin entry point", () => { ... })` in `tests/unit/plugin-entry.test.ts`:

```ts
  test("server exposes jce_workflow tool", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(
      {
        client: {} as any,
        project: {} as any,
        directory: process.cwd(),
        worktree: process.cwd(),
        serverUrl: new URL("http://localhost:3000"),
        $: {} as any,
        experimental_workspace: { register: () => {} },
      } as any,
    );

    expect(hooks.tool).toBeDefined();
    expect(hooks.tool.jce_workflow).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
bun test tests/unit/plugin-entry.test.ts --test-name-pattern "jce_workflow"
```

Expected: FAIL because `jce_workflow` is not registered.

- [ ] **Step 3: Register workflow tool**

Modify `src/plugin/index.ts` imports:

```ts
import { buildDispatchTool, buildStatusTool, buildCollectTool } from "./tools/dispatch.js";
import { buildWorkflowTool } from "./tools/workflow.js";
```

Modify the `tool` object:

```ts
      bg_status: buildStatusTool(manager),
      bg_collect: buildCollectTool(manager, client, persistCurrentMemory),
      jce_workflow: buildWorkflowTool(),
```

- [ ] **Step 4: Run plugin entry test**

Run:

```bash
bun test tests/unit/plugin-entry.test.ts --test-name-pattern "jce_workflow"
```

Expected: PASS with 1 test.

## Task 7: JCE-Worker Prompt Integration

**Files:**
- Modify: `src/plugin/agents/jce-worker.ts`
- Modify: `tests/unit/plugin-agents.test.ts`

- [ ] **Step 1: Add failing prompt marker test**

Append to the existing test `jce-worker prompt defines v3 full hybrid execution contract` in `tests/unit/plugin-agents.test.ts`:

```ts
    expect(prompt).toContain("jce_workflow");
    expect(prompt).toContain("safe_commit_plan");
    expect(prompt).toContain("release_ready");
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
bun test tests/unit/plugin-agents.test.ts --test-name-pattern "v3 full hybrid"
```

Expected: FAIL because prompt does not mention `jce_workflow` yet.

- [ ] **Step 3: Add workflow tool guidance to prompt**

In `src/plugin/agents/jce-worker.ts`, insert this section after `## Delegation Contract` and before `## Verification Evidence`:

```md
## Workflow Assistant Tool
- Use jce_workflow summary when the user asks what happened, what changed, or what remains.
- Use jce_workflow verification_recipe before choosing verification for unfamiliar task types.
- Use jce_workflow safe_commit_plan before any commit request to avoid staging context, scratch, secrets, or unrelated files.
- Use jce_workflow release_ready before release commits or pushes to check version sync, verification needs, and safe staging.
- The tool is advisory and read-only. Do not treat it as permission to commit or push.
```

- [ ] **Step 4: Run prompt tests**

Run:

```bash
bun test tests/unit/plugin-agents.test.ts --test-name-pattern "jce-worker"
```

Expected: PASS with all JCE-Worker prompt tests.

## Task 8: Full Verification and Diff Review

**Files:**
- No code edits expected unless verification fails.

- [ ] **Step 1: Run focused workflow tests**

Run:

```bash
bun test tests/unit/plugin-workflow-assistant.test.ts tests/unit/plugin-workflow-tool.test.ts tests/unit/plugin-entry.test.ts tests/unit/plugin-agents.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 2: Run full verification**

Run:

```bash
bun run typecheck && bun test && bun ./src/index.ts validate && bash -n install.sh && bun ./src/index.ts --version
```

Expected:

```text
tsc --noEmit exits 0
bun test reports 0 fail
All 24 config files are valid
bash -n install.sh exits 0 with no output
2.0.9
```

- [ ] **Step 3: Review relevant diff**

Run:

```bash
git diff -- src/plugin/lib/workflow-assistant.ts src/plugin/tools/workflow.ts src/plugin/index.ts src/plugin/agents/jce-worker.ts tests/unit/plugin-workflow-assistant.test.ts tests/unit/plugin-workflow-tool.test.ts tests/unit/plugin-entry.test.ts tests/unit/plugin-agents.test.ts docs/superpowers/specs/2026-05-07-jce-worker-assistant-tools-design.md docs/superpowers/plans/2026-05-07-jce-worker-assistant-tools.md
```

Expected: Diff contains only JCE workflow helper, tool registration, prompt guidance, tests, and approved spec/plan docs.

- [ ] **Step 4: Commit only if user explicitly asks**

If user explicitly requests commit/push, stage only relevant files:

```bash
git add src/plugin/lib/workflow-assistant.ts src/plugin/tools/workflow.ts src/plugin/index.ts src/plugin/agents/jce-worker.ts tests/unit/plugin-workflow-assistant.test.ts tests/unit/plugin-workflow-tool.test.ts tests/unit/plugin-entry.test.ts tests/unit/plugin-agents.test.ts docs/superpowers/specs/2026-05-07-jce-worker-assistant-tools-design.md docs/superpowers/plans/2026-05-07-jce-worker-assistant-tools.md
git commit -m "feat(plugin): add JCE workflow assistant tool"
```

Do not stage:

```text
.opencode-context.md
.opencode-context-archive.md
.opencode-jce/
*.txt scratch notes
unrelated files
```

## Self-Review

- Spec coverage: summary, verification recipe, safe commit plan, release readiness, prompt integration, read-only behavior, error handling, and tests are covered.
- Placeholder scan: no `TBD`, `TODO`, or unresolved implementation steps.
- Type consistency: action names use `summary`, `verification_recipe`, `safe_commit_plan`, and `release_ready` across spec, plan, helper, tool, tests, and prompt.
- Scope check: tool is read-only and does not auto-commit, auto-push, or edit project files.
