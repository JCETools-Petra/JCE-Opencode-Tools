# Chinese Output Auto-Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically translate detected Chinese text in AI-controlled plugin outputs into English without asking the user each time.

**Architecture:** Add a small pure filter module for Chinese detection and output transformation. Integrate it into delegated `bg_collect` output and `tool.execute.after` string output using an optional translator adapter; when no translator is available or translation fails, preserve original output with a warning.

**Tech Stack:** TypeScript, Bun test runner, OpenCode plugin hooks/tools, existing plugin client/context.

---

## File Structure

- Create `src/plugin/lib/chinese-output-filter.ts`: Chinese detection, translation prompt construction, fallback note/warning, and filter function.
- Create `tests/unit/plugin-chinese-output-filter.test.ts`: unit tests for detection, success, failure, unchanged English, and code-fence safety instructions.
- Modify `src/plugin/tools/dispatch.ts`: allow `buildCollectTool` to receive an optional output filter and apply it to returned `bg_collect` output.
- Modify `tests/unit/plugin-tools.test.ts`: add integration-style tests for `bg_collect` translation success/failure.
- Modify `src/plugin/index.ts`: create translator/filter wiring and apply it in `bg_collect` and `tool.execute.after` when safe.
- Modify `tests/unit/plugin-integration.test.ts`: add `tool.execute.after` output-filter integration test.

## Task 1: Chinese Output Filter Core

**Files:**
- Create: `src/plugin/lib/chinese-output-filter.ts`
- Create: `tests/unit/plugin-chinese-output-filter.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `tests/unit/plugin-chinese-output-filter.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  CHINESE_TRANSLATION_FAILED_WARNING,
  CHINESE_TRANSLATION_NOTE,
  buildChineseTranslationPrompt,
  containsChinese,
  filterChineseOutput,
} from "../../src/plugin/lib/chinese-output-filter.ts";

