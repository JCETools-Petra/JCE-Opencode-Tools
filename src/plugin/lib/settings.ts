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
