import { join } from "path";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { getConfigDir } from "./config.js";
import { log } from "./logger.js";

export interface VersionInfo {
  version: string;
  installedAt: string;
  lastUpdated: string;
}

export interface Migration {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate: () => Promise<void>;
}

/**
 * Current version of the config schema.
 */
export const CURRENT_CONFIG_VERSION = "1.3.9";

/**
 * Get the path to the version.json file.
 */
export function getVersionFilePath(): string {
  return join(getConfigDir(), "version.json");
}

/**
 * Read the current version info from version.json.
 * Returns null if the file doesn't exist.
 */
export async function getVersionInfo(): Promise<VersionInfo | null> {
  const versionPath = getVersionFilePath();

  if (!existsSync(versionPath)) {
    return null;
  }

  try {
    const content = await readFile(versionPath, "utf-8");
    return JSON.parse(content) as VersionInfo;
  } catch {
    return null;
  }
}

/**
 * Write version info to version.json.
 */
export async function writeVersionInfo(info: VersionInfo): Promise<void> {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  await writeFile(getVersionFilePath(), JSON.stringify(info, null, 2), "utf-8");
}

/**
 * Initialize version.json if it doesn't exist.
 * Called during install or first run.
 */
export async function initVersionFile(): Promise<VersionInfo> {
  const existing = await getVersionInfo();
  if (existing) {
    return existing;
  }

  const info: VersionInfo = {
    version: CURRENT_CONFIG_VERSION,
    installedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  await writeVersionInfo(info);
  return info;
}

/**
 * Update the version and lastUpdated timestamp.
 */
export async function updateVersion(newVersion: string): Promise<VersionInfo> {
  const existing = await getVersionInfo();

  const info: VersionInfo = {
    version: newVersion,
    installedAt: existing?.installedAt || new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  await writeVersionInfo(info);
  return info;
}

/**
 * Registry of all migrations, ordered by version.
 */
const migrations: Migration[] = [
  // Example migration for future use:
  // {
  //   fromVersion: "1.0.0",
  //   toVersion: "1.1.0",
  //   description: "Add token saving fields to profiles",
  //   migrate: async () => { ... },
  // },
];

/**
 * Compare two semver version strings.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}

/**
 * Get migrations that need to be run to go from currentVersion to targetVersion.
 */
export function getPendingMigrations(currentVersion: string, targetVersion: string): Migration[] {
  return migrations.filter((m) => {
    return compareVersions(m.fromVersion, currentVersion) >= 0 &&
           compareVersions(m.toVersion, targetVersion) <= 0;
  });
}

/**
 * Run all pending migrations from the current version to the target version.
 * Returns the number of migrations run.
 */
export async function runMigrations(targetVersion?: string): Promise<number> {
  const target = targetVersion || CURRENT_CONFIG_VERSION;
  const versionInfo = await getVersionInfo();
  const currentVersion = versionInfo?.version || "1.0.0";

  if (compareVersions(currentVersion, target) >= 0) {
    return 0; // Already up to date
  }

  const pending = getPendingMigrations(currentVersion, target);

  for (const migration of pending) {
    log("INFO", "migration", `Running migration: ${migration.description} (${migration.fromVersion} -> ${migration.toVersion})`);
    await migration.migrate();
  }

  // Update version file after successful migrations
  await updateVersion(target);

  return pending.length;
}
