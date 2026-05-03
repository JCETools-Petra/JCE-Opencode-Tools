import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";

import { buildDefaultOpenCodeJson } from "../../src/lib/opencode-json-template.js";
import { compareVersions } from "../../src/lib/version.js";
import { checkProviderHealth, loadFallbackConfig } from "../../src/lib/fallback.js";
import { loadPromptTemplate } from "../../src/lib/prompts.js";
import { MemoryStore } from "../../src/lib/memory.js";
import { TokenTracker } from "../../src/lib/tokens.js";
import { parseGitHubPluginUrl } from "../../src/lib/plugins.js";
import { pruneAndArchiveContext } from "../../src/mcp/context-keeper.js";

const tempRoots: string[] = [];
const originalFetch = globalThis.fetch;
const originalXdgConfig = process.env.XDG_CONFIG_HOME;

function tempDir(name: string): string {
  const dir = join(tmpdir(), `opencode-jce-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalXdgConfig === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = originalXdgConfig;
  }

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("audit fixes", () => {
  test("OpenCode template uses npx-backed MCP commands that work after fresh install", () => {
    const config = buildDefaultOpenCodeJson("/tmp/opencode") as { mcp: Record<string, { command?: string[]; env?: Record<string, string> }> };

    expect(Object.keys(config.mcp).sort()).toEqual([
      "context-keeper",
      "context7",
      "filesystem",
      "github-search",
      "memory",
      "playwright",
      "postgres",
      "sequential-thinking",
      "web-fetch",
    ]);
    expect(config.mcp["sequential-thinking"].command).toEqual(["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"]);
    expect(config.mcp.playwright.command).toEqual(["npx", "-y", "@playwright/mcp@0.0.28"]);
    expect(config.mcp["github-search"].command).toEqual(["npx", "-y", "@modelcontextprotocol/server-github"]);
    expect(config.mcp.memory.command).toEqual(["npx", "-y", "@modelcontextprotocol/server-memory"]);
    expect(config.mcp["context-keeper"].env?.PROJECT_ROOT).toBe("${PROJECT_ROOT}");
  });

  test("compareVersions handles prerelease and build metadata predictably", () => {
    expect(compareVersions("1.8.9-beta.1", "1.8.8")).toBe(1);
    expect(compareVersions("1.8.9-beta.1", "1.8.9")).toBe(-1);
    expect(compareVersions("1.8.9-beta.10", "1.8.9-beta.2")).toBe(1);
    expect(compareVersions("1.8.9+build.5", "1.8.9")).toBe(0);
  });

  test("fallback health treats authentication failures as unhealthy", async () => {
    process.env.TEST_PROVIDER_KEY = "secret";
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    const health = await checkProviderHealth({
      name: "test",
      apiKeyEnv: "TEST_PROVIDER_KEY",
      healthEndpoint: "https://api.openai.com/v1/models",
      priority: 1,
    });

    expect(health.healthy).toBe(false);
    expect(health.reason).toContain("Authentication failed");
  });

  test("fallback health treats rate limits as degraded instead of healthy", async () => {
    process.env.TEST_PROVIDER_KEY = "secret";
    globalThis.fetch = (async () => new Response(null, { status: 429 })) as unknown as typeof fetch;

    const health = await checkProviderHealth({
      name: "test",
      apiKeyEnv: "TEST_PROVIDER_KEY",
      healthEndpoint: "https://api.openai.com/v1/models",
      priority: 1,
    });

    expect(health.healthy).toBe(false);
    expect(health.reason).toContain("Rate limited");
  });

  test("fallback config rejects custom endpoints that would receive bearer tokens", async () => {
    const root = tempDir("fallback");
    writeFileSync(join(root, "fallback.json"), JSON.stringify({
      providers: [{
        name: "openai",
        apiKeyEnv: "OPENAI_API_KEY",
        healthEndpoint: "https://evil.example.test/steal",
        priority: 1,
      }],
      maxRetries: 3,
      timeoutMs: 5000,
    }));

    await expect(loadFallbackConfig(root)).rejects.toThrow("Untrusted fallback healthEndpoint");
  });

  test("prompt templates cannot escape to sibling directories with the same prefix", async () => {
    const xdg = tempDir("prompts");
    const configDir = join(xdg, "opencode");
    mkdirSync(join(configDir, "prompts"), { recursive: true });
    mkdirSync(join(configDir, "prompts2"), { recursive: true });
    writeFileSync(join(configDir, "opencode.json"), "{}\n");
    writeFileSync(join(configDir, "prompts2", "secret.txt"), "secret");
    process.env.XDG_CONFIG_HOME = xdg;

    await expect(loadPromptTemplate("../prompts2/secret")).rejects.toThrow("Invalid template name");
  });

  test("invalid memory categories fail instead of silently becoming context", () => {
    const root = tempDir("memory");
    const store = new MemoryStore(root, root);

    expect(() => store.set("key", "value", "typo")).toThrow("Invalid memory category");
    expect(() => store.list("typo")).toThrow("Invalid memory category");
  });

  test("TokenTracker exposes true all-time entries", () => {
    const root = tempDir("tokens");
    const dbPath = join(root, "opencode.db");
    const db = new Database(dbPath);
    db.run("CREATE TABLE session (id TEXT)");
    db.run("CREATE TABLE message (time_created INTEGER, data TEXT)");
    db.run("INSERT INTO session (id) VALUES ('s1')");
    db.run(
      "INSERT INTO message (time_created, data) VALUES (?, ?)", [
      new Date("2020-01-01T00:00:00.000Z").getTime(),
      JSON.stringify({ providerID: "openai", modelID: "gpt", tokens: { input: 1, output: 2 }, cost: 0.01 }),
      ]
    );
    db.close();

    const tracker = new TokenTracker(dbPath);
    expect(tracker.getAll()).toHaveLength(1);
  });

  test("plugin GitHub URL parser rejects dot-dot repos and non-GitHub hosts", () => {
    expect(parseGitHubPluginUrl("https://github.com/user/repo.git")).toEqual({ owner: "user", repo: "repo" });
    expect(parseGitHubPluginUrl("https://github.com/user/..")).toBeNull();
    expect(parseGitHubPluginUrl("https://evil.example/user/repo")).toBeNull();
  });

  test("context pruning can archive oversized files during session start", () => {
    const content = `# Project Context
> Auto-maintained by AI.
> Last updated: 2026-05-04

## Stack
- TypeScript

## Architecture Decisions
${Array.from({ length: 20 }, (_, i) => `- Decision ${i + 1}`).join("\n")}

## Conventions
- Rule

## Current Status
- [x] Finished
- [ ] Pending

## Important Notes
${Array.from({ length: 20 }, (_, i) => `- Note ${i + 1}`).join("\n")}
`;

    const result = pruneAndArchiveContext(content, "2026-05-04");

    expect(result.content).not.toContain("- [x] Finished");
    expect(result.content).toContain("Archived entries: see .opencode-context-archive.md");
    expect(result.archiveAppend).toContain("Decision 1");
    expect(result.archiveAppend).toContain("Note 1");
  });
});
