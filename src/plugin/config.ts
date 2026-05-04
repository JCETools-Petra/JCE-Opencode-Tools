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
