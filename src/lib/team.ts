import { join } from "path";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { getConfigDir } from "./config.js";

export interface TeamConfig {
  repoUrl: string;
  lastSync: string;
  branch: string;
}

const TEAM_CONFIG_FILE = "team.json";

/**
 * Get the path to the team config file.
 */
export function getTeamConfigPath(): string {
  return join(getConfigDir(), TEAM_CONFIG_FILE);
}

/**
 * Load team config. Returns null if not initialized.
 */
export async function loadTeamConfig(): Promise<TeamConfig | null> {
  const configPath = getTeamConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  const content = await readFile(configPath, "utf-8");
  return JSON.parse(content) as TeamConfig;
}

/**
 * Save team config.
 */
export async function saveTeamConfig(config: TeamConfig): Promise<void> {
  const configPath = getTeamConfigPath();
  const configDir = getConfigDir();

  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Initialize team sync with a Git repository URL.
 */
export async function initTeamSync(
  repoUrl: string,
  branch: string = "main"
): Promise<{ success: boolean; error?: string }> {
  try {
    const config: TeamConfig = {
      repoUrl,
      lastSync: new Date().toISOString(),
      branch,
    };

    await saveTeamConfig(config);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Push current config to the team repository.
 */
export async function pushTeamConfig(): Promise<{ success: boolean; error?: string }> {
  const teamConfig = await loadTeamConfig();

  if (!teamConfig) {
    return { success: false, error: "Team sync not initialized. Run: opencode-jce team init <git-url>" };
  }

  const configDir = getConfigDir();
  const tempDir = join(configDir, ".team-sync");

  try {
    // Clone or pull the team repo
    const proc = Bun.spawn(["git", "clone", "--depth", "1", "--branch", teamConfig.branch, teamConfig.repoUrl, tempDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;

    if (proc.exitCode !== 0) {
      // Try pulling if already exists
      if (existsSync(tempDir)) {
        const pullProc = Bun.spawn(["git", "pull", "origin", teamConfig.branch], {
          cwd: tempDir,
          stdout: "pipe",
          stderr: "pipe",
        });
        await pullProc.exited;
      } else {
        const stderr = await new Response(proc.stderr).text();
        return { success: false, error: `Failed to clone team repo: ${stderr}` };
      }
    }

    // Copy config files to the team repo
    const filesToSync = ["agents.json", "mcp.json", "lsp.json"];
    for (const file of filesToSync) {
      const srcPath = join(configDir, file);
      if (existsSync(srcPath)) {
        const content = await readFile(srcPath, "utf-8");
        await writeFile(join(tempDir, file), content, "utf-8");
      }
    }

    // Copy profiles
    const profilesDir = join(configDir, "profiles");
    const tempProfilesDir = join(tempDir, "profiles");
    if (existsSync(profilesDir)) {
      if (!existsSync(tempProfilesDir)) {
        await mkdir(tempProfilesDir, { recursive: true });
      }
      const { readdirSync } = await import("fs");
      const profiles = readdirSync(profilesDir).filter((f) => f.endsWith(".json"));
      for (const profile of profiles) {
        const content = await readFile(join(profilesDir, profile), "utf-8");
        await writeFile(join(tempProfilesDir, profile), content, "utf-8");
      }
    }

    // Git add, commit, push
    const addProc = Bun.spawn(["git", "add", "."], { cwd: tempDir, stdout: "pipe", stderr: "pipe" });
    await addProc.exited;

    const commitProc = Bun.spawn(["git", "commit", "-m", `sync: update config from ${new Date().toISOString()}`], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await commitProc.exited;

    if (commitProc.exitCode !== 0) {
      // No changes to commit
      await cleanup(tempDir);
      return { success: true };
    }

    const pushProc = Bun.spawn(["git", "push", "origin", teamConfig.branch], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await pushProc.exited;

    if (pushProc.exitCode !== 0) {
      const stderr = await new Response(pushProc.stderr).text();
      await cleanup(tempDir);
      return { success: false, error: `Failed to push: ${stderr}` };
    }

    // Update last sync time
    teamConfig.lastSync = new Date().toISOString();
    await saveTeamConfig(teamConfig);

    await cleanup(tempDir);
    return { success: true };
  } catch (err: any) {
    await cleanup(tempDir);
    return { success: false, error: err.message };
  }
}

/**
 * Pull latest config from the team repository.
 */
export async function pullTeamConfig(): Promise<{ success: boolean; error?: string }> {
  const teamConfig = await loadTeamConfig();

  if (!teamConfig) {
    return { success: false, error: "Team sync not initialized. Run: opencode-jce team init <git-url>" };
  }

  const configDir = getConfigDir();
  const tempDir = join(configDir, ".team-sync");

  try {
    // Clone the team repo
    if (existsSync(tempDir)) {
      await cleanup(tempDir);
    }

    const proc = Bun.spawn(["git", "clone", "--depth", "1", "--branch", teamConfig.branch, teamConfig.repoUrl, tempDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { success: false, error: `Failed to clone team repo: ${stderr}` };
    }

    // Copy config files from team repo to local config
    const filesToSync = ["agents.json", "mcp.json", "lsp.json"];
    for (const file of filesToSync) {
      const srcPath = join(tempDir, file);
      if (existsSync(srcPath)) {
        const content = await readFile(srcPath, "utf-8");
        await writeFile(join(configDir, file), content, "utf-8");
      }
    }

    // Copy profiles
    const tempProfilesDir = join(tempDir, "profiles");
    const profilesDir = join(configDir, "profiles");
    if (existsSync(tempProfilesDir)) {
      if (!existsSync(profilesDir)) {
        await mkdir(profilesDir, { recursive: true });
      }
      const { readdirSync } = await import("fs");
      const profiles = readdirSync(tempProfilesDir).filter((f) => f.endsWith(".json"));
      for (const profile of profiles) {
        const content = await readFile(join(tempProfilesDir, profile), "utf-8");
        await writeFile(join(profilesDir, profile), content, "utf-8");
      }
    }

    // Update last sync time
    teamConfig.lastSync = new Date().toISOString();
    await saveTeamConfig(teamConfig);

    await cleanup(tempDir);
    return { success: true };
  } catch (err: any) {
    await cleanup(tempDir);
    return { success: false, error: err.message };
  }
}

/**
 * Get team sync status.
 */
export async function getTeamStatus(): Promise<{
  initialized: boolean;
  repoUrl?: string;
  branch?: string;
  lastSync?: string;
}> {
  const config = await loadTeamConfig();

  if (!config) {
    return { initialized: false };
  }

  return {
    initialized: true,
    repoUrl: config.repoUrl,
    branch: config.branch,
    lastSync: config.lastSync,
  };
}

/**
 * Clean up temporary directory.
 */
async function cleanup(dir: string): Promise<void> {
  try {
    const { rmSync } = await import("fs");
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
