import { Command } from "commander";
import { createInterface } from "readline";
import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import chalk from "chalk";
import { getConfigDir } from "../lib/config.js";
import { listProfiles, setActiveProfile } from "../lib/profiles.js";
import { initVersionFile } from "../lib/version.js";
import { banner, heading, info, success, warn, error } from "../lib/ui.js";
import { logCommandStart, logCommandSuccess, logCommandError } from "../lib/logger.js";
import { EXIT_SUCCESS, EXIT_ERROR } from "../types.js";
import type { LspConfig } from "../types.js";

interface SetupPreferences {
  defaultProfile: string | null;
  apiKeys: {
    openai: string;
    anthropic: string;
  };
  enabledLsp: string[];
}

/**
 * Create a readline interface for interactive prompts.
 */
function createRl(): ReturnType<typeof createInterface> {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a question and return the answer.
 */
function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Ask a yes/no question.
 */
async function askYesNo(rl: ReturnType<typeof createInterface>, question: string): Promise<boolean> {
  const answer = await ask(rl, question);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

/**
 * Step 1: Choose default profile.
 */
async function chooseProfile(rl: ReturnType<typeof createInterface>): Promise<string | null> {
  heading("Step 1: Default Profile");
  console.log();

  const profiles = await listProfiles();

  if (profiles.length === 0) {
    warn("No profiles found. Skipping profile selection.");
    return null;
  }

  info("Available profiles:");
  console.log();

  profiles.forEach((profile, index) => {
    const num = chalk.cyan(`  [${index + 1}]`);
    const name = chalk.bold(profile.id.padEnd(18));
    console.log(`${num} ${name}${profile.description}`);
    console.log(`       Provider: ${profile.provider} | Model: ${profile.model}`);
  });

  console.log();
  const answer = await ask(rl, `  Choose a profile (1-${profiles.length}, or press Enter to skip): `);

  if (!answer) {
    info("Skipped profile selection.");
    return null;
  }

  const index = parseInt(answer, 10) - 1;
  if (index >= 0 && index < profiles.length) {
    const selected = profiles[index];
    await setActiveProfile(selected.id);
    success(`Default profile set to: ${selected.name}`);
    return selected.id;
  }

  warn("Invalid selection. Skipping profile selection.");
  return null;
}

/**
 * Step 2: Configure API keys.
 */
async function configureApiKeys(rl: ReturnType<typeof createInterface>): Promise<{ openai: string; anthropic: string }> {
  heading("Step 2: API Keys");
  console.log();
  info("API keys are stored as environment variable names in your profile configs.");
  info("Enter your actual API keys below to save them to a local .env reference file.");
  info("(Press Enter to skip any key)");
  console.log();

  const openai = await ask(rl, "  OpenAI API Key (OPENAI_API_KEY): ");
  const anthropic = await ask(rl, "  Anthropic API Key (ANTHROPIC_API_KEY): ");

  if (openai || anthropic) {
    // Write a reference .env file in the config directory
    const configDir = getConfigDir();
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }

    const envLines: string[] = ["# OpenCode Suite API Keys", "# Source this file or add to your shell profile", ""];
    if (openai) envLines.push(`export OPENAI_API_KEY="${openai}"`);
    if (anthropic) envLines.push(`export ANTHROPIC_API_KEY="${anthropic}"`);
    envLines.push("");

    const envPath = join(configDir, "api-keys.env");
    await writeFile(envPath, envLines.join("\n"), "utf-8");
    success(`API keys saved to: ${envPath}`);
    info("Add `source ${envPath}` to your shell profile to load them automatically.");
  } else {
    info("No API keys provided. Skipping.");
  }

  return { openai, anthropic };
}

/**
 * Step 3: Configure LSP servers.
 */
async function configureLsp(rl: ReturnType<typeof createInterface>): Promise<string[]> {
  heading("Step 3: LSP Servers");
  console.log();

  const configDir = getConfigDir();
  const lspPath = join(configDir, "lsp.json");

  if (!existsSync(lspPath)) {
    warn("lsp.json not found. Skipping LSP configuration.");
    return [];
  }

  let lspConfig: LspConfig;
  try {
    const content = await Bun.file(lspPath).text();
    lspConfig = JSON.parse(content) as LspConfig;
  } catch {
    warn("Could not parse lsp.json. Skipping LSP configuration.");
    return [];
  }

  const servers = Object.entries(lspConfig.lsp);
  if (servers.length === 0) {
    info("No LSP servers configured.");
    return [];
  }

  info("Available LSP servers:");
  console.log();

  const enabled: string[] = [];

  for (const [name, entry] of servers) {
    const answer = await askYesNo(rl, `  Enable ${chalk.bold(name)} (${entry.filetypes.join(", ")})? (y/N): `);
    if (answer) {
      enabled.push(name);
    }
  }

  if (enabled.length > 0) {
    // Write enabled LSP servers to a preferences file
    const prefsPath = join(configDir, "lsp-enabled.json");
    await writeFile(prefsPath, JSON.stringify({ enabled }, null, 2), "utf-8");
    success(`Enabled ${enabled.length} LSP server(s): ${enabled.join(", ")}`);
  } else {
    info("No LSP servers enabled.");
  }

  return enabled;
}

export const setupCommand = new Command("setup")
  .description("Interactive first-time setup wizard")
  .action(async () => {
    logCommandStart("setup");
    banner();

    console.log(chalk.bold("  Welcome to the OpenCode Suite Setup Wizard!"));
    console.log("  This will guide you through configuring your environment.");
    console.log();

    const configDir = getConfigDir();
    if (!existsSync(configDir)) {
      error("Config directory not found. Please run the installer first.");
      info("  bash: curl -fsSL <install-url> | bash");
      info("  powershell: irm <install-url> | iex");
      logCommandError("setup", "Config directory not found");
      process.exit(EXIT_ERROR);
    }

    const rl = createRl();

    try {
      // Step 1: Profile
      const defaultProfile = await chooseProfile(rl);

      // Step 2: API Keys
      const apiKeys = await configureApiKeys(rl);

      // Step 3: LSP
      const enabledLsp = await configureLsp(rl);

      // Initialize version file
      await initVersionFile();

      // Summary
      console.log();
      heading("Setup Complete!");
      console.log();

      if (defaultProfile) {
        success(`Default profile: ${defaultProfile}`);
      }
      if (apiKeys.openai || apiKeys.anthropic) {
        success("API keys configured.");
      }
      if (enabledLsp.length > 0) {
        success(`LSP servers enabled: ${enabledLsp.join(", ")}`);
      }

      console.log();
      info("Next steps:");
      info("  • Run `opencode-suite doctor` to verify your setup");
      info("  • Run `opencode-suite use <profile>` to switch profiles");
      info("  • Run `opencode-suite validate` to check config files");
      console.log();

      logCommandSuccess("setup", `profile=${defaultProfile || "none"}, lsp=${enabledLsp.length}`);
    } finally {
      rl.close();
    }

    process.exit(EXIT_SUCCESS);
  });
