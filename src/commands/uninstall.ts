import { Command } from "commander";
import { existsSync } from "fs";
import { rm, cp, mkdir } from "fs/promises";
import { join } from "path";
import { createInterface } from "readline";
import { getConfigDir } from "../lib/config.js";
import { heading, info, success, warn, error } from "../lib/ui.js";
import { EXIT_SUCCESS, EXIT_ERROR } from "../types.js";

/**
 * Prompt the user for a yes/no answer.
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Run a shell command and return success/failure.
 */
async function runCommand(command: string, args: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

export const uninstallCommand = new Command("uninstall")
  .description("Remove OpenCode Suite configuration and optionally the CLI tools")
  .option("--force", "Skip confirmation prompts")
  .action(async (options: { force?: boolean }) => {
    heading("OpenCode Suite — Uninstaller");

    const configDir = getConfigDir();

    // Show what will be removed
    console.log();
    info("The following will be removed:");
    console.log(`    Config directory: ${configDir}`);
    console.log();

    if (!existsSync(configDir)) {
      warn("Config directory does not exist. Nothing to remove.");
      process.exit(EXIT_SUCCESS);
    }

    // Confirm
    if (!options.force) {
      const confirmed = await askConfirmation(
        "  This will remove all OpenCode Suite configuration. Continue? (y/N): "
      );
      if (!confirmed) {
        info("Uninstall cancelled.");
        process.exit(EXIT_SUCCESS);
      }
    }

    // Backup config
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupDir = `${configDir}.bak.${timestamp}`;

    info(`Backing up config to: ${backupDir}`);
    try {
      await mkdir(backupDir, { recursive: true });
      await cp(configDir, backupDir, { recursive: true });
      success(`Backup created: ${backupDir}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(`Failed to create backup: ${msg}`);
      process.exit(EXIT_ERROR);
    }

    // Remove config directory
    info("Removing config directory...");
    try {
      await rm(configDir, { recursive: true, force: true });
      success("Config directory removed.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(`Failed to remove config: ${msg}`);
      process.exit(EXIT_ERROR);
    }

    // Optionally remove opencode-suite CLI
    console.log();
    let removedSuiteCli = false;
    if (!options.force) {
      const removeSuite = await askConfirmation(
        "  Also uninstall opencode-suite CLI? (y/N): "
      );
      if (removeSuite) {
        info("Removing opencode-suite...");
        const ok = await runCommand("bun", ["remove", "-g", "opencode-suite"]);
        if (ok) {
          success("opencode-suite CLI removed.");
          removedSuiteCli = true;
        } else {
          warn("Could not remove opencode-suite (may not be globally installed).");
        }
      }
    }

    // Optionally remove opencode CLI
    let removedOpencode = false;
    if (!options.force) {
      const removeOpencode = await askConfirmation(
        "  Also uninstall OpenCode CLI? (y/N): "
      );
      if (removeOpencode) {
        info("Removing opencode...");
        const ok = await runCommand("bun", ["remove", "-g", "opencode"]);
        if (ok) {
          success("OpenCode CLI removed.");
          removedOpencode = true;
        } else {
          warn("Could not remove opencode (may not be globally installed).");
        }
      }
    }

    // Summary
    console.log();
    heading("Uninstall Summary");
    success(`Config backed up to: ${backupDir}`);
    success("Config directory removed.");
    if (removedSuiteCli) success("opencode-suite CLI removed.");
    if (removedOpencode) success("OpenCode CLI removed.");
    info("Git and Bun were NOT removed (used by other tools).");
    console.log();

    process.exit(EXIT_SUCCESS);
  });
