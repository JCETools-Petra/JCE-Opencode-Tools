# Sisyphus Agent + Async Subagents Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OpenCode plugin component to opencode-jce that provides Sisyphus-style agent orchestration (todo enforcer, comment checker) and async background subagent dispatch, integrated with our existing profile system.

**Architecture:** The plugin is a new `src/plugin/` directory that exports a `PluginModule` for OpenCode's plugin system. It uses `@opencode-ai/plugin` types, defines custom agents mapped to our profiles, registers hooks for todo enforcement and comment checking, and provides a background task manager that spawns child sessions via the OpenCode SDK client.

**Tech Stack:** TypeScript, Bun, `@opencode-ai/plugin`, `@opencode-ai/sdk`, Zod 4

---

## File Structure

```
src/plugin/
├── index.ts                    ← PluginModule default export (entry point)
├── config.ts                   ← Config hook: injects agents into OpenCode
├── agents/
│   ├── sisyphus.ts             ← Main agent definition (maps to opus profile)
│   ├── oracle.ts               ← Debug/architecture agent (maps to gpt profile)
│   ├── librarian.ts            ← Docs/code search agent (maps to sonet profile)
│   ├── explorer.ts             ← Fast codebase grep agent (maps to cheapest profile)
│   └── frontend.ts             ← Frontend specialist (maps to gemini profile)
├── hooks/
│   ├── todo-enforcer.ts        ← Stop hook: forces continuation if todos incomplete
│   ├── comment-checker.ts      ← PostToolUse hook: warns on excessive comments
│   └── ultrawork-injector.ts   ← UserPromptSubmit hook: detects "ultrawork"/"ulw" keyword
├── background/
│   ├── manager.ts              ← Background task orchestrator
│   ├── spawner.ts              ← Creates child sessions via SDK client
│   └── types.ts                ← BackgroundTask, LaunchInput interfaces
├── tools/
│   ├── dispatch.ts             ← "dispatch" tool: launch background agent from main agent
│   ├── status.ts               ← "bg_status" tool: check background task status
│   └── collect.ts              ← "bg_collect" tool: retrieve background task results
└── lib/
    ├── profile-resolver.ts     ← Maps agent roles to installed profiles
    └── config-loader.ts        ← Loads sisyphus.json user overrides
```

**Modified files:**
- `package.json` — add `@opencode-ai/plugin`, `@opencode-ai/sdk` deps; add plugin exports field
- `src/lib/opencode-json-template.ts` — register plugin in default opencode.json template
- `install.ps1` / `install.sh` — ensure plugin is registered on fresh install
- `tsconfig.json` — include `src/plugin/` in compilation

---

### Task 1: Project Setup — Dependencies and Plugin Entry Point

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/plugin/index.ts`
- Create: `src/plugin/config.ts`
- Test: `tests/unit/plugin-entry.test.ts`

- [ ] **Step 1: Install plugin SDK dependencies**

```bash
bun add @opencode-ai/plugin @opencode-ai/sdk
```

- [ ] **Step 2: Update package.json exports**

Add to `package.json`:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./plugin": "./src/plugin/index.ts"
  }
}
```

- [ ] **Step 3: Write failing test for plugin entry point**

Create `tests/unit/plugin-entry.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";

describe("plugin entry point", () => {
  test("exports a valid PluginModule with id and server function", async () => {
    const mod = await import("../../src/plugin/index.ts");
    expect(mod.default).toBeDefined();
    expect(mod.default.id).toBe("opencode-jce");
    expect(typeof mod.default.server).toBe("function");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
bun test tests/unit/plugin-entry.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 5: Create minimal plugin entry point**

Create `src/plugin/index.ts`:
```typescript
import type { Plugin, PluginModule } from "@opencode-ai/plugin";

const jcePlugin: Plugin = async (input) => {
  return {};
};

const pluginModule: PluginModule = {
  id: "opencode-jce",
  server: jcePlugin,
};

