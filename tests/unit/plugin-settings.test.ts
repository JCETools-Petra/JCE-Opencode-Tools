import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getConfigDir } from "../../src/lib/config.ts";
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
  writeFileSync(join(configDir, "opencode.json"), JSON.stringify({}), "utf-8");
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
    const configDir = tempConfigDir("missing-settings");
    expect(getConfigDir()).toBe(configDir);
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
