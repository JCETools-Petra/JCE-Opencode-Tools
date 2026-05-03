import { Command } from "commander";
import { existsSync } from "fs";
import { join } from "path";
import { cp, mkdir, writeFile, readFile } from "fs/promises";
import chalk from "chalk";
import { getConfigDir } from "../lib/config.js";
import { banner, heading, info, success, warn, error } from "../lib/ui.js";
import { logCommandStart, logCommandSuccess, logCommandError } from "../lib/logger.js";
import {
  getVersionInfo,
  initVersionFile,
  updateVersion,
  runMigrations,
  compareVersions,
  CURRENT_CONFIG_VERSION,
} from "../lib/version.js";
import { EXIT_SUCCESS, EXIT_ERROR } from "../types.js";
import { GITHUB_RAW_BASE, GITHUB_REPO, VERSION } from "../lib/constants.js";

// ─── Types ───────────────────────────────────────────────────

interface RemotePackageJson {
  version: string;
}

interface GitHubContentEntry {
  name: string;
  type: string;
  path: string;
}

interface MergeStats {
  agents: number;
  mcpServers: number;
  lspEntries: number;
  profiles: number;
  prompts: number;
  skills: number;
  agentsMdUpdated: boolean;
  fallbackSkipped: boolean;
  fetchFailed: number;
  fetchAttempted: number;
}

// ─── GitHub Fetch Helpers ────────────────────────────────────

/**
 * Fetch the latest version from GitHub.
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${GITHUB_RAW_BASE}/package.json`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as RemotePackageJson;
    return data.version || null;
  } catch {
    return null;
  }
}

/**
 * Fetch a raw file from the config directory on GitHub.
 */
async function fetchRemoteFile(relativePath: string): Promise<string | null> {
  try {
    const url = `${GITHUB_RAW_BASE}/config/${relativePath}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Fetch the list of files in a directory from the GitHub repository.
 * Returns an array of filenames.
 */
async function fetchDirectoryListing(dir: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/config/${dir}`,
      {
        headers: { Accept: "application/vnd.github.v3+json" },
      }
    );
    if (!response.ok) {
      return [];
    }
    const files = (await response.json()) as GitHubContentEntry[];
    return files
      .filter((f) => f.type === "file")
      .map((f) => f.name);
  } catch {
    return [];
  }
}

// ─── Self-Update CLI ─────────────────────────────────────────

/**
 * Update the opencode-jce CLI itself to the latest version.
 * Runs `bun install -g opencode-jce` to pull the latest from npm/GitHub.
 * Returns true if the CLI was updated successfully.
 */
async function selfUpdateCli(latestVersion: string): Promise<boolean> {
  // Check if CLI is already at the latest version
  if (VERSION === latestVersion) {
    info("CLI already at latest version.");
    return true;
  }

  info(`Updating CLI: ${VERSION} → ${latestVersion}...`);

  try {
    const proc = Bun.spawn(
      ["bun", "install", "-g", `github:${GITHUB_REPO}`],
      { stdout: "pipe", stderr: "pipe" }
    );
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      success(`CLI updated to v${latestVersion}.`);
      return true;
    } else {
      const stderr = await new Response(proc.stderr).text();
      warn(`CLI self-update failed (exit ${exitCode}): ${stderr.trim()}`);
      warn("You can update manually: bun install -g opencode-jce");
      return false;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`CLI self-update failed: ${msg}`);
    warn("You can update manually: bun install -g opencode-jce");
    return false;
  }
}

// ─── Local File Helpers ──────────────────────────────────────

/**
 * Read and parse a local JSON file. Returns null if it doesn't exist or can't be parsed.
 */
async function readLocalJson<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON object to a file with pretty formatting.
 */
async function writeJson(filePath: string, data: unknown): Promise<void> {
  const dir = join(filePath, "..");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Write a string to a file, creating parent directories if needed.
 */
async function writeTextFile(filePath: string, content: string): Promise<void> {
  const dir = join(filePath, "..");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, content, "utf-8");
}

// ─── Merge Logic ─────────────────────────────────────────────

/**
 * Merge agents.json: add new agents by ID, skip existing ones.
 * Returns the number of new agents added.
 */
