import { join } from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

// ─── Types ───────────────────────────────────────────────────

export interface ProviderConfig {
  name: string;
  apiKeyEnv: string;
  healthEndpoint: string;
  priority: number;
}

export interface FallbackConfig {
  providers: ProviderConfig[];
  maxRetries: number;
  timeoutMs: number;
}

export interface ProviderHealthResult {
  provider: ProviderConfig;
  healthy: boolean;
  reason?: string;
}

// ─── Config Loading ──────────────────────────────────────────

/**
 * Load fallback configuration from the given config directory.
 * Falls back to bundled config/fallback.json if not found in user config.
 */
export async function loadFallbackConfig(configDir: string): Promise<FallbackConfig> {
  const userPath = join(configDir, "fallback.json");

  if (existsSync(userPath)) {
    const content = await readFile(userPath, "utf-8");
    try {
      return JSON.parse(content) as FallbackConfig;
    } catch {
      throw new Error(`Failed to parse ${userPath}: invalid JSON`);
    }
  }

  // Fallback to bundled config (relative to project root)
  const bundledPath = join(import.meta.dir, "../../config/fallback.json");
  if (existsSync(bundledPath)) {
    const content = await readFile(bundledPath, "utf-8");
    try {
      return JSON.parse(content) as FallbackConfig;
    } catch {
      throw new Error(`Failed to parse ${bundledPath}: invalid JSON`);
    }
  }

  // Default config if nothing found
  return {
    providers: [
      {
        name: "anthropic",
        apiKeyEnv: "ANTHROPIC_API_KEY",
        healthEndpoint: "https://api.anthropic.com/v1/messages",
        priority: 1,
      },
      {
        name: "openai",
        apiKeyEnv: "OPENAI_API_KEY",
        healthEndpoint: "https://api.openai.com/v1/models",
        priority: 2,
      },
    ],
    maxRetries: 3,
    timeoutMs: 5000,
  };
}

// ─── Health Checks ───────────────────────────────────────────

/**
 * Check if a provider's API key is set in the environment.
 */
export function hasApiKey(provider: ProviderConfig): boolean {
  const key = process.env[provider.apiKeyEnv];
  return !!key && key.length > 0;
}

/**
 * Check if a provider is available (API key set + endpoint reachable).
 */
export async function checkProviderHealth(
  provider: ProviderConfig,
  timeoutMs: number = 5000
): Promise<ProviderHealthResult> {
  // First check: API key must be set
  if (!hasApiKey(provider)) {
    return {
      provider,
      healthy: false,
      reason: `API key not set (${provider.apiKeyEnv})`,
    };
  }

  // Second check: endpoint reachable (HEAD request with timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(provider.healthEndpoint, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env[provider.apiKeyEnv]}`,
      },
    });

    clearTimeout(timeout);

    // 401/403 means the endpoint is reachable (auth issue is separate)
    // 429 means rate limited but reachable
    // 2xx/4xx = reachable, 5xx = unhealthy
    const reachable = response.status < 500;

    return {
      provider,
      healthy: reachable,
      reason: reachable ? undefined : `Endpoint returned ${response.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      provider,
      healthy: false,
      reason: `Endpoint unreachable: ${message}`,
    };
  }
}

/**
 * Get ordered list of available providers (skip unavailable ones).
 * Sorted by priority (lower number = higher priority).
 */
export async function getAvailableProviders(config: FallbackConfig): Promise<ProviderConfig[]> {
  const sorted = [...config.providers].sort((a, b) => a.priority - b.priority);
  const results = await Promise.all(
    sorted.map((provider) => checkProviderHealth(provider, config.timeoutMs))
  );

  return results.filter((r) => r.healthy).map((r) => r.provider);
}

/**
 * Get the best available provider (first healthy one by priority).
 * Returns null if no providers are available.
 */
export async function getBestProvider(config: FallbackConfig): Promise<ProviderConfig | null> {
  const available = await getAvailableProviders(config);
  return available.length > 0 ? available[0] : null;
}
