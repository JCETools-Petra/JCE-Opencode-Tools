import { Command } from "commander";
import { existsSync } from "fs";
import { join } from "path";
import { cp, rm, mkdir } from "fs/promises";
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

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/JoshuaWink/opencode-suite/main";

interface RemotePackageJson {
  version: string;
}

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
 * Fetch a config file from GitHub and return its content.
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
 * Deploy updated config files from GitHub to the local config directory.
 */
async function deployUpdatedConfigs(): Promise<number> {
  const configDir = getConfigDir();
  let updatedCount = 0;

  // List of config files to update
  const configFiles = [
    "agents.json",
    "mcp.json",
    "lsp.json",
  ];

  // Profile files to update
  const profileFiles = [
    "profiles/budget.json",
    "profiles/codex-5.3.json",
    "profiles/hybrid-hemat.json",
    "profiles/local.json",
    "profiles/opus-latest.json",
    "profiles/quality.json",
    "profiles/sonnet-4.6.json",
    "profiles/speed.json",
  ];

  const allFiles = [...configFiles, ...profileFiles];

  for (const file of allFiles) {
    const content = await fetchRemoteFile(file);
    if (content) {
      const targetPath = join(configDir, file);
      const targetDir = join(targetPath, "..");

      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
      }

      await Bun.write(targetPath, content);
      updatedCount++;
    }
  }

  return updatedCount;
}

export const updateCommand = new Command("update")
  .description("Check for updates and pull latest configuration from GitHub")
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
      info("Forcing re-deployment of config files...");
    }

    // Check-only mode
    if (options.check) {
      if (comparison > 0) {
        info("Run `opencode-suite update` to apply the update.");
      }
      logCommandSuccess("update", `check complete, latest=${latestVersion}`);
      process.exit(EXIT_SUCCESS);
    }

    // Apply update
    console.log();
    heading("Applying Update");

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

    // Deploy updated configs
    info("Downloading latest configuration files...");
    const updatedCount = await deployUpdatedConfigs();

    if (updatedCount === 0) {
      error("No config files could be downloaded. Update may have failed.");
      logCommandError("update", "No files downloaded");
      process.exit(EXIT_ERROR);
    }

    success(`Updated ${updatedCount} configuration files.`);

    // Run migrations if version changed
    if (comparison > 0) {
      info("Running migrations...");
      const migrationsRun = await runMigrations(latestVersion);
      if (migrationsRun > 0) {
        success(`Ran ${migrationsRun} migration(s).`);
      } else {
        info("No migrations needed.");
      }

      // Update version file
      await updateVersion(latestVersion);
    }

    // Summary
    console.log();
    heading("Update Complete");
    success(`Version: ${localVersion} → ${latestVersion || localVersion}`);
    success(`Config files updated: ${updatedCount}`);
    info("Run `opencode-suite doctor` to verify your installation.");

    logCommandSuccess("update", `updated to ${latestVersion}, ${updatedCount} files`);
    process.exit(EXIT_SUCCESS);
  });