async function mergeAgents(configDir: string): Promise<number> {
  const localPath = join(configDir, "agents.json");
  const remoteContent = await fetchRemoteFile("agents.json");
  if (!remoteContent) return 0;

  let remoteData: { agents: Array<{ id: string; [key: string]: unknown }> };
  try {
    remoteData = JSON.parse(remoteContent);
  } catch {
    return 0;
  }

  if (!remoteData.agents || !Array.isArray(remoteData.agents)) return 0;

  const localData = await readLocalJson<{ agents: Array<{ id: string; [key: string]: unknown }> }>(localPath);
  const localAgents = localData?.agents ?? [];
  const localIds = new Set(localAgents.map((a) => a.id));

  const newAgents = remoteData.agents.filter((a) => !localIds.has(a.id));
  if (newAgents.length === 0 && localAgents.length > 0) return 0;

  const mergedAgents = [...localAgents, ...newAgents];
  await writeJson(localPath, { agents: mergedAgents });
  return newAgents.length;
}

/**
 * Merge mcp.json: add new MCP servers by key, skip existing ones.
 * Returns the number of new servers added.
 */
async function mergeMcpServers(configDir: string): Promise<number> {
  const localPath = join(configDir, "mcp.json");
  const remoteContent = await fetchRemoteFile("mcp.json");
  if (!remoteContent) return 0;

  let remoteData: { mcpServers: Record<string, unknown> };
  try {
    remoteData = JSON.parse(remoteContent);
  } catch {
    return 0;
  }

  if (!remoteData.mcpServers || typeof remoteData.mcpServers !== "object") return 0;

  const localData = await readLocalJson<{ mcpServers: Record<string, unknown> }>(localPath);
  const localServers = localData?.mcpServers ?? {};

  let addedCount = 0;
  const merged = { ...localServers };

  for (const [key, value] of Object.entries(remoteData.mcpServers)) {
    if (!(key in merged)) {
      merged[key] = value;
      addedCount++;
    }
  }

  if (addedCount === 0 && Object.keys(localServers).length > 0) return 0;

  await writeJson(localPath, { mcpServers: merged });
  return addedCount;
}

/**
 * Merge lsp.json: add new LSP entries by key, skip existing ones.
 * Returns the number of new entries added.
 */
async function mergeLspEntries(configDir: string): Promise<number> {
  const localPath = join(configDir, "lsp.json");
  const remoteContent = await fetchRemoteFile("lsp.json");
  if (!remoteContent) return 0;

  let remoteData: { lsp: Record<string, unknown> };
  try {
    remoteData = JSON.parse(remoteContent);
  } catch {
    return 0;
  }

  if (!remoteData.lsp || typeof remoteData.lsp !== "object") return 0;

  const localData = await readLocalJson<{ lsp: Record<string, unknown> }>(localPath);
  const localLsp = localData?.lsp ?? {};

  let addedCount = 0;
  const merged = { ...localLsp };

  for (const [key, value] of Object.entries(remoteData.lsp)) {
    if (!(key in merged)) {
      merged[key] = value;
      addedCount++;
    }
  }

  if (addedCount === 0 && Object.keys(localLsp).length > 0) return 0;

  await writeJson(localPath, { lsp: merged });
  return addedCount;
}

/**
 * Merge a directory: copy new files only, skip existing filenames.
 * Returns the number of new files added.
 */
async function mergeDirectory(configDir: string, dirName: string): Promise<number> {
  const localDir = join(configDir, dirName);
  const remoteFiles = await fetchDirectoryListing(dirName);
  if (remoteFiles.length === 0) return 0;

  if (!existsSync(localDir)) {
    await mkdir(localDir, { recursive: true });
  }

  let addedCount = 0;

  for (const fileName of remoteFiles) {
    const localPath = join(localDir, fileName);
    if (existsSync(localPath)) {
      continue; // Skip existing files
    }

    const content = await fetchRemoteFile(`${dirName}/${fileName}`);
    if (content) {
      await writeTextFile(localPath, content);
      addedCount++;
    }
  }

  return addedCount;
}

/**
 * Handle AGENTS.md: always overwrite (system instruction must be latest).
 * Returns true if updated.
 */
async function updateAgentsMd(configDir: string): Promise<boolean> {
  const content = await fetchRemoteFile("AGENTS.md");
  if (!content) return false;

  const localPath = join(configDir, "AGENTS.md");

  // Preserve user edits: backup before overwriting
  if (existsSync(localPath)) {
    const localContent = await readFile(localPath, "utf-8");
    if (localContent !== content) {
      const backupPath = join(configDir, "AGENTS.md.backup");
      await writeTextFile(backupPath, localContent);
      info("  AGENTS.md changed — backup saved to AGENTS.md.backup");
    }
  }

  await writeTextFile(localPath, content);
  return true;
}