describe("Chinese output filter", () => {
  test("detects Chinese text with threshold", () => {
    expect(containsChinese("All output is English.")).toBe(false);
    expect(containsChinese("请修复这个错误")).toBe(true);
    expect(containsChinese("中")).toBe(false);
    expect(containsChinese("中。")).toBe(true);
  });

  test("returns English-only translated output with note", async () => {
    const result = await filterChineseOutput("请修复这个错误", async (text) => {
      expect(text).toBe("请修复这个错误");
      return "Please fix this error.";
    });

    expect(result).toBe(`Please fix this error.\n\n${CHINESE_TRANSLATION_NOTE}`);
  });

  test("leaves English output unchanged", async () => {
    await expect(filterChineseOutput("No Chinese here.", async () => "unused")).resolves.toBe("No Chinese here.");
  });

  test("preserves original output with warning when translation fails", async () => {
    const result = await filterChineseOutput("请修复这个错误", async () => {
      throw new Error("translator unavailable");
    });

    expect(result).toBe(`请修复这个错误\n\n${CHINESE_TRANSLATION_FAILED_WARNING}`);
  });

  test("builds strict translation prompt that preserves code and commands", () => {
    const prompt = buildChineseTranslationPrompt("说明:\n```ts\nconst message = \"不要翻译\";\n```\nRun `bun test`.");

    expect(prompt).toContain("Translate Chinese natural language to English");
    expect(prompt).toContain("Do not translate fenced code blocks");
    expect(prompt).toContain("Do not translate inline code");
    expect(prompt).toContain("Do not translate commands, URLs, file paths, JSON, or stack traces");
    expect(prompt).toContain("Do not summarize");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-chinese-output-filter.test.ts
```

Expected: FAIL because `src/plugin/lib/chinese-output-filter.ts` does not exist.

- [ ] **Step 3: Implement filter core**

Create `src/plugin/lib/chinese-output-filter.ts`:

```ts
export const CHINESE_TRANSLATION_NOTE = "Chinese text was automatically translated to English.";
export const CHINESE_TRANSLATION_FAILED_WARNING = "Chinese text was detected, but automatic translation failed. Original output preserved.";

export type ChineseTranslator = (text: string) => Promise<string>;

const CHINESE_CHARACTER_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu;
const CHINESE_PUNCTUATION_PATTERN = /[，。！？；：「」『』（）【】、]/u;

export function containsChinese(text: string): boolean {
  const matches = text.match(CHINESE_CHARACTER_PATTERN) ?? [];
  if (matches.length >= 2) return true;
  return matches.length >= 1 && CHINESE_PUNCTUATION_PATTERN.test(text);
}

export function buildChineseTranslationPrompt(text: string): string {
  return [
    "Translate Chinese natural language to English.",
    "Do not summarize. Do not add new facts. Preserve Markdown formatting.",
    "Do not translate fenced code blocks.",
    "Do not translate inline code.",
    "Do not translate commands, URLs, file paths, JSON, or stack traces.",
    "Return only the translated output, with no preface.",
    "",
    text,
  ].join("\n");
}

export async function filterChineseOutput(text: string, translator?: ChineseTranslator): Promise<string> {
  if (!containsChinese(text)) return text;
  if (!translator) return `${text}\n\n${CHINESE_TRANSLATION_FAILED_WARNING}`;

  try {
    const translated = (await translator(text)).trim();
    if (!translated || containsChinese(translated)) return `${text}\n\n${CHINESE_TRANSLATION_FAILED_WARNING}`;
    return `${translated}\n\n${CHINESE_TRANSLATION_NOTE}`;
  } catch {
    return `${text}\n\n${CHINESE_TRANSLATION_FAILED_WARNING}`;
  }
}
```

- [ ] **Step 4: Run filter tests**

Run:

```bash
bun test tests/unit/plugin-chinese-output-filter.test.ts
```

Expected: PASS with 5 tests.

## Task 2: bg_collect Output Filtering

**Files:**
- Modify: `src/plugin/tools/dispatch.ts`
- Modify: `tests/unit/plugin-tools.test.ts`

- [ ] **Step 1: Add failing bg_collect filter tests**

In `tests/unit/plugin-tools.test.ts`, add tests inside `describe("plugin tools", () => { ... })`:

```ts
  test("collect tool translates Chinese completed output", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({
      description: "test",
      prompt: "p",
      agent: "explorer",
      parentSessionId: "s",
      parentMessageId: "m",
    });
    manager.completeTask(task.id, "## Summary\n请修复这个错误\n\n## Files\n- none\n\n## Verification\n- not run\n\n## Risks\n- none");

    const tool = buildCollectTool(manager, undefined, undefined, async (text) => text.replace("请修复这个错误", "Please fix this error."));
    const result = await tool.execute({ taskId: task.id } as any, {
      sessionID: "s",
      messageID: "m",
      agent: "explorer",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: () => { throw new Error("not implemented"); },
    } as any);

    expect(result).toContain("Please fix this error.");
    expect(result).toContain("Chinese text was automatically translated to English.");
    expect(result).not.toContain("请修复这个错误");
  });

  test("collect tool preserves Chinese output with warning when translation fails", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({
      description: "test",
      prompt: "p",
      agent: "explorer",
      parentSessionId: "s",
      parentMessageId: "m",
    });
    manager.completeTask(task.id, "## Summary\n请修复这个错误\n\n## Files\n- none\n\n## Verification\n- not run\n\n## Risks\n- none");

    const tool = buildCollectTool(manager, undefined, undefined, async () => {
      throw new Error("translator unavailable");
    });
    const result = await tool.execute({ taskId: task.id } as any, {
      sessionID: "s",
      messageID: "m",
      agent: "explorer",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: () => { throw new Error("not implemented"); },
    } as any);

    expect(result).toContain("请修复这个错误");
    expect(result).toContain("Chinese text was detected, but automatic translation failed. Original output preserved.");
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-tools.test.ts --test-name-pattern "collect tool translates|collect tool preserves Chinese"
```

Expected: FAIL because `buildCollectTool` does not accept the fourth filter argument yet.

- [ ] **Step 3: Modify collect tool**

In `src/plugin/tools/dispatch.ts`, add import:

```ts
import { filterChineseOutput, type ChineseTranslator } from "../lib/chinese-output-filter.js";
```

Change signature:

```ts
export function buildCollectTool(
  manager: BackgroundManager,
  client?: any,
  afterMutation?: () => void,
  chineseTranslator?: ChineseTranslator,
): ToolDefinition {
```

Inside `execute`, add helper before first return:

```ts
      const filterOutput = (text: string) => filterChineseOutput(text, chineseTranslator);
```

Wrap every string return that includes task output or generated result:

```ts
return filterOutput(result);
```

For simple non-Chinese status returns, also safe to use `filterOutput(...)` for consistency:

```ts
if (!task) return filterOutput(`Task not found: ${taskId}`);
```

Ensure existing `afterMutation?.()` calls still happen before return.

- [ ] **Step 4: Run bg_collect tests**

Run:

```bash
bun test tests/unit/plugin-tools.test.ts --test-name-pattern "collect tool translates|collect tool preserves Chinese"
```

Expected: PASS with 2 tests.

- [ ] **Step 5: Run full plugin tools test**

Run:

```bash
bun test tests/unit/plugin-tools.test.ts
```

Expected: PASS with existing and new plugin tool tests.

## Task 3: Plugin Translator Adapter and Hook Filtering

**Files:**
- Modify: `src/plugin/index.ts`
- Modify: `tests/unit/plugin-integration.test.ts`

- [ ] **Step 1: Add failing plugin integration tests**

In `tests/unit/plugin-integration.test.ts`, add tests for `tool.execute.after` output filtering. Use a fake client shape and direct hook invocation:

```ts
  test("tool.execute.after translates Chinese string output when translator is available", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server(
      {
        client: {
          session: {
            create: async () => ({ id: "translation-session" }),
            chat: async () => ({ text: "Please fix this error." }),
          },
        } as any,
        project: {} as any,
        directory: process.cwd(),
        worktree: process.cwd(),
        serverUrl: new URL("http://localhost:3000"),
        $: {} as any,
        experimental_workspace: { register: () => {} },
      } as any,
    );

    const output = { output: "请修复这个错误" } as any;
    await hooks["tool.execute.after"]?.({ tool: "Bash", args: {} } as any, output);

    expect(output.output).toContain("Please fix this error.");
    expect(output.output).toContain("Chinese text was automatically translated to English.");
    expect(output.output).not.toContain("请修复这个错误");
  });

  test("tool.execute.after preserves Chinese output with warning when translator unavailable", async () => {
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

    const output = { output: "请修复这个错误" } as any;
    await hooks["tool.execute.after"]?.({ tool: "Bash", args: {} } as any, output);

    expect(output.output).toContain("请修复这个错误");
    expect(output.output).toContain("Chinese text was detected, but automatic translation failed. Original output preserved.");
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test tests/unit/plugin-integration.test.ts --test-name-pattern "Chinese"
```

Expected: FAIL because plugin hook does not translate Chinese output yet.

- [ ] **Step 3: Add translator adapter in plugin entry**

In `src/plugin/index.ts`, import:

```ts
import { buildChineseTranslationPrompt, filterChineseOutput, type ChineseTranslator } from "./lib/chinese-output-filter.js";
```

Add helpers above `const jcePlugin`:

```ts
function extractTranslationText(result: unknown): string | undefined {
  if (typeof result === "string") return result;
  if (!isRecord(result)) return undefined;
  for (const key of ["text", "content", "message", "output"] as const) {
    const value = result[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function buildChineseTranslator(client: any): ChineseTranslator | undefined {
  if (!client?.session?.create || !client?.session?.chat) return undefined;
  return async (text: string) => {
    const session = await client.session.create({});
    const result = await client.session.chat({
      sessionID: session.id,
      message: buildChineseTranslationPrompt(text),
    });
    const translated = extractTranslationText(result);
    if (!translated) throw new Error("Translation returned no text");
    return translated;
  };
}
```

Inside `jcePlugin`, after `const { client } = input;`:

```ts
  const chineseTranslator = buildChineseTranslator(client);
```

Pass it into collect tool:

```ts
      bg_collect: buildCollectTool(manager, client, persistCurrentMemory, chineseTranslator),
```

At the end of `tool.execute.after`, after verification warning handling, add:

```ts
      if (typeof output.output === "string" && input.tool !== "Write" && input.tool !== "Edit") {
        output.output = await filterChineseOutput(output.output, chineseTranslator);
      }
```

- [ ] **Step 4: Run integration tests**

Run:

```bash
bun test tests/unit/plugin-integration.test.ts --test-name-pattern "Chinese"
```

Expected: PASS with Chinese output integration tests.

## Task 4: Full Verification and Diff Review

**Files:**
- No code edits expected unless verification fails.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun test tests/unit/plugin-chinese-output-filter.test.ts tests/unit/plugin-tools.test.ts tests/unit/plugin-integration.test.ts
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
git diff -- src/plugin/lib/chinese-output-filter.ts src/plugin/tools/dispatch.ts src/plugin/index.ts tests/unit/plugin-chinese-output-filter.test.ts tests/unit/plugin-tools.test.ts tests/unit/plugin-integration.test.ts docs/superpowers/specs/2026-05-08-chinese-output-auto-translation-design.md docs/superpowers/plans/2026-05-08-chinese-output-auto-translation.md
```

Expected: Diff contains only Chinese output filter, bg_collect integration, plugin hook integration, tests, and approved spec/plan docs.

- [ ] **Step 4: Commit only if user explicitly asks**

If user explicitly requests commit/push, stage only relevant files:

```bash
git add src/plugin/lib/chinese-output-filter.ts src/plugin/tools/dispatch.ts src/plugin/index.ts tests/unit/plugin-chinese-output-filter.test.ts tests/unit/plugin-tools.test.ts tests/unit/plugin-integration.test.ts docs/superpowers/specs/2026-05-08-chinese-output-auto-translation-design.md docs/superpowers/plans/2026-05-08-chinese-output-auto-translation.md
git commit -m "feat(plugin): auto-translate Chinese output"
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

- Spec coverage: detection, replacement mode, fallback warning, bg_collect integration, tool.execute.after integration, no user prompt, and tests are covered.
- Placeholder scan: no `TBD`, `TODO`, unresolved placeholders, or missing code snippets.
- Type consistency: `ChineseTranslator`, `filterChineseOutput`, `containsChinese`, and `buildChineseTranslationPrompt` names match across tasks.
- Scope check: no external API key, no source-code translation, no commit/push automation.
