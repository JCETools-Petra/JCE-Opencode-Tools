# Android JCE-Worker Enhancement Plan

> Live checklist. Items are marked as completed as implementation progresses.

## Goals

- [x] Add Android verification recipe selection.
- [x] Add Android project scanner.
- [x] Add Android build failure classifier.
- [x] Add Android specialist subagent.
- [x] Add specialized Android skills and routing priority.
- [x] Add/update tests for all Android enhancements.
- [x] Run typecheck and full test suite.
- [x] Add automatic `android_logcat` tool.

## Phase 7 — Automatic Logcat Analysis

- [x] Create `src/plugin/tools/android-logcat.ts`.
- [x] Detect authorized adb devices with `adb devices`.
- [x] Support `deviceId`, `packageName`, recent line count, clear-before-read, and raw excerpt options.
- [x] Resolve package PID with `adb shell pidof <packageName>` when possible.
- [x] Collect recent logs using `adb logcat -d -v time -t <lines>`.
- [x] Filter logcat by PID/package and Android crash keywords.
- [x] Reuse Android failure classifier for runtime crash/ANR/native/install/build signals.
- [x] Register `android_logcat` in plugin tools.
- [x] Update JCE-Worker and Android agent prompts to use `android_logcat`.
- [x] Add unit tests for success, no-device blocker, and formatted tool output.

## Phase 1 — Audit And Design

- [x] Audit current plugin architecture: agent config, dispatch, workflow helper, skill loader, tests.
- [x] Confirm Android integration points are fully covered.
- [x] Record any compatibility constraints discovered during implementation.

## Phase 2 — Android Intelligence Libraries

### Verification Recipe
- [x] Create `src/plugin/lib/android/verification-recipe.ts`.
- [x] Detect Android change kinds from prompt/files/diff text.
- [x] Map change kinds to verification commands.
- [x] Support module-aware Gradle task formatting.
- [x] Add tests for verification recipe behavior.

### Project Scanner
- [x] Create `src/plugin/lib/android/project-scanner.ts`.
- [x] Detect Android project roots and Gradle wrapper.
- [x] Parse settings files and discover modules.
- [x] Parse module Gradle files for SDK/build feature/dependency signals.
- [x] Parse version catalog for AGP/Kotlin/KSP signals.
- [x] Add warnings and recommended verification output.
- [x] Add tests for scanner behavior.

### Failure Classifier
- [x] Create `src/plugin/lib/android/failure-classifier.ts`.
- [x] Detect common Android/Gradle/runtime failure categories.
- [x] Extract evidence lines and recommended next commands.
- [x] Add tests for classifier behavior.

## Phase 3 — Android Skills And Routing

- [x] Add specialized Android skills:
  - [x] `android-gradle`
  - [x] `android-testing`
  - [x] `android-release`
  - [x] `android-compose`
  - [x] `android-security`
- [x] Extend skill loader mapping.
- [x] Add Android-specific routing patterns.
- [x] Add Android skill prioritization logic.
- [x] Update `config/AGENTS.md` with new skill docs/examples.
- [x] Update config skill count tests.

## Phase 4 — Android Specialist Agent

- [x] Add `src/plugin/agents/android.ts`.
- [x] Register Android agent in plugin config.
- [x] Allow dispatch to `android` agent.
- [x] Allow Android sub-agent skill injection.
- [x] Extend orchestration types/agent hints if needed.
- [x] Update agent and integration tests.

## Phase 5 — Workflow And JCE-Worker Integration

- [x] Extend workflow helper with Android-aware verification recipe support.
- [x] Add Android-focused workflow planning cues.
- [x] Update JCE-Worker system prompt to use Android scanner/classifier/verification logic.
- [x] Ensure delegated Android work uses explicit output contract.

## Phase 6 — Verification And Closeout

- [x] Run focused tests for new Android modules.
- [x] Run `bun run typecheck`.
- [x] Run full `bun test`.
- [x] Update this plan with all completed checklist items.
- [x] Update project context with completed Android enhancement work.

## Verification Evidence

- [x] `bun run typecheck` — passed.
- [x] Focused Android/agent/config tests — passed: 67 pass / 0 fail, then updated agent/settings tests 64 pass / 0 fail.
- [x] `bun test` — passed: 905 pass / 0 fail.
- [x] Re-run verification after `android_logcat` implementation.
- [x] `bun run typecheck` after `android_logcat` — passed.
- [x] Focused logcat/plugin tests — passed: 45 pass / 0 fail.
- [x] Full `bun test` after `android_logcat` — passed: 909 pass / 0 fail.

## Phase 8 — Context Continuity Enhancements

- [x] Implement `context_autocapture` for high-confidence automatic context writes.
- [x] Implement `context_session_summary` for next-session continuity summaries.
- [x] Implement `context_compact` for duplicate/verbose status and note compaction.
- [x] Implement structured project facts storage in `.opencode-jce/project-facts.json`.
- [x] Implement confidence-based capture entries: high/medium persisted, low ignored by default.
- [x] Add context autocapture unit tests.
- [x] Register context tools in `context-keeper` MCP server.
- [x] `bun run typecheck` after context enhancements — passed.
- [x] Focused context tests — passed: 41 pass / 0 fail.
- [x] Full `bun test` after context enhancements — passed: 914 pass / 0 fail.

## Phase 9 — Restart/Update Realization Readiness

- [x] Native OpenCode template includes Android agent description/mode so restart exposes bundled Android agent.
- [x] Plugin config injects Android agent and `android_logcat` tool after restart.
- [x] `context-keeper` MCP source includes new context tools for restart: `context_autocapture`, `context_session_summary`, `context_compact`.
- [x] Update command now refreshes existing bundled skill directories with timestamped `SKILL.md.backup.*` files instead of only adding missing skills.
- [x] `opencode-jce validate` passed: all 24 config files valid.
- [x] Focused update/restart readiness tests passed: 156 pass / 0 fail.
- [x] Full `bun test` after update readiness changes passed: 916 pass / 0 fail.
