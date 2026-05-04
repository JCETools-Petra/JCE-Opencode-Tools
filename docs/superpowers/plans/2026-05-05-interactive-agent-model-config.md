# Interactive Agent Model Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive `opencode-jce plugin configure` flow so users can choose per-agent models for Sisyphus/JCE plugin agents or let each agent follow the active OpenCode model.

**Architecture:** Store JCE plugin preferences in `~/.config/opencode/jce-plugin.json` with nullable per-agent model values. The plugin reads this file while injecting agents: valid `provider/model` values become `agent.model`; missing/null/invalid values omit `model`, allowing OpenCode to use the active user-selected model.

**Tech Stack:** TypeScript, Bun tests, Commander.js CLI, existing OpenCode `opencode.json` provider config.

---

## File Structure

- Create `src/plugin/lib/settings.ts`: load/save JCE plugin settings, list available OpenCode models, validate model IDs, and apply settings to agent configs.
- Modify `src/plugin/config.ts`: build base agent configs and apply settings before returning them.
- Modify `src/commands/plugin.ts`: add `plugin models` and `plugin configure` subcommands.
- Modify `tests/unit/plugin-settings.test.ts`: cover settings parsing, validation, and application.
- Modify `tests/unit/plugin-agents.test.ts`: ensure model omission follows active model when configured as null.
- Modify `tests/unit/plugin-command.test.ts` if needed, or add command source assertions to `tests/unit/audit-fixes.test.ts` if existing command tests do not exist.

---

### Task 1: Plugin Settings Library

**Files:**
- Create: `src/plugin/lib/settings.ts`
- Create: `tests/unit/plugin-settings.test.ts`

- [ ] **Step 1: Write failing tests for settings load/save and model listing**

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  AGENT_IDS,
  getJcePluginSettingsPath,
  loadJcePluginSettings,
  saveJcePluginSettings,
  listAvailableModels,
  isModelAvailable,
} from "../../src/plugin/lib/settings.ts";

const originalXdg = process.env.XDG_CONFIG_HOME;

function tempConfigDir(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `opencode-jce-${name}-`));
  const configDir = join(root, "opencode");
  mkdirSync(configDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = root;
  return configDir;
}

afterEach(() => {
  if (process.env.XDG_CONFIG_HOME?.includes("opencode-jce-")) {
    rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
  }
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;
});