/**
 * Handle fallback.json: skip if already exists (user may have customized).
 * Returns true if the file was written (i.e., it didn't exist before).
 */
async function handleFallback(configDir: string): Promise<boolean> {
  const localPath = join(configDir, "fallback.json");
  if (existsSync(localPath)) {
    return false; // Skip — user may have customized
  }

  const content = await fetchRemoteFile("fallback.json");
  if (!content) return false;

  await writeTextFile(localPath, content);
  return true;
}

/**
 * Ensure OpenCode's primary config exists before migrations register MCP/LSP.
 */
async function ensureOpenCodeJson(configDir: string): Promise<boolean> {
  const localPath = join(configDir, "opencode.json");
  if (existsSync(localPath)) return false;

  await writeJson(localPath, {
    $schema: "https://opencode.ai/config.json",
    mcp: {},
    lsp: {},
  });
  return true;
}

// ─── Main Merge Orchestrator ─────────────────────────────────

/**
 * Perform a merge-based update: fetch remote configs and merge them
 * with local configs, preserving user customizations.
 */
async function mergeUpdatedConfigs(): Promise<MergeStats> {
  const configDir = getConfigDir();

  // Ensure config directory exists
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  const stats: MergeStats = {
    agents: 0,
    mcpServers: 0,
    lspEntries: 0,
    profiles: 0,
    prompts: 0,
    skills: 0,
    agentsMdUpdated: false,
    fallbackSkipped: false,
    fetchFailed: 0,
    fetchAttempted: 0,
  };

  // 1. Merge JSON config files
  info("Ensuring opencode.json...");
  await ensureOpenCodeJson(configDir);

  info("Merging agents.json...");
  stats.fetchAttempted++;
  stats.agents = await mergeAgents(configDir);
  if (stats.agents < 0) { stats.fetchFailed++; stats.agents = 0; }

  info("Merging mcp.json...");
  stats.fetchAttempted++;
  stats.mcpServers = await mergeMcpServers(configDir);
  if (stats.mcpServers < 0) { stats.fetchFailed++; stats.mcpServers = 0; }

  info("Merging lsp.json...");
  stats.fetchAttempted++;
  stats.lspEntries = await mergeLspEntries(configDir);
  if (stats.lspEntries < 0) { stats.fetchFailed++; stats.lspEntries = 0; }

  // 2. Merge directories (only add new files)
  info("Merging profiles/...");
  stats.fetchAttempted++;
  stats.profiles = await mergeDirectory(configDir, "profiles");
  if (stats.profiles < 0) { stats.fetchFailed++; stats.profiles = 0; }

  info("Merging prompts/...");
  stats.fetchAttempted++;
  stats.prompts = await mergeDirectory(configDir, "prompts");
  if (stats.prompts < 0) { stats.fetchFailed++; stats.prompts = 0; }

  info("Merging skills/...");
  stats.fetchAttempted++;
  stats.skills = await mergeDirectory(configDir, "skills");
  if (stats.skills < 0) { stats.fetchFailed++; stats.skills = 0; }

  // 3. AGENTS.md — overwrite only if remote is newer, preserve user edits otherwise
  info("Updating AGENTS.md...");
  stats.fetchAttempted++;
  stats.agentsMdUpdated = await updateAgentsMd(configDir);
  if (!stats.agentsMdUpdated && !existsSync(join(configDir, "AGENTS.md"))) { stats.fetchFailed++; }

  // 4. fallback.json — skip if exists
  info("Checking fallback.json...");
  const fallbackWritten = await handleFallback(configDir);
  stats.fallbackSkipped = !fallbackWritten && existsSync(join(configDir, "fallback.json"));

  return stats;
}

// ─── Report ──────────────────────────────────────────────────

/**
 * Print a human-readable summary of what was merged.
 */
function printMergeReport(stats: MergeStats): void {
  console.log();
  heading("Merge Summary");

  const items: string[] = [];

  if (stats.agents > 0) items.push(`${stats.agents} agent(s)`);
  if (stats.mcpServers > 0) items.push(`${stats.mcpServers} MCP server(s)`);
  if (stats.lspEntries > 0) items.push(`${stats.lspEntries} LSP entry/entries`);
  if (stats.profiles > 0) items.push(`${stats.profiles} profile(s)`);
  if (stats.prompts > 0) items.push(`${stats.prompts} prompt(s)`);
  if (stats.skills > 0) items.push(`${stats.skills} skill(s)`);

  if (items.length > 0) {
    success(`Added: ${items.join(", ")}`);
  } else {
    info("No new items to add — your config already has everything.");
  }

  if (stats.agentsMdUpdated) {
    success("AGENTS.md updated to latest version.");
  }

  if (stats.fallbackSkipped) {
    info("fallback.json skipped (local copy preserved).");
  }
}