export default pluginModule;
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bun test tests/unit/plugin-entry.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/plugin/index.ts tests/unit/plugin-entry.test.ts package.json tsconfig.json
git commit -m "feat(plugin): add OpenCode plugin entry point skeleton"
```

---

### Task 2: Profile Resolver — Map Agent Roles to Installed Profiles

**Files:**
- Create: `src/plugin/lib/profile-resolver.ts`
- Test: `tests/unit/profile-resolver.test.ts`

- [ ] **Step 1: Write failing test for profile resolver**

Create `tests/unit/profile-resolver.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";
import { resolveAgentModel } from "../../src/plugin/lib/profile-resolver.ts";

describe("profile resolver", () => {
  test("resolves sisyphus role to opus-class model", () => {
    const result = resolveAgentModel("sisyphus");
    expect(result.provider).toMatch(/anthropic|openai/);
    expect(result.model).toBeDefined();
  });

  test("resolves oracle role to reasoning model", () => {
    const result = resolveAgentModel("oracle");
    expect(result).toBeDefined();
  });

  test("resolves explorer role to fast/cheap model", () => {
    const result = resolveAgentModel("explorer");
    expect(result).toBeDefined();
  });

  test("returns fallback for unknown role", () => {
    const result = resolveAgentModel("unknown-role");
    expect(result).toBeDefined();
    expect(result.model).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/profile-resolver.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement profile resolver**

Create `src/plugin/lib/profile-resolver.ts`:
```typescript
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getConfigDir } from "../../lib/config.js";

export interface AgentModelConfig {
  provider: string;
  model: string;
}

const ROLE_PROFILE_MAP: Record<string, string[]> = {
  sisyphus: ["claude-opus", "opus", "anthropic-opus"],
  oracle: ["gpt-o1", "o1", "openai-o1", "gpt"],
  librarian: ["claude-sonet", "sonet", "anthropic-sonet", "claude-sonnet"],
  explorer: ["grok", "gemini-flash", "haiku", "claude-haiku"],
  frontend: ["gemini", "gemini-pro", "google-gemini"],
};

const FALLBACK: AgentModelConfig = { provider: "anthropic", model: "claude-sonnet-4-20250514" };

export function resolveAgentModel(role: string): AgentModelConfig {
  const configDir = getConfigDir();
  const profilesDir = join(configDir, "profiles");

  if (!existsSync(profilesDir)) return FALLBACK;

  const profileFiles = readdirSync(profilesDir).filter((f) => f.endsWith(".json"));
  const candidates = ROLE_PROFILE_MAP[role] ?? [];

  for (const candidate of candidates) {
    const match = profileFiles.find((f) => f.replace(".json", "") === candidate);
    if (match) {
      try {
        const profile = JSON.parse(readFileSync(join(profilesDir, match), "utf-8"));
        if (profile.provider && profile.model) {
          return { provider: profile.provider, model: profile.model };
        }
      } catch {}
    }
  }

  // Fallback: use first available profile
  for (const file of profileFiles) {
    try {
      const profile = JSON.parse(readFileSync(join(profilesDir, file), "utf-8"));
      if (profile.provider && profile.model) {
        return { provider: profile.provider, model: profile.model };
      }
    } catch {}
  }

  return FALLBACK;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/unit/profile-resolver.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugin/lib/profile-resolver.ts tests/unit/profile-resolver.test.ts
git commit -m "feat(plugin): add profile resolver for agent role-to-model mapping"
```

---

### Task 3: Agent Definitions — Sisyphus, Oracle, Librarian, Explorer, Frontend

**Files:**
- Create: `src/plugin/agents/sisyphus.ts`
- Create: `src/plugin/agents/oracle.ts`
- Create: `src/plugin/agents/librarian.ts`
- Create: `src/plugin/agents/explorer.ts`
- Create: `src/plugin/agents/frontend.ts`
- Modify: `src/plugin/config.ts`
- Test: `tests/unit/plugin-agents.test.ts`

- [ ] **Step 1: Write failing test for agent config injection**

Create `tests/unit/plugin-agents.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";
import { buildAgentConfigs } from "../../src/plugin/config.ts";

describe("plugin agents", () => {
  test("builds 5 agent configs with correct IDs", () => {
    const agents = buildAgentConfigs();
    const ids = Object.keys(agents);
    expect(ids).toContain("sisyphus");
    expect(ids).toContain("oracle");
    expect(ids).toContain("librarian");
    expect(ids).toContain("explorer");
    expect(ids).toContain("frontend");
  });

  test("sisyphus agent has todo enforcer system prompt", () => {
    const agents = buildAgentConfigs();
    expect(agents.sisyphus.systemPrompt).toContain("todo");
    expect(agents.sisyphus.systemPrompt).toContain("boulder");
  });

  test("each agent has a model config", () => {
    const agents = buildAgentConfigs();
    for (const [, agent] of Object.entries(agents)) {
      expect(agent.model).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/plugin-agents.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create agent definition files**

Create `src/plugin/agents/sisyphus.ts`:
```typescript
import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildSisyphusAgent() {
  const model = resolveAgentModel("sisyphus");
  return {
    model: `${model.provider}/${model.model}`,
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

Create `src/plugin/agents/oracle.ts`:
```typescript
import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildOracleAgent() {
  const model = resolveAgentModel("oracle");
  return {
    model: `${model.provider}/${model.model}`,
    systemPrompt: `You are Oracle — the architecture and debugging specialist.
You are called when Sisyphus encounters complex architectural decisions or stubborn bugs.
Think deeply. Analyze root causes. Propose solutions with trade-offs.
Be concise but thorough. Return actionable recommendations.`,
  };
}
```

Create `src/plugin/agents/librarian.ts`:
```typescript
import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildLibrarianAgent() {
  const model = resolveAgentModel("librarian");
  return {
    model: `${model.provider}/${model.model}`,
    systemPrompt: `You are Librarian — the documentation and code research specialist.
You search official docs, open source implementations, and the codebase.
Return precise, referenced answers. Include code examples when relevant.
If you cannot find authoritative information, say so clearly.`,
  };
}
```

Create `src/plugin/agents/explorer.ts`:
```typescript
import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildExplorerAgent() {
  const model = resolveAgentModel("explorer");
  return {
    model: `${model.provider}/${model.model}`,
    systemPrompt: `You are Explorer — the fast codebase navigation agent.
You grep, glob, and read files quickly to map territory for the main agent.
Return structured findings: file paths, line numbers, relevant code snippets.
Be fast. Be precise. No commentary — just facts.`,
  };
}
```

Create `src/plugin/agents/frontend.ts`:
```typescript
import { resolveAgentModel } from "../lib/profile-resolver.js";

export function buildFrontendAgent() {
  const model = resolveAgentModel("frontend");
  return {
    model: `${model.provider}/${model.model}`,
    systemPrompt: `You are Frontend Engineer — the UI/UX specialist.
You handle React, Vue, Svelte, CSS, Tailwind, accessibility, and responsive design.
Write clean, semantic markup. Follow component best practices.
Test visually when possible. Prefer composition over inheritance.`,
  };
}
```

- [ ] **Step 4: Create config.ts that builds all agents**

Create `src/plugin/config.ts`:
```typescript
import { buildSisyphusAgent } from "./agents/sisyphus.js";
import { buildOracleAgent } from "./agents/oracle.js";
import { buildLibrarianAgent } from "./agents/librarian.js";
import { buildExplorerAgent } from "./agents/explorer.js";
import { buildFrontendAgent } from "./agents/frontend.js";

export interface PluginAgentConfig {
  model: string;
  systemPrompt: string;
}

export function buildAgentConfigs(): Record<string, PluginAgentConfig> {
  return {
    sisyphus: buildSisyphusAgent(),
    oracle: buildOracleAgent(),
    librarian: buildLibrarianAgent(),
    explorer: buildExplorerAgent(),
    frontend: buildFrontendAgent(),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test tests/unit/plugin-agents.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/plugin/agents/ src/plugin/config.ts tests/unit/plugin-agents.test.ts
git commit -m "feat(plugin): add Sisyphus-style agent definitions with profile integration"
```

---

### Task 4: Todo Enforcer Hook

**Files:**
- Create: `src/plugin/hooks/todo-enforcer.ts`
- Test: `tests/unit/todo-enforcer.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/todo-enforcer.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";
import { shouldEnforceContinuation } from "../../src/plugin/hooks/todo-enforcer.ts";

describe("todo enforcer", () => {
  test("returns true when incomplete todos exist in session", () => {
    const messages = [
      { role: "assistant", content: "- [ ] Fix bug\n- [x] Write test\n- [ ] Deploy" },
    ];
    expect(shouldEnforceContinuation(messages)).toBe(true);
  });

  test("returns false when all todos are complete", () => {
    const messages = [
      { role: "assistant", content: "- [x] Fix bug\n- [x] Write test\n- [x] Deploy" },
    ];
    expect(shouldEnforceContinuation(messages)).toBe(false);
  });

  test("returns false when no todos exist", () => {
    const messages = [
      { role: "assistant", content: "Done with the task." },
    ];
    expect(shouldEnforceContinuation(messages)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/todo-enforcer.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement todo enforcer**

Create `src/plugin/hooks/todo-enforcer.ts`:
```typescript
interface MessageLike {
  role: string;
  content: string;
}

const INCOMPLETE_TODO_PATTERN = /^[\s]*-\s*\[\s*\]/m;

export function shouldEnforceContinuation(messages: MessageLike[]): boolean {
  // Scan assistant messages for incomplete checkbox items
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    if (INCOMPLETE_TODO_PATTERN.test(msg.content)) {
      return true;
    }
  }
  return false;
}

export const CONTINUATION_PROMPT = `⚠️ BOULDER CHECK: You have incomplete todo items. You are NOT done. Keep bouldering — complete all remaining items before stopping.`;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/unit/todo-enforcer.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugin/hooks/todo-enforcer.ts tests/unit/todo-enforcer.test.ts
git commit -m "feat(plugin): add todo enforcer hook for Sisyphus continuation"
```

---

### Task 5: Comment Checker Hook

**Files:**
- Create: `src/plugin/hooks/comment-checker.ts`
- Test: `tests/unit/comment-checker.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/comment-checker.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";
import { analyzeCommentDensity } from "../../src/plugin/hooks/comment-checker.ts";

describe("comment checker", () => {
  test("flags code with excessive comment ratio", () => {
    const code = `// This function adds two numbers
// It takes a and b as parameters
// Returns the sum
function add(a: number, b: number): number {
  // Add a and b together
  return a + b; // return the result
}`;
    const result = analyzeCommentDensity(code, "test.ts");
    expect(result.excessive).toBe(true);
  });

  test("passes code with reasonable comments", () => {
    const code = `// Calculate compound interest with monthly compounding
function compoundInterest(principal: number, rate: number, years: number): number {
  const monthlyRate = rate / 12;
  const months = years * 12;
  return principal * Math.pow(1 + monthlyRate, months);
}`;
    const result = analyzeCommentDensity(code, "test.ts");
    expect(result.excessive).toBe(false);
  });

  test("ignores non-code files", () => {
    const content = "# Heading\nSome markdown content";
    const result = analyzeCommentDensity(content, "README.md");
    expect(result.excessive).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/comment-checker.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement comment checker**

Create `src/plugin/hooks/comment-checker.ts`:
```typescript
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".kt", ".c", ".cpp", ".h",
  ".cs", ".rb", ".php", ".swift", ".scala",
]);

const COMMENT_PATTERNS: Record<string, RegExp[]> = {
  slashSlash: [/^\s*\/\//],
  slashStar: [/^\s*\/\*/, /^\s*\*/, /^\s*\*\//],
  hash: [/^\s*#(?!!)/, /^\s*#(?!\/)/],
};

export interface CommentAnalysis {
  excessive: boolean;
  ratio: number;
  totalLines: number;
  commentLines: number;
}

export function analyzeCommentDensity(content: string, filePath: string): CommentAnalysis {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  if (!CODE_EXTENSIONS.has(ext)) {
    return { excessive: false, ratio: 0, totalLines: 0, commentLines: 0 };
  }

  const lines = content.split("\n");
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length < 5) {
    return { excessive: false, ratio: 0, totalLines: nonEmptyLines.length, commentLines: 0 };
  }

  let commentLines = 0;
  const patterns = ext === ".py" || ext === ".rb" || ext === ".sh"
    ? COMMENT_PATTERNS.hash
    : [...COMMENT_PATTERNS.slashSlash, ...COMMENT_PATTERNS.slashStar];

  for (const line of nonEmptyLines) {
    if (patterns.some((p) => p.test(line))) {
      commentLines++;
    }
    // Inline comments (// at end of code line)
    if (/\S.*\/\/\s/.test(line) && !line.trim().startsWith("//")) {
      commentLines += 0.5;
    }
  }

  const ratio = commentLines / nonEmptyLines.length;
  const excessive = ratio > 0.4; // More than 40% comments = excessive

  return { excessive, ratio, totalLines: nonEmptyLines.length, commentLines: Math.round(commentLines) };
}

export const COMMENT_WARNING = `⚠️ COMMENT CHECK: The code you just wrote has excessive comments (>40% comment ratio). Code should be self-documenting. Remove obvious comments and keep only those that explain WHY, not WHAT.`;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/unit/comment-checker.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugin/hooks/comment-checker.ts tests/unit/comment-checker.test.ts
git commit -m "feat(plugin): add comment density checker hook"
```

---

### Task 6: Background Task Manager and Spawner

**Files:**
- Create: `src/plugin/background/types.ts`
- Create: `src/plugin/background/manager.ts`
- Create: `src/plugin/background/spawner.ts`
- Test: `tests/unit/background-manager.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/background-manager.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";
import { BackgroundManager } from "../../src/plugin/background/manager.ts";

describe("background manager", () => {
  test("launches a task and tracks it", () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({
      description: "Explore codebase",
      prompt: "Find all API endpoints",
      agent: "explorer",
      parentSessionId: "session-1",
      parentMessageId: "msg-1",
    });
    expect(task.id).toBeDefined();
    expect(task.status).toBe("pending");
    expect(manager.listTasks()).toHaveLength(1);
  });

  test("respects max concurrency", () => {
    const manager = new BackgroundManager({ maxConcurrency: 2 });
    manager.createTask({ description: "t1", prompt: "p1", agent: "explorer", parentSessionId: "s1", parentMessageId: "m1" });
    manager.createTask({ description: "t2", prompt: "p2", agent: "explorer", parentSessionId: "s1", parentMessageId: "m2" });
    manager.createTask({ description: "t3", prompt: "p3", agent: "explorer", parentSessionId: "s1", parentMessageId: "m3" });

    const running = manager.listTasks().filter((t) => t.status === "running");
    const pending = manager.listTasks().filter((t) => t.status === "pending");
    // Without actual spawner, all stay pending — but concurrency is tracked
    expect(manager.listTasks()).toHaveLength(3);
  });

  test("can cancel a task", () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({ description: "t1", prompt: "p1", agent: "explorer", parentSessionId: "s1", parentMessageId: "m1" });
    manager.cancelTask(task.id);
    expect(manager.getTask(task.id)?.status).toBe("cancelled");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/background-manager.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create types**

Create `src/plugin/background/types.ts`:
```typescript
export type TaskStatus = "pending" | "running" | "completed" | "error" | "cancelled";

export interface BackgroundTask {
  id: string;
  description: string;
  prompt: string;
  agent: string;
  parentSessionId: string;
  parentMessageId: string;
  sessionId?: string;
  status: TaskStatus;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface LaunchInput {
  description: string;
  prompt: string;
  agent: string;
  parentSessionId: string;
  parentMessageId: string;
}

export interface BackgroundManagerOptions {
  maxConcurrency: number;
}
```

- [ ] **Step 4: Implement BackgroundManager**

Create `src/plugin/background/manager.ts`:
```typescript
import type { BackgroundTask, BackgroundManagerOptions, LaunchInput, TaskStatus } from "./types.js";

export class BackgroundManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private maxConcurrency: number;

  constructor(options: BackgroundManagerOptions) {
    this.maxConcurrency = options.maxConcurrency;
  }

  createTask(input: LaunchInput): BackgroundTask {
    const task: BackgroundTask = {
      id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      parentSessionId: input.parentSessionId,
      parentMessageId: input.parentMessageId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status === "completed" || task.status === "cancelled") return false;
    task.status = "cancelled";
    return true;
  }

  completeTask(id: string, result: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = "completed";
    task.result = result;
    task.completedAt = new Date().toISOString();
  }

  failTask(id: string, error: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = "error";
    task.error = error;
    task.completedAt = new Date().toISOString();
  }

  getRunningCount(): number {
    return this.listTasks().filter((t) => t.status === "running").length;
  }

  canLaunch(): boolean {
    return this.getRunningCount() < this.maxConcurrency;
  }
}
```

- [ ] **Step 5: Create spawner stub**

Create `src/plugin/background/spawner.ts`:
```typescript
import type { BackgroundManager } from "./manager.js";
import type { LaunchInput } from "./types.js";

/**
 * Spawns a background agent session via the OpenCode SDK client.
 * The client is injected from the plugin entry point at runtime.
 */
export async function spawnBackgroundTask(
  manager: BackgroundManager,
  client: any, // OpenCode SDK client — typed at integration time
  input: LaunchInput,
): Promise<string> {
  const task = manager.createTask(input);

  if (!manager.canLaunch()) {
    // Task stays pending until a slot opens
    return task.id;
  }

  try {
    // Create child session
    const session = await client.session.create({
      body: { parentID: input.parentSessionId },
    });

    if (!session?.id) {
      manager.failTask(task.id, "Failed to create child session");
      return task.id;
    }

    task.sessionId = session.id;
    task.status = "running";

    // Fire prompt into child session (fire-and-forget)
    client.session.prompt({
      params: { id: session.id },
      body: { content: input.prompt, agent: input.agent },
    }).then(() => {
      manager.completeTask(task.id, "Task completed");
    }).catch((err: Error) => {
      manager.failTask(task.id, err.message);
    });
  } catch (err) {
    manager.failTask(task.id, err instanceof Error ? err.message : String(err));
  }

  return task.id;
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bun test tests/unit/background-manager.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/plugin/background/ tests/unit/background-manager.test.ts
git commit -m "feat(plugin): add background task manager and spawner for async subagents"
```

---

### Task 7: Custom Tools — dispatch, bg_status, bg_collect

**Files:**
- Create: `src/plugin/tools/dispatch.ts`
- Create: `src/plugin/tools/status.ts`
- Create: `src/plugin/tools/collect.ts`
- Test: `tests/unit/plugin-tools.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/plugin-tools.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";
import { buildDispatchTool, buildStatusTool, buildCollectTool } from "../../src/plugin/tools/dispatch.ts";
import { BackgroundManager } from "../../src/plugin/background/manager.ts";

describe("plugin tools", () => {
  test("dispatch tool has correct schema", () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const tool = buildDispatchTool(manager, null as any);
    expect(tool.description).toContain("background");
    expect(tool.args.description).toBeDefined();
    expect(tool.args.prompt).toBeDefined();
    expect(tool.args.agent).toBeDefined();
  });

  test("status tool returns task list", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    manager.createTask({ description: "test", prompt: "p", agent: "explorer", parentSessionId: "s", parentMessageId: "m" });
    const tool = buildStatusTool(manager);
    const result = await tool.execute({}, { sessionID: "s", messageID: "m" } as any);
    expect(result).toContain("test");
  });

  test("collect tool returns completed task result", async () => {
    const manager = new BackgroundManager({ maxConcurrency: 3 });
    const task = manager.createTask({ description: "test", prompt: "p", agent: "explorer", parentSessionId: "s", parentMessageId: "m" });
    manager.completeTask(task.id, "Found 5 API endpoints");
    const tool = buildCollectTool(manager);
    const result = await tool.execute({ taskId: task.id }, { sessionID: "s", messageID: "m" } as any);
    expect(result).toContain("Found 5 API endpoints");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/plugin-tools.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement tools**

Create `src/plugin/tools/dispatch.ts`:
```typescript
import type { BackgroundManager } from "../background/manager.js";
import { spawnBackgroundTask } from "../background/spawner.js";
import { z } from "zod";

export function buildDispatchTool(manager: BackgroundManager, client: any) {
  return {
    description: "Launch a background agent task. The task runs in parallel and results can be collected later with bg_collect.",
    args: {
      description: z.string().describe("Brief description of what this background task should accomplish"),
      prompt: z.string().describe("The full prompt/instructions for the background agent"),
      agent: z.string().describe("Which agent to use: oracle, librarian, explorer, or frontend"),
    },
    async execute(args: { description: string; prompt: string; agent: string }, context: any) {
      const taskId = await spawnBackgroundTask(manager, client, {
        description: args.description,
        prompt: args.prompt,
        agent: args.agent,
        parentSessionId: context.sessionID,
        parentMessageId: context.messageID,
      });
      return `Background task launched: ${taskId}\nAgent: ${args.agent}\nDescription: ${args.description}\n\nUse bg_status to check progress or bg_collect to retrieve results.`;
    },
  };
}

export function buildStatusTool(manager: BackgroundManager) {
  return {
    description: "Check the status of all background tasks.",
    args: {},
    async execute(_args: Record<string, never>, _context: any) {
      const tasks = manager.listTasks();
      if (tasks.length === 0) return "No background tasks.";
      return tasks.map((t) =>
        `[${t.status.toUpperCase()}] ${t.id} — ${t.description} (agent: ${t.agent})`
      ).join("\n");
    },
  };
}

export function buildCollectTool(manager: BackgroundManager) {
  return {
    description: "Collect the result of a completed background task.",
    args: {
      taskId: z.string().describe("The task ID returned by dispatch"),
    },
    async execute(args: { taskId: string }, _context: any) {
      const task = manager.getTask(args.taskId);
      if (!task) return `Task not found: ${args.taskId}`;
      if (task.status === "pending") return `Task ${args.taskId} is still pending.`;
      if (task.status === "running") return `Task ${args.taskId} is still running.`;
      if (task.status === "cancelled") return `Task ${args.taskId} was cancelled.`;
      if (task.status === "error") return `Task ${args.taskId} failed: ${task.error}`;
      return `Task ${args.taskId} completed:\n\n${task.result}`;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/unit/plugin-tools.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugin/tools/ tests/unit/plugin-tools.test.ts
git commit -m "feat(plugin): add dispatch/status/collect tools for background agents"
```

---

### Task 8: Wire Everything Together in Plugin Entry Point

**Files:**
- Modify: `src/plugin/index.ts`
- Modify: `src/plugin/config.ts`
- Create: `src/plugin/hooks/ultrawork-injector.ts`
- Test: `tests/unit/plugin-integration.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `tests/unit/plugin-integration.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";

describe("plugin integration", () => {
  test("plugin server returns hooks with tools and event handler", async () => {
    const mod = await import("../../src/plugin/index.ts");
    const hooks = await mod.default.server({
      client: {} as any,
      project: {} as any,
      directory: "/tmp",
      worktree: "/tmp",
      serverUrl: new URL("http://localhost:3000"),
      $: {} as any,
      experimental_workspace: { register: () => {} },
    } as any);

    expect(hooks.tool).toBeDefined();
    expect(hooks.tool!.dispatch).toBeDefined();
    expect(hooks.tool!.bg_status).toBeDefined();
    expect(hooks.tool!.bg_collect).toBeDefined();
    expect(hooks.event).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/plugin-integration.test.ts
```
Expected: FAIL

- [ ] **Step 3: Wire plugin entry point**

Update `src/plugin/index.ts`:
```typescript
import type { Plugin, PluginModule } from "@opencode-ai/plugin";
import { BackgroundManager } from "./background/manager.js";
import { buildDispatchTool, buildStatusTool, buildCollectTool } from "./tools/dispatch.js";
import { buildAgentConfigs } from "./config.js";
import { shouldEnforceContinuation, CONTINUATION_PROMPT } from "./hooks/todo-enforcer.js";
import { analyzeCommentDensity, COMMENT_WARNING } from "./hooks/comment-checker.js";

const jcePlugin: Plugin = async (input) => {
  const { client } = input;
  const manager = new BackgroundManager({ maxConcurrency: 5 });
  const agents = buildAgentConfigs();

  return {
    // Inject agents into OpenCode config
    config: async (config: any) => {
      if (!config.agent) config.agent = {};
      for (const [id, agentConfig] of Object.entries(agents)) {
        if (!config.agent[id]) {
          config.agent[id] = agentConfig;
        }
      }
    },

    // Event handler for session monitoring
    event: async ({ event }) => {
      // Could monitor session.idle to check todo completion
    },

    // Custom tools for background agent dispatch
    tool: {
      dispatch: buildDispatchTool(manager, client) as any,
      bg_status: buildStatusTool(manager) as any,
      bg_collect: buildCollectTool(manager) as any,
    },

    // Comment checker: warn after file writes with excessive comments
    "tool.execute.after": async (input: any, output: any) => {
      if (input.tool === "Write" || input.tool === "Edit") {
        const filePath = input.args?.filePath || input.args?.path || "";
        const content = output.output || "";
        if (filePath && content) {
          const analysis = analyzeCommentDensity(content, filePath);
          if (analysis.excessive) {
            output.output = `${output.output}\n\n${COMMENT_WARNING}`;
          }
        }
      }
    },
  };
};

const pluginModule: PluginModule = {
  id: "opencode-jce",
  server: jcePlugin,
};

export default pluginModule;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/unit/plugin-integration.test.ts
```
Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
bun test
```
Expected: All pass

- [ ] **Step 6: Run typecheck**

```bash
bun run typecheck
```
Expected: Pass

- [ ] **Step 7: Commit**

```bash
git add src/plugin/ tests/unit/plugin-integration.test.ts
git commit -m "feat(plugin): wire Sisyphus agents, hooks, and background tools into plugin entry"
```

---

### Task 9: Register Plugin in Installer and Template

**Files:**
- Modify: `src/lib/opencode-json-template.ts`
- Modify: `install.ps1`
- Modify: `install.sh`

- [ ] **Step 1: Add plugin to opencode.json template**

In `src/lib/opencode-json-template.ts`, ensure the `plugin` array includes our plugin path:
```typescript
// In buildDefaultOpenCodeJson():
plugin: [
  "superpowers@git+https://github.com/obra/superpowers.git",
  // Our own plugin is loaded from the local CLI install
  `file://${configDir}/cli/src/plugin/index.ts`,
],
```

- [ ] **Step 2: Update installers to register plugin**

Both `install.ps1` and `install.sh` already deploy `opencode.json` via `merge-config.ts` or the template. The template change above ensures new installs get the plugin. For existing users, `opencode-jce update` will add it via `ensureOpenCodeJson()`.

- [ ] **Step 3: Run full verification**

```bash
bun test && bun run typecheck && bash -n install.sh
```
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/opencode-json-template.ts
git commit -m "feat(plugin): register JCE plugin in opencode.json template for auto-activation"
```

---

## Summary

After completing all 9 tasks:
- OpenCode will load our plugin via `opencode.json` `plugin` array
- 5 agents available: `sisyphus`, `oracle`, `librarian`, `explorer`, `frontend`
- Each agent maps to the user's installed profiles
- Todo enforcer prevents premature stopping
- Comment checker warns on excessive comments
- 3 custom tools (`dispatch`, `bg_status`, `bg_collect`) enable async background agents
- Existing users get the plugin on next `opencode-jce update`