describe("plugin settings", () => {
  test("loads empty settings when jce-plugin.json does not exist", () => {
    tempConfigDir("missing-settings");
    expect(loadJcePluginSettings()).toEqual({ agents: {} });
  });

  test("saves nullable per-agent model settings", async () => {
    const configDir = tempConfigDir("save-settings");
    await saveJcePluginSettings({ agents: { sisyphus: null, frontend: "enowxlabs/gpt-5.5" } });
    const saved = JSON.parse(readFileSync(join(configDir, "jce-plugin.json"), "utf-8"));
    expect(saved.agents.sisyphus).toBeNull();
    expect(saved.agents.frontend).toBe("enowxlabs/gpt-5.5");
  });

  test("lists provider/model strings from opencode.json", () => {
    const configDir = tempConfigDir("models");
    writeFileSync(join(configDir, "opencode.json"), JSON.stringify({
      provider: {
        enowxlabs: { models: { "gpt-5.5": {}, "gpt-5.4": {} } },
        openrouter: { models: { "anthropic/claude-sonnet": {} } },
      },
    }), "utf-8");
    expect(listAvailableModels()).toEqual([
      "enowxlabs/gpt-5.5",
      "enowxlabs/gpt-5.4",
      "openrouter/anthropic/claude-sonnet",
    ]);
  });

  test("validates model strings against available OpenCode provider models", () => {
    const configDir = tempConfigDir("validate");
    writeFileSync(join(configDir, "opencode.json"), JSON.stringify({
      provider: { enowxlabs: { models: { "gpt-5.5": {} } } },
    }), "utf-8");
    expect(isModelAvailable("enowxlabs/gpt-5.5")).toBe(true);
    expect(isModelAvailable("openai/gpt-4o-mini")).toBe(false);
  });

  test("exports the five JCE agent IDs", () => {
    expect(AGENT_IDS).toEqual(["sisyphus", "oracle", "librarian", "explorer", "frontend"]);
    expect(getJcePluginSettingsPath()).toContain("jce-plugin.json");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test tests/unit/plugin-settings.test.ts`

Expected: FAIL because `src/plugin/lib/settings.ts` does not exist.

- [ ] **Step 3: Implement settings library**

```typescript
import { existsSync, mkdirSync, readFileSync } from "fs";
import { writeFile } from "fs/promises";
import { dirname, join } from "path";
import { getConfigDir } from "../../lib/config.js";

export const AGENT_IDS = ["sisyphus", "oracle", "librarian", "explorer", "frontend"] as const;
export type JceAgentId = typeof AGENT_IDS[number];
export type AgentModelPreference = string | null;

export interface JcePluginSettings {
  agents: Partial<Record<JceAgentId, AgentModelPreference>>;
}

interface OpenCodeConfig {
  provider?: Record<string, { models?: Record<string, unknown> }>;
}

export function getJcePluginSettingsPath(): string {
  return join(getConfigDir(), "jce-plugin.json");
}

function readJsonFile<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function loadJcePluginSettings(): JcePluginSettings {
  const settings = readJsonFile<JcePluginSettings>(getJcePluginSettingsPath());
  if (!settings || typeof settings !== "object" || !settings.agents || typeof settings.agents !== "object") {
    return { agents: {} };
  }

  const agents: JcePluginSettings["agents"] = {};
  for (const agent of AGENT_IDS) {
    const value = settings.agents[agent];
    if (value === null || typeof value === "string") agents[agent] = value;
  }
  return { agents };
}

export async function saveJcePluginSettings(settings: JcePluginSettings): Promise<void> {
  const path = getJcePluginSettingsPath();
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

export function listAvailableModels(): string[] {
  const config = readJsonFile<OpenCodeConfig>(join(getConfigDir(), "opencode.json"));
  const result: string[] = [];
  for (const [providerID, provider] of Object.entries(config?.provider ?? {})) {
    for (const modelID of Object.keys(provider.models ?? {})) {
      result.push(`${providerID}/${modelID}`);
    }
  }
  return result;
}

export function isModelAvailable(model: string): boolean {
  return listAvailableModels().includes(model);
}

export function applyJcePluginSettings<T extends { model?: string }>(
  agents: Record<JceAgentId, T>,
  settings = loadJcePluginSettings(),
): Record<JceAgentId, T> {
  for (const agent of AGENT_IDS) {
    const preference = settings.agents[agent];
    if (typeof preference === "string" && isModelAvailable(preference)) {
      agents[agent].model = preference;
    } else {
      delete agents[agent].model;
    }
  }
  return agents;
}
```

- [ ] **Step 4: Run settings tests to verify GREEN**

Run: `bun test tests/unit/plugin-settings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/plugin/lib/settings.ts tests/unit/plugin-settings.test.ts
git commit -m "feat(plugin): add JCE agent model settings library"
```

---

### Task 2: Apply Settings During Plugin Agent Injection

**Files:**
- Modify: `src/plugin/config.ts`
- Modify: `src/plugin/agents/*.ts`
- Modify: `tests/unit/plugin-agents.test.ts`
- Modify: `tests/unit/plugin-integration.test.ts`

- [ ] **Step 1: Write failing tests for active-model fallback and configured-model override**

Update `tests/unit/plugin-agents.test.ts`:

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { buildAgentConfigs } from "../../src/plugin/config.ts";

const originalXdg = process.env.XDG_CONFIG_HOME;

function tempConfigDir(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `opencode-jce-agents-${name}-`));
  const configDir = join(root, "opencode");
  mkdirSync(configDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = root;
  return configDir;
}

function writeProviderConfig(configDir: string): void {
  writeFileSync(join(configDir, "opencode.json"), JSON.stringify({
    provider: { enowxlabs: { models: { "gpt-5.5": {}, "gpt-5.4": {} } } },
  }), "utf-8");
}

afterEach(() => {
  if (process.env.XDG_CONFIG_HOME?.includes("opencode-jce-agents-")) {
    rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
  }
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;
});

describe("plugin agents", () => {
  test("builds 5 agent configs with correct IDs", () => {
    const agents = buildAgentConfigs();
    const ids = Object.keys(agents);
    expect(ids).toContain("sisyphus");
    expect(ids).toContain("oracle");
    expect(ids).toContain("librarian");
    expect(ids).toContain("explorer");
    expect(ids).toContain("frontend");
    expect(ids).toHaveLength(5);
  });

  test("sisyphus agent has boulder/todo system prompt", () => {
    const agents = buildAgentConfigs();
    expect(agents.sisyphus.systemPrompt).toContain("todo");
    expect(agents.sisyphus.systemPrompt).toContain("boulder");
    expect(agents.sisyphus.systemPrompt).toContain("Sisyphus");
  });

  test("agents omit model by default so OpenCode uses the active user model", () => {
    const configDir = tempConfigDir("default-active");
    writeProviderConfig(configDir);
    const agents = buildAgentConfigs();
    for (const agent of Object.values(agents)) {
      expect(agent.model).toBeUndefined();
    }
  });

  test("agents apply valid per-agent model preferences", () => {
    const configDir = tempConfigDir("override");
    writeProviderConfig(configDir);
    writeFileSync(join(configDir, "jce-plugin.json"), JSON.stringify({
      agents: { sisyphus: "enowxlabs/gpt-5.5", frontend: "enowxlabs/gpt-5.4" },
    }), "utf-8");
    const agents = buildAgentConfigs();
    expect(agents.sisyphus.model).toBe("enowxlabs/gpt-5.5");
    expect(agents.frontend.model).toBe("enowxlabs/gpt-5.4");
    expect(agents.oracle.model).toBeUndefined();
  });

  test("invalid per-agent model preferences are ignored", () => {
    const configDir = tempConfigDir("invalid");
    writeProviderConfig(configDir);
    writeFileSync(join(configDir, "jce-plugin.json"), JSON.stringify({
      agents: { sisyphus: "openai/gpt-4o-mini" },
    }), "utf-8");
    const agents = buildAgentConfigs();
    expect(agents.sisyphus.model).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test tests/unit/plugin-agents.test.ts`

Expected: FAIL because agents still force model strings from the profile resolver.

- [ ] **Step 3: Remove hardcoded resolver use from agent builders**

Update every file in `src/plugin/agents/` so each builder returns only system prompt and optional metadata. Example for `src/plugin/agents/sisyphus.ts`:

```typescript
export function buildSisyphusAgent() {
  return {
    systemPrompt: `You are Sisyphus — the relentless agent. Like the mythological figure condemned to roll a boulder uphill for eternity, you NEVER stop until the task is complete.

## Core Rules
1. You have a todo list. You MUST complete every item before stopping.
2. If you feel like stopping early, that is the boulder rolling back. Push harder.
3. Break complex tasks into subtasks. Delegate to specialized agents when appropriate.
4. Use background agents for parallel work — you are the orchestrator.
5. Never leave code with excessive comments. Code should speak for itself.
6. Commit frequently. Small, atomic commits.

## Delegation
- Architecture/debugging problems → dispatch to oracle
- Documentation/library research → dispatch to librarian
- Fast codebase exploration → dispatch to explorer
- Frontend/UI work → dispatch to frontend

## The Boulder Rule
When your todo list has incomplete items and you are about to stop:
STOP. You are NOT done. Keep bouldering.`,
  };
}
```

Repeat the same model-removal pattern for:
- `src/plugin/agents/oracle.ts`
- `src/plugin/agents/librarian.ts`
- `src/plugin/agents/explorer.ts`
- `src/plugin/agents/frontend.ts`

- [ ] **Step 4: Apply settings in `buildAgentConfigs()`**

```typescript
import { buildSisyphusAgent } from "./agents/sisyphus.js";
import { buildOracleAgent } from "./agents/oracle.js";
import { buildLibrarianAgent } from "./agents/librarian.js";
import { buildExplorerAgent } from "./agents/explorer.js";
import { buildFrontendAgent } from "./agents/frontend.js";
import { applyJcePluginSettings } from "./lib/settings.js";

export interface PluginAgentConfig {
  model?: string;
  systemPrompt: string;
}

export function buildAgentConfigs(): Record<string, PluginAgentConfig> {
  return applyJcePluginSettings({
    sisyphus: buildSisyphusAgent(),
    oracle: buildOracleAgent(),
    librarian: buildLibrarianAgent(),
    explorer: buildExplorerAgent(),
    frontend: buildFrontendAgent(),
  });
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `bun test tests/unit/plugin-agents.test.ts tests/unit/plugin-integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/plugin/config.ts src/plugin/agents tests/unit/plugin-agents.test.ts tests/unit/plugin-integration.test.ts
git commit -m "feat(plugin): let JCE agents follow active model by default"
```

---

### Task 3: Interactive Configure Command

**Files:**
- Modify: `src/commands/plugin.ts`
- Modify: `tests/unit/audit-fixes.test.ts`

- [ ] **Step 1: Write failing source-level command tests**

Add to `tests/unit/audit-fixes.test.ts`:

```typescript
test("plugin command exposes interactive JCE model configuration", () => {
  const source = readFileSync(join(process.cwd(), "src", "commands", "plugin.ts"), "utf-8");

  expect(source).toContain('new Command("configure")');
  expect(source).toContain('new Command("models")');
  expect(source).toContain("listAvailableModels");
  expect(source).toContain("saveJcePluginSettings");
  expect(source).toContain("Use active OpenCode model");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test tests/unit/audit-fixes.test.ts --test-name-pattern "plugin command exposes interactive"`

Expected: FAIL because commands are not implemented.

- [ ] **Step 3: Implement `models` and `configure` commands**

Modify `src/commands/plugin.ts` imports:

```typescript
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import {
  AGENT_IDS,
  getJcePluginSettingsPath,
  listAvailableModels,
  loadJcePluginSettings,
  saveJcePluginSettings,
  type JcePluginSettings,
} from "../plugin/lib/settings.js";
```

Add helper and commands before the main `pluginCommand` export:

```typescript
function printAgentModelSettings(settings: JcePluginSettings, models: string[]): void {
  heading("JCE Plugin Agent Models");
  console.log();
  for (const agent of AGENT_IDS) {
    const value = settings.agents[agent];
    const label = typeof value === "string" && models.includes(value)
      ? value
      : "Use active OpenCode model";
    console.log(`  ${chalk.bold(agent.padEnd(10))} ${label}`);
  }
  console.log();
  info(`Settings file: ${getJcePluginSettingsPath()}`);
}

const modelsCommand = new Command("models")
  .description("Show available OpenCode models and JCE plugin agent model settings")
  .action(async () => {
    logCommandStart("plugin models");
    const models = listAvailableModels();
    const settings = loadJcePluginSettings();
    printAgentModelSettings(settings, models);
    console.log();
    heading("Available Models");
    console.log();
    if (models.length === 0) {
      info("No models found in opencode.json provider config.");
    } else {
      for (const model of models) console.log(`  ${model}`);
    }
    logCommandSuccess("plugin models", `models=${models.length}`);
    process.exit(EXIT_SUCCESS);
  });

const configureCommand = new Command("configure")
  .description("Interactively configure Sisyphus/JCE plugin agent models")
  .action(async () => {
    logCommandStart("plugin configure");
    const models = listAvailableModels();
    if (models.length === 0) {
      error("No models found in opencode.json provider config.");
      error("Run `opencode-jce doctor` to verify your OpenCode provider configuration.");
      logCommandError("plugin configure", "no models available");
      process.exit(EXIT_ERROR);
    }

    const settings = loadJcePluginSettings();
    const choices = ["Use active OpenCode model", ...models];
    const rl = createInterface({ input, output });
    try {
      heading("Configure JCE Plugin Agent Models");
      console.log();
      choices.forEach((choice, index) => console.log(`  ${index + 1}. ${choice}`));
      console.log();

      for (const agent of AGENT_IDS) {
        const current = settings.agents[agent];
        const currentIndex = typeof current === "string" ? models.indexOf(current) + 2 : 1;
        const fallbackIndex = currentIndex > 1 ? currentIndex : 1;
        const answer = await rl.question(`${agent} model? [${fallbackIndex}] `);
        const parsed = answer.trim() === "" ? fallbackIndex : Number(answer.trim());
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > choices.length) {
          error(`Invalid choice for ${agent}: ${answer}`);
          logCommandError("plugin configure", `invalid choice for ${agent}`);
          process.exit(EXIT_ERROR);
        }
        settings.agents[agent] = parsed === 1 ? null : models[parsed - 2];
      }

      await saveJcePluginSettings(settings);
      console.log();
      success(`Saved JCE plugin settings to ${getJcePluginSettingsPath()}`);
      info("Restart OpenCode for agent model changes to apply.");
      logCommandSuccess("plugin configure", "saved settings");
      process.exit(EXIT_SUCCESS);
    } finally {
      rl.close();
    }
  });
```

Add commands to `pluginCommand`:

```typescript
export const pluginCommand = new Command("plugin")
  .description("Manage community plugins and JCE plugin settings")
  .addCommand(installCommand)
  .addCommand(listCommand)
  .addCommand(removeCommand)
  .addCommand(modelsCommand)
  .addCommand(configureCommand);
```

- [ ] **Step 4: Run command test to verify GREEN**

Run: `bun test tests/unit/audit-fixes.test.ts --test-name-pattern "plugin command exposes interactive"`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/commands/plugin.ts tests/unit/audit-fixes.test.ts
git commit -m "feat(plugin): add interactive JCE agent model configuration"
```

---

### Task 4: Verification and Local Install Patch

**Files:**
- Copy updated files into `~/.config/opencode/cli/` after verification so the local machine can use it immediately.

- [ ] **Step 1: Run full verification**

Run:

```bash
bun test
bun run typecheck
bash -n install.sh
pwsh -NoProfile -Command '$ErrorActionPreference="Stop"; [scriptblock]::Create((Get-Content -Raw "install.ps1")) | Out-Null'
```

Expected:
- `bun test`: all tests pass
- `bun run typecheck`: `tsc --noEmit` exits 0
- installer syntax checks exit 0

- [ ] **Step 2: Patch installed CLI copy**

Run:

```bash
cp src/plugin/lib/settings.ts "$HOME/.config/opencode/cli/src/plugin/lib/settings.ts"
cp src/plugin/config.ts "$HOME/.config/opencode/cli/src/plugin/config.ts"
cp src/plugin/agents/*.ts "$HOME/.config/opencode/cli/src/plugin/agents/"
cp src/commands/plugin.ts "$HOME/.config/opencode/cli/src/commands/plugin.ts"
```

- [ ] **Step 3: Verify installed CLI**

Run:

```bash
bun run typecheck
bun run "$HOME/.config/opencode/cli/src/index.ts" plugin models
```

Expected:
- typecheck exits 0
- `plugin models` prints all five JCE agents and available models from local `opencode.json`

- [ ] **Step 4: Commit any remaining files if not already committed**

```bash
git status --short
```

Expected: clean except `.opencode-context.md` if context was updated. Commit context if changed:

```bash
git add .opencode-context.md
git commit -m "docs(context): record JCE plugin model configuration flow"
```

- [ ] **Step 5: Push**

```bash
git push origin main
```

Expected: push succeeds.

---

## Self-Review

- Spec coverage: Covers interactive configure command, model listing, nullable active-model behavior, per-agent overrides, invalid model safety, local installed CLI patch.
- Placeholder scan: No TBD/TODO/placeholders remain.
- Type consistency: `JcePluginSettings`, `JceAgentId`, `AGENT_IDS`, and `model?: string` are consistently used across tasks.
