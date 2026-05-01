import { join, dirname } from "path";
import { homedir, platform } from "os";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";

/**
 * Returns the cross-platform config directory for OpenCode JCE.
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

/**
 * Get the path to OpenCode's own opencode.json config file.
 * OpenCode reads from ~/.config/opencode/opencode.json (all platforms).
 */
export function getOpenCodeConfigPath(): string {
  const os = platform();
  const home = homedir();

  // OpenCode always uses ~/.config/opencode/opencode.json
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return join(xdgConfig, "opencode", "opencode.json");
  }

  if (os === "win32") {
    // On Windows, OpenCode uses ~/.config/opencode/ (not %APPDATA%)
    return join(home, ".config", "opencode", "opencode.json");
  }

  return join(home, ".config", "opencode", "opencode.json");
}

/**
 * Load OpenCode's opencode.json config.
 */
export async function loadOpenCodeConfig(): Promise<Record<string, any>> {
  const configPath = getOpenCodeConfigPath();

  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) ?? {};
  } catch (err: any) {
    if (err.code === "ENOENT") return {};
    throw new Error(`Invalid JSON in OpenCode config: ${configPath}`);
  }
}

/**
 * Save OpenCode's opencode.json config (preserving existing keys).
 */
export async function saveOpenCodeConfig(config: Record<string, any>): Promise<void> {
  const configPath = getOpenCodeConfigPath();
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

// ─── LSP Config Mapping ─────────────────────────────────────

/**
 * OpenCode LSP format:
 * {
 *   "lsp": {
 *     "server-name": {
 *       "command": ["cmd", "--args"],
 *       "extensions": [".ts", ".js"]
 *     }
 *   }
 * }
 */

interface LspServerDef {
  command: string[];
  extensions: string[];
}

/** Map of filetype names to file extensions */
const FILETYPE_TO_EXTENSIONS: Record<string, string[]> = {
  python: [".py", ".pyi"],
  typescript: [".ts", ".tsx"],
  javascript: [".js", ".jsx", ".mjs", ".cjs"],
  typescriptreact: [".tsx"],
  javascriptreact: [".jsx"],
  rust: [".rs"],
  go: [".go"],
  dockerfile: [".dockerfile"],
  sql: [".sql"],
  java: [".java"],
  c: [".c", ".h"],
  cpp: [".cpp", ".cc", ".cxx", ".hpp", ".hh"],
  objc: [".m", ".mm"],
  php: [".php"],
  ruby: [".rb"],
};

/**
 * Convert our lsp.json format to OpenCode's opencode.json lsp format.
 * Only includes servers whose command is found in PATH.
 */
export function buildOpenCodeLspConfig(
  lspJson: { lsp: Record<string, { server: string; command: string; args: string[]; filetypes: string[] }> },
  installedCommands: string[]
): Record<string, LspServerDef> {
  const result: Record<string, LspServerDef> = {};

  for (const [name, entry] of Object.entries(lspJson.lsp)) {
    // Only include if the command is installed
    if (!installedCommands.includes(entry.command)) continue;

    // Build extensions list from filetypes
    const extensions: string[] = [];
    for (const ft of entry.filetypes) {
      const exts = FILETYPE_TO_EXTENSIONS[ft];
      if (exts) {
        for (const ext of exts) {
          if (!extensions.includes(ext)) extensions.push(ext);
        }
      }
    }

    // Build command array
    const command = [entry.command, ...entry.args];

    result[name] = { command, extensions };
  }

  return result;
}

/**
 * Merge LSP servers into OpenCode's opencode.json.
 * Only adds new servers — does not overwrite existing ones.
 * Returns the list of servers that were added.
 */
export async function mergeLspToOpenCodeConfig(
  lspServers: Record<string, LspServerDef>
): Promise<{ added: string[]; skipped: string[] }> {
  const config = await loadOpenCodeConfig();

  if (!config.lsp) {
    config.lsp = {};
  }

  const added: string[] = [];
  const skipped: string[] = [];

  for (const [name, def] of Object.entries(lspServers)) {
    if (config.lsp[name]) {
      skipped.push(name);
    } else {
      config.lsp[name] = def;
      added.push(name);
    }
  }

  if (added.length > 0) {
    await saveOpenCodeConfig(config);
  }

  return { added, skipped };
}
