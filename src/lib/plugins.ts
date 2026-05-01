import { join, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { getConfigDir } from "./config.js";

// ─── Types ───────────────────────────────────────────────────

export interface PluginManifest {
  name: string;
  version: string;
  type: "mcp" | "agent" | "prompt";
  description: string;
  config: Record<string, unknown>;
}

export interface InstalledPlugin {
  name: string;
  version: string;
  type: "mcp" | "agent" | "prompt";
  description: string;
  source: string; // GitHub URL
  installedAt: string;
}

export interface PluginsRegistry {
  plugins: InstalledPlugin[];
}

// ─── Paths ───────────────────────────────────────────────────

/**
 * Get the path to the plugins registry file.
 */
export function getPluginsPath(): string {
  return join(getConfigDir(), "plugins.json");
}

/**
 * Get the path to the plugins install directory.
 */
export function getPluginsDir(): string {
  return join(getConfigDir(), "plugins");
}

// ─── Registry Operations ─────────────────────────────────────

/**
 * Load the plugins registry.
 */
export async function loadPluginsRegistry(): Promise<InstalledPlugin[]> {
  const registryPath = getPluginsPath();

  if (!existsSync(registryPath)) {
    return [];
  }

  const content = await readFile(registryPath, "utf-8");
  const registry: PluginsRegistry = JSON.parse(content);
  return registry.plugins || [];
}

/**
 * Save the plugins registry.
 */
export async function savePluginsRegistry(plugins: InstalledPlugin[]): Promise<void> {
  const registryPath = getPluginsPath();
  const dir = dirname(registryPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const registry: PluginsRegistry = { plugins };
  await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf-8");
}

// ─── Plugin Operations ───────────────────────────────────────

/**
 * Install a plugin from a GitHub URL.
 * Clones the repo, reads plugin.json, and registers it.
 */
export async function installPlugin(githubUrl: string): Promise<{ success: boolean; plugin?: InstalledPlugin; error?: string }> {
  const pluginsDir = getPluginsDir();

  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
  }

  // Extract repo name from URL
  const repoName = extractRepoName(githubUrl);
  if (!repoName) {
    return { success: false, error: "Invalid GitHub URL. Expected format: https://github.com/user/repo" };
  }

  const pluginDir = join(pluginsDir, repoName);

  // Check if already installed
  const existing = await loadPluginsRegistry();
  if (existing.some((p) => p.name === repoName || p.source === githubUrl)) {
    return { success: false, error: `Plugin "${repoName}" is already installed.` };
  }

  // Clone the repository
  try {
    if (existsSync(pluginDir)) {
      // Remove existing directory
      execSync(`rm -rf "${pluginDir}"`, { stdio: "pipe" });
    }
    execSync(`git clone --depth 1 "${githubUrl}" "${pluginDir}"`, { stdio: "pipe" });
  } catch (err: any) {
    return { success: false, error: `Failed to clone repository: ${err.message}` };
  }

  // Read plugin.json
  const manifestPath = join(pluginDir, "plugin.json");
  if (!existsSync(manifestPath)) {
    // Cleanup
    try { execSync(`rm -rf "${pluginDir}"`, { stdio: "pipe" }); } catch {}
    return { success: false, error: "Repository does not contain a plugin.json manifest." };
  }

  let manifest: PluginManifest;
  try {
    const content = await readFile(manifestPath, "utf-8");
    manifest = JSON.parse(content);
  } catch {
    try { execSync(`rm -rf "${pluginDir}"`, { stdio: "pipe" }); } catch {}
    return { success: false, error: "Invalid plugin.json — could not parse manifest." };
  }

  // Validate manifest
  if (!manifest.name || !manifest.version || !manifest.type) {
    try { execSync(`rm -rf "${pluginDir}"`, { stdio: "pipe" }); } catch {}
    return { success: false, error: "plugin.json is missing required fields (name, version, type)." };
  }

  // Register the plugin
  const plugin: InstalledPlugin = {
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    description: manifest.description || "",
    source: githubUrl,
    installedAt: new Date().toISOString(),
  };

  existing.push(plugin);
  await savePluginsRegistry(existing);

  return { success: true, plugin };
}

/**
 * Remove an installed plugin by name.
 */
export async function removePlugin(name: string): Promise<{ success: boolean; error?: string }> {
  const plugins = await loadPluginsRegistry();
  const index = plugins.findIndex((p) => p.name === name);

  if (index === -1) {
    return { success: false, error: `Plugin "${name}" is not installed.` };
  }

  // Remove the plugin directory
  const pluginDir = join(getPluginsDir(), name);
  if (existsSync(pluginDir)) {
    try {
      execSync(`rm -rf "${pluginDir}"`, { stdio: "pipe" });
    } catch {
      // Non-fatal — registry will still be updated
    }
  }

  plugins.splice(index, 1);
  await savePluginsRegistry(plugins);

  return { success: true };
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Extract the repository name from a GitHub URL.
 */
function extractRepoName(url: string): string | null {
  // Handle: https://github.com/user/repo or https://github.com/user/repo.git
  const match = url.match(/github\.com\/[\w.-]+\/([\w.-]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}
