import { join } from "path";
import { homedir, platform } from "os";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

/**
 * Returns the cross-platform config directory for OpenCode Suite.
 * - Linux/macOS: $XDG_CONFIG_HOME/opencode or ~/.config/opencode
 * - Windows: %APPDATA%\opencode
 */
export function getConfigDir(): string {
  const os = platform();

  if (os === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return join(appData, "opencode");
    }
    return join(homedir(), "AppData", "Roaming", "opencode");
  }

  // Linux / macOS
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return join(xdgConfig, "opencode");
  }
  return join(homedir(), ".config", "opencode");
}

/**
 * Check if a config file exists at the given path relative to config dir.
 */
export function configFileExists(relativePath: string): boolean {
  const fullPath = join(getConfigDir(), relativePath);
  return existsSync(fullPath);
}

/**
 * Load and parse a JSON config file from the config directory.
 * Returns the parsed object or throws with a user-friendly message.
 */
export async function loadConfigFile<T>(relativePath: string): Promise<T> {
  const fullPath = join(getConfigDir(), relativePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Config file not found: ${fullPath}`);
  }

  const content = await readFile(fullPath, "utf-8");

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Invalid JSON in: ${fullPath}`);
  }
}

/**
 * Get the full path to a config file.
 */
export function getConfigPath(relativePath: string): string {
  return join(getConfigDir(), relativePath);
}
