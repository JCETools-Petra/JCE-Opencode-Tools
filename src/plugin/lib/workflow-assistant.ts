export type WorkflowRecipeTaskType = "agent_prompt" | "config" | "installer" | "release" | "docs" | "tests" | "unknown";

interface VerificationRecipe {
  commands: string[];
  successCriteria: string[];
  notes: string[];
}

const RECIPES: Record<WorkflowRecipeTaskType, VerificationRecipe> = {
  agent_prompt: {
    commands: [
      "bun test tests/unit/plugin-agents.test.ts --test-name-pattern \"jce-worker\"",
      "bun test",
    ],
    successCriteria: ["Focused prompt tests pass", "prompt markers match expected behavior contract"],
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

export function buildVerificationRecipe(taskType: WorkflowRecipeTaskType): string {
  const recipe = RECIPES[taskType] ?? RECIPES.unknown;
  return [
    section("Commands", recipe.commands),
    "",
    section("Success Criteria", recipe.successCriteria),
    "",
    section("Notes", recipe.notes),
  ].join("\n");
}

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
      const rawPath = line.slice(3).trim();
      const path = /^[RC]/.test(status) && rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)?.trim() || rawPath : rawPath;
      return { status, path };
    });
}

function isDocsPlanOrSpec(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return normalized.startsWith("docs/superpowers/specs/") || normalized.startsWith("docs/superpowers/plans/");
}

function isExcludedPath(path: string): boolean {
  const lower = path.replace(/\\/g, "/").toLowerCase();
  return lower === ".opencode-context.md"
    || lower === ".opencode-context-archive.md"
    || lower.startsWith(".opencode-jce/")
    || lower.startsWith(".env")
    || lower.includes("secret")
    || lower.includes("credential")
    || lower.includes("creds")
    || lower.includes("id_rsa")
    || lower.includes("private.key")
    || lower.endsWith("/.npmrc")
    || lower === ".npmrc"
    || lower.endsWith("/.pypirc")
    || lower === ".pypirc"
    || (/^[^/]+\.txt$/i).test(path);
}

function shellQuote(path: string): string {
  return /^[A-Za-z0-9_./-]+$/.test(path) ? path : `'${path.replace(/'/g, `'\\''`)}'`;
}

function bulletList(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- none"];
}

function classifySafeCommitFiles(files: GitStatusFile[], options: SafeCommitPlanOptions = {}): { safe: string[]; review: string[]; excluded: string[] } {
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

  return { safe, review, excluded };
}

export function buildSafeCommitPlan(files: GitStatusFile[], options: SafeCommitPlanOptions = {}): string {
  const { safe, review, excluded } = classifySafeCommitFiles(files, options);

  const command = safe.length ? `git add -- ${safe.map(shellQuote).join(" ")}` : "No safe git add command available.";

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

export interface WorkflowSummaryInput {
  scope?: string;
  files: GitStatusFile[];
  currentVersion?: string;
}

export function buildWorkflowSummary(input: WorkflowSummaryInput): string {
  const changed = input.files
    .filter((file) => !isExcludedPath(file.path))
    .map((file) => `${file.status} ${file.path}`);
  const excluded = input.files
    .filter((file) => isExcludedPath(file.path))
    .map((file) => `${file.status} ${file.path}`);
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

function hasFreshVerificationEvidence(value: string | undefined, targetVersion: string): boolean {
  if (!value?.trim()) return false;
  const lower = value.toLowerCase();
  const failCounts = [...lower.matchAll(/\b(\d+)\s+fail\b/g)];
  const hasNonZeroFailCount = failCounts.some((match) => match[1] !== "0");
  const exitCodes = [...lower.matchAll(/\b(?:exit|exit code|status|exited with|exited|returned|failed with code|process exited)\s+(\d+)\b/g)];
  const hasNonZeroExitCode = exitCodes.some((match) => match[1] !== "0");
  if (hasNonZeroFailCount
    || hasNonZeroExitCode
    || lower.includes("failed")
    || lower.includes("error")
    || lower.includes("wrong")
    || lower.includes("non-zero exit")
    || lower.includes("command failed")) {
    return false;
  }
  const hasTypecheck = lower.includes("typecheck") || lower.includes("tsc");
  const hasTests = (lower.includes("bun test") || /\btests?\b/.test(lower)) && lower.includes("0 fail");
  const hasValidate = lower.includes("validate") || lower.includes("config valid");
  const hasInstallCheck = lower.includes("bash -n install.sh");
  const hasVersionCheck = lower.includes(targetVersion) || lower.includes("--version") || lower.includes("version command");
  return hasTypecheck && hasTests && hasValidate && hasInstallCheck && hasVersionCheck;
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

    const staleVersions = [...new Set(content.match(/\d+\.\d+\.\d+/g)?.filter((version) => version !== input.targetVersion) ?? [])];
    if (staleVersions.length) {
      versionLines.push(`${file}: stale ${staleVersions.join(", ")}`);
      blockers.push(`${file}: stale ${staleVersions.join(", ")}`);
      continue;
    }

    versionLines.push(`${file}: ok`);
  }

  const safePlanOptions = { includeDocs: input.includeDocs, release: true };
  const safeClassification = classifySafeCommitFiles(input.statusFiles, safePlanOptions);
  for (const path of safeClassification.excluded) {
    blockers.push(`${path} excluded from safe commit plan`);
  }
  for (const path of safeClassification.review) {
    blockers.push(path.replace(" (docs require includeDocs=true)", " requires includeDocs=true"));
  }

  const safePlan = buildSafeCommitPlan(input.statusFiles, safePlanOptions);
  const hasVerification = hasFreshVerificationEvidence(input.verificationEvidence, input.targetVersion);
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
