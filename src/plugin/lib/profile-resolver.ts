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