// ─── Command ─────────────────────────────────────────────────

export const updateCommand = new Command("update")
  .description("Update CLI and merge latest configuration from GitHub")
  .option("--check", "Only check for updates without applying them")
  .option("--force", "Force update even if already on latest version")
  .action(async (options: { check?: boolean; force?: boolean }) => {
    logCommandStart("update", options);
    banner();
    heading("Update Check");

    // Ensure version file exists
    await initVersionFile();
    const versionInfo = await getVersionInfo();
    const localVersion = versionInfo?.version || CURRENT_CONFIG_VERSION;

    info(`Current local version: ${chalk.bold(localVersion)}`);

    // Fetch latest version from GitHub
    info("Checking for updates...");
    const latestVersion = await fetchLatestVersion();

    if (!latestVersion) {
      error("Could not reach GitHub to check for updates.");
      error("Check your internet connection and try again.");
      logCommandError("update", "Failed to fetch latest version from GitHub");
      process.exit(EXIT_ERROR);
    }

    info(`Latest remote version: ${chalk.bold(latestVersion)}`);
    console.log();

    const comparison = compareVersions(latestVersion, localVersion);

    if (comparison <= 0 && !options.force) {
      success("You are already on the latest version!");
      logCommandSuccess("update", "already up to date");
      process.exit(EXIT_SUCCESS);
    }

    if (comparison > 0) {
      info(`${chalk.yellow("Update available:")} ${localVersion} → ${latestVersion}`);
    } else if (options.force) {
      info("Forcing merge of remote config files...");
    }

    // Check-only mode
    if (options.check) {
      if (comparison > 0) {
        info("Run `opencode-jce update` to apply the update.");
      }
      logCommandSuccess("update", `check complete, latest=${latestVersion}`);
      process.exit(EXIT_SUCCESS);
    }

    // Step 1: Self-update CLI
    console.log();
    heading("Step 1: Update CLI");
    await selfUpdateCli(latestVersion);

    // Step 2: Merge config files
    console.log();
    heading("Step 2: Merge Configuration");

    // Backup current config
    const configDir = getConfigDir();
    if (existsSync(configDir)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const backupDir = `${configDir}.update-backup.${timestamp}`;
      info(`Backing up current config to: ${backupDir}`);
      try {
        await cp(configDir, backupDir, { recursive: true });
        success("Backup created.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`Backup failed: ${msg} — continuing anyway.`);
      }
    }

    // Merge remote configs into local
    info("Downloading and merging latest configuration...");
    const stats = await mergeUpdatedConfigs();

    // Check if anything was actually fetched
    const totalChanges =
      stats.agents +
      stats.mcpServers +
      stats.lspEntries +
      stats.profiles +
      stats.prompts +
      stats.skills +
      (stats.agentsMdUpdated ? 1 : 0);

    if (totalChanges === 0 && stats.fetchFailed > 0) {
      warn(`${stats.fetchFailed}/${stats.fetchAttempted} fetch(es) failed. Update may have failed.`);
      warn("Check your internet connection or try again later.");
      logCommandError("update", `${stats.fetchFailed} fetches failed during merge`);
      process.exit(EXIT_ERROR);
    }

    // Print merge report
    printMergeReport(stats);

    // Run migrations if version changed
    if (comparison > 0) {
      console.log();
      info("Running migrations...");
      const migrationsRun = await runMigrations(latestVersion);
      if (migrationsRun > 0) {
        success(`Ran ${migrationsRun} migration(s).`);
      } else {
        info("No migrations needed.");
        // runMigrations already calls updateVersion internally,
        // but if no migrations ran, we still need to update the version file
        await updateVersion(latestVersion);
      }
    }

    // Final summary
    console.log();
    heading("Update Complete");
    success(`Version: ${localVersion} → ${latestVersion || localVersion}`);
    info("Your existing customizations have been preserved.");
    info("Run `opencode-jce doctor` to verify your installation.");

    logCommandSuccess("update", `merged to ${latestVersion}, added ${totalChanges} item(s)`);
    process.exit(EXIT_SUCCESS);
  });
