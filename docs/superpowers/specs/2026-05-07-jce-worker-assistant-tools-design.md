# JCE-Worker Assistant Tools Design

## Goal

Make `jce-worker` easier to use for real project work by adding read-only workflow helper tools that summarize state, suggest verification, prepare safe staging plans, and check release readiness.

## Non-Goals

- Do not auto-commit or auto-push.
- Do not edit project files.
- Do not change default OpenCode selected agent.
- Do not replace existing JCE-Worker runtime gates.
- Do not add new agent IDs.
- Do not include local context, scratch, secrets, or unrelated files in suggested commits.

## User Value

- Reduce repeated manual checks during release work.
- Avoid accidentally committing local context or scratch files.
- Preserve session continuity with fast state summaries.
- Make verification choices consistent across task types.

## Tool Shape

Add one JCE plugin tool: `jce_workflow`.

The tool is read-only and supports four actions:

- `summary`
- `verification_recipe`
- `safe_commit_plan`
- `release_ready`

All actions return concise plain text by default. JSON output can be added later if needed, but is not required for v1.

## Action: `summary`

Purpose: answer "what has happened and what is next?" from the current workspace.

Inputs:

- Optional `scope`: free-text task or release name.

Behavior:

- Read git status.
- List changed tracked files and untracked files separately.
- Highlight likely local-only files:
  - `.opencode-context.md`
  - `.opencode-context-archive.md`
  - `.opencode-jce/`
  - scratch notes such as `*.txt` at repo root
- Report current version from CLI constants when available.
- Suggest next step based on state:
  - verify if code changed
  - review diff if verification already likely complete
  - commit only if user asks

Output sections:

- Summary
- Changed Files
- Local-Only / Excluded Files
- Suggested Next Step

## Action: `verification_recipe`

Purpose: recommend correct verification commands based on task type.

Inputs:

- Required `taskType`: one of `agent_prompt`, `config`, `installer`, `release`, `docs`, `tests`, `unknown`.

Behavior:

- Return a command list and what success looks like.
- Keep recommendations aligned with existing project commands.

Recipes:

- `agent_prompt`: focused plugin agent test, then full test if release-bound.
- `config`: config hardening tests, validate command, typecheck.
- `installer`: Bash syntax, PowerShell parser when available, installer unit tests.
- `release`: typecheck, full test suite, config validate, Bash syntax, CLI version.
- `docs`: no build-required check unless docs include generated examples; suggest diff review.
- `tests`: targeted test, then affected wider suite.
- `unknown`: inspect changed files and recommend conservative full verification.

Output sections:

- Commands
- Success Criteria
- Notes

## Action: `safe_commit_plan`

Purpose: produce a safe staging list without modifying git state.

Inputs:

- Optional `includeDocs`: boolean, default `false`.
- Optional `release`: boolean, default `false`.

Behavior:

- Read git status.
- Classify files as:
  - safe to stage
  - review before staging
  - exclude
- Exclude by default:
  - `.opencode-context.md`
  - `.opencode-context-archive.md`
  - `.opencode-jce/`
  - `.env*`
  - credential/secrets-looking files
  - root scratch notes (`*.txt`) unless explicitly requested
- Include docs under `docs/superpowers/specs/` and `docs/superpowers/plans/` only when `includeDocs` is true.
- Never run `git add`.

Output sections:

- Safe To Stage
- Review First
- Excluded
- Suggested Command

The suggested command must include only safe paths and be copy-pasteable.

## Action: `release_ready`

Purpose: check whether repository is ready for a release commit.

Inputs:

- Required `targetVersion`: semver string such as `2.0.9`.
- Optional `includeDocs`: boolean, default `false`.

Behavior:

- Check version sync across:
  - `package.json`
  - `install.sh`
  - `install.ps1`
  - `src/lib/constants.ts`
  - `src/lib/version.ts`
  - `src/mcp/context-keeper.ts`
  - `README.md`
  - `tests/unit/ui.test.ts`
- Check for older version remnants in those target files.
- Run no commands in v1 unless explicitly invoked through a separate shell by the user or agent. Instead, report required verification commands.
- Use `safe_commit_plan` classification to warn about excluded files.
- Return readiness as `READY`, `NOT_READY`, or `NEEDS_VERIFICATION`.

Status rules:

- `READY`: version sync passes, no unsafe required files, and caller provides fresh verification evidence in prompt or workflow memory.
- `NEEDS_VERIFICATION`: version sync passes, but fresh verification evidence is missing.
- `NOT_READY`: version mismatch, unsafe staged files, missing expected files, or target files still contain old version.

Output sections:

- Status
- Version Sync
- Required Verification
- Safe Commit Plan
- Blockers

## Integration With JCE-Worker

Update `jce-worker` prompt with a short section telling it to use `jce_workflow` when helpful:

- Use `summary` when user asks what happened or what remains.
- Use `verification_recipe` before deciding verification for unfamiliar task types.
- Use `safe_commit_plan` before any commit request.
- Use `release_ready` before release commit or push.

Do not make tool usage mandatory for every task; use it when it reduces risk or saves manual work.

## Testing Strategy

- Unit-test pure classifiers for safe commit planning.
- Unit-test version sync checker with matching and mismatching fixtures.
- Unit-test verification recipe output for each task type.
- Unit-test tool output shape for all four actions.
- Add prompt marker test that `jce-worker` knows about `jce_workflow`.

## Error Handling

- If git status cannot be read, return `NOT_READY` or an explicit error section with the command failure.
- If version files are missing, mark release readiness `NOT_READY` and list missing files.
- If target version is invalid, return a validation error and do not continue.
- If untracked files are large or numerous, summarize count and show first relevant paths.

## Acceptance Criteria

- `jce_workflow summary` gives concise workspace summary without modifying files.
- `jce_workflow verification_recipe` returns task-specific commands and success criteria.
- `jce_workflow safe_commit_plan` produces a staging command excluding local context/scratch/secrets.
- `jce_workflow release_ready` detects synchronized and unsynchronized release versions.
- JCE-Worker prompt references the tool for summary, verification, commit planning, and release readiness.
- Tests cover the pure logic and tool action routing.
- Full verification passes before release.

## Rollout

Implement in one release after current JCE-Worker v3 prompt release is committed or intentionally folded into the same release. Prefer separate release if minimizing risk.
