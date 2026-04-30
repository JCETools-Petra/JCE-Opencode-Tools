import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { getConfigDir, loadConfigFile } from "./config.js";
import { validateAgainstSchema } from "./schema.js";
import type { CheckResult, McpConfig, LspConfig } from "../types.js";

/**
 * Check if a command-line tool is available.
 * Returns version string if found, null if not.
 */
async function getToolVersion(command: string): Promise<string | null> {
  try {
    const proc = Bun.spawn([command, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      return output.trim().split("\n")[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a command exists in PATH (without running --version).
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    const isWindows = platform() === "win32";
    const checkCmd = isWindows ? "where" : "which";
    const proc = Bun.spawn([checkCmd, command], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

// ─── Tool Checks ─────────────────────────────────────────────

export async function checkTools(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Git
  const gitVersion = await getToolVersion("git");
  if (gitVersion) {
    results.push({ name: "Git", status: "pass", message: `v${gitVersion.replace("git version ", "")}` });
  } else {
    results.push({ name: "Git", status: "error", message: "Not installed. Install from https://git-scm.com" });
  }

  // Bun
  const bunVersion = await getToolVersion("bun");
  if (bunVersion) {
    results.push({ name: "Bun", status: "pass", message: `v${bunVersion}` });
  } else {
    results.push({ name: "Bun", status: "error", message: "Not installed. Install from https://bun.sh" });
  }

  // OpenCode CLI
  const opencodeVersion = await getToolVersion("opencode");
  if (opencodeVersion) {
    results.push({ name: "OpenCode CLI", status: "pass", message: `v${opencodeVersion}` });
  } else {
    results.push({ name: "OpenCode CLI", status: "warn", message: "Not installed. Run: bun install -g opencode" });
  }

  return results;
}

// ─── API Key Checks ──────────────────────────────────────────
// API keys are managed by OpenCode CLI directly.
// We only do an informational check (pass/info, never warn).

export async function checkApiKeys(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    results.push({ name: "OpenAI API Key", status: "pass", message: "Managed by OpenCode CLI" });
  } else {
    results.push({ name: "OpenAI API Key", status: "pass", message: "Set in environment" });
  }

  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    results.push({ name: "Anthropic API Key", status: "pass", message: "Managed by OpenCode CLI" });
  } else {
    results.push({ name: "Anthropic API Key", status: "pass", message: "Set in environment" });
  }
    } catch {
      results.push({ name: "OpenAI API Key", status: "warn", message: "Key set but could not reach API" });
    }
  }

  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    results.push({ name: "Anthropic API Key", status: "warn", message: "ANTHROPIC_API_KEY not configured" });
  } else {
    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        results.push({ name: "Anthropic API Key", status: "pass", message: "Valid — API accessible" });
      } else {
        results.push({ name: "Anthropic API Key", status: "warn", message: "Key set but API returned error (may be invalid)" });
      }
    } catch {
      results.push({ name: "Anthropic API Key", status: "warn", message: "Key set but could not reach API" });
    }
  }

  return results;
}

// ─── Config File Checks ──────────────────────────────────────

export async function checkConfigFiles(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const configDir = getConfigDir();

  if (!existsSync(configDir)) {
    results.push({ name: "Config Directory", status: "error", message: `Not found: ${configDir}` });
    return results;
  }

  // Check main config files
  const configFiles: Array<{ file: string; schema: string }> = [
    { file: "agents.json", schema: "agents.schema.json" },
    { file: "mcp.json", schema: "mcp.schema.json" },
    { file: "lsp.json", schema: "lsp.schema.json" },
  ];

  for (const { file, schema } of configFiles) {
    try {
      const data = await loadConfigFile(file);
      const validation = await validateAgainstSchema(data, schema);
      if (validation.valid) {
        results.push({ name: file, status: "pass", message: "Valid" });
      } else {
        results.push({ name: file, status: "error", message: `Invalid: ${validation.errors[0]}` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: file, status: "error", message: msg });
    }
  }

  // Check profiles directory
  const profilesDir = join(configDir, "profiles");
  if (!existsSync(profilesDir)) {
    results.push({ name: "profiles/", status: "error", message: "Profiles directory not found" });
  } else {
    const profileFiles = readdirSync(profilesDir).filter((f) => f.endsWith(".json"));
    if (profileFiles.length === 0) {
      results.push({ name: "profiles/", status: "error", message: "No profile files found" });
    } else {
      let validCount = 0;
      let invalidCount = 0;
      for (const file of profileFiles) {
        try {
          const data = await loadConfigFile(join("profiles", file));
          const validation = await validateAgainstSchema(data, "profile.schema.json");
          if (validation.valid) {
            validCount++;
          } else {
            invalidCount++;
          }
        } catch {
          invalidCount++;
        }
      }
      if (invalidCount === 0) {
        results.push({ name: "profiles/", status: "pass", message: `${validCount} profiles valid` });
      } else {
        results.push({ name: "profiles/", status: "error", message: `${invalidCount}/${validCount + invalidCount} profiles invalid` });
      }
    }
  }

  return results;
}

// ─── MCP Server Checks ───────────────────────────────────────

export async function checkMcpServers(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    const mcpConfig = await loadConfigFile<McpConfig>("mcp.json");
    const servers = Object.entries(mcpConfig.mcpServers);

    for (const [name, server] of servers) {
      try {
        const proc = Bun.spawn([server.command, ...server.args], {
          stdout: "pipe",
          stderr: "pipe",
        });

        // Wait up to 5 seconds for the process to start
        const timeout = setTimeout(() => {
          proc.kill();
        }, 5000);

        const exitCode = await proc.exited;
        clearTimeout(timeout);

        // MCP servers that start and exit 0 (or get killed after timeout) are considered OK
        // A non-zero exit immediately means it failed to start
        if (exitCode === 0 || exitCode === null) {
          results.push({ name: `MCP: ${name}`, status: "pass", message: `${server.command} starts OK` });
        } else {
          results.push({ name: `MCP: ${name}`, status: "warn", message: `${server.command} exited with code ${exitCode}` });
        }
      } catch {
        results.push({ name: `MCP: ${name}`, status: "warn", message: `Cannot spawn: ${server.command}` });
      }
    }
  } catch {
    results.push({ name: "MCP Config", status: "error", message: "Cannot load mcp.json" });
  }

  return results;
}

// ─── LSP Server Checks ───────────────────────────────────────

export async function checkLspServers(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    const lspConfig = await loadConfigFile<LspConfig>("lsp.json");
    const servers = Object.entries(lspConfig.lsp);

    for (const [name, entry] of servers) {
      const exists = await commandExists(entry.command);
      if (exists) {
        results.push({ name: `LSP: ${name}`, status: "pass", message: `${entry.command} found in PATH` });
      } else {
        results.push({
          name: `LSP: ${name}`,
          status: "warn",
          message: `${entry.command} not found. Install: ${entry.installCommand}`,
        });
      }
    }
  } catch {
    results.push({ name: "LSP Config", status: "error", message: "Cannot load lsp.json" });
  }

  return results;
}

// ─── Internet Connectivity Check ─────────────────────────────

export async function checkInternet(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    const response = await fetch("https://api.github.com", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      results.push({ name: "Internet", status: "pass", message: "Connected (github.com reachable)" });
    } else {
      results.push({ name: "Internet", status: "warn", message: `github.com returned status ${response.status}` });
    }
  } catch {
    results.push({ name: "Internet", status: "error", message: "Cannot reach github.com (timeout or no connection)" });
  }

  return results;
}
