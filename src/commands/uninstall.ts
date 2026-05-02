import { Command } from "commander";
import { existsSync } from "fs";
import { rm, cp, mkdir } from "fs/promises";
import { join } from "path";
import { platform } from "os";
import { createInterface } from "readline";
import { getConfigDir } from "../lib/config.js";
import { banner, heading, info, success, warn, error } from "../lib/ui.js";
import { EXIT_SUCCESS, EXIT_ERROR } from "../types.js";

// ─── MCP Packages (from config/mcp.json) ────────────────────────────────────

const MCP_PACKAGES = [
  "@upstash/context7-mcp",
  "@modelcontextprotocol/server-github",
  "@modelcontextprotocol/server-fetch",
  "@modelcontextprotocol/server-filesystem",
  "@modelcontextprotocol/server-memory",
  "@playwright/mcp",
  "@modelcontextprotocol/server-sequential-thinking",
  "@modelcontextprotocol/server-postgres",
] as const;

// ─── LSP Servers (all 28 that the installer can install) ─────────────────────

interface LspServerInfo {
  name: string;
  command: string; // Binary name to check if installed
  uninstallCmd: string[]; // [command, ...args] to uninstall
  uninstallMethod: string; // Description for user
}

const LSP_SERVERS: LspServerInfo[] = [
  // npm-installed LSP servers
  { name: "Python (pyright)", command: "pyright-langserver", uninstallCmd: ["npm", "uninstall", "-g", "pyright"], uninstallMethod: "npm" },
  { name: "TypeScript", command: "typescript-language-server", uninstallCmd: ["npm", "uninstall", "-g", "typescript-language-server"], uninstallMethod: "npm" },
  { name: "Bash", command: "bash-language-server", uninstallCmd: ["npm", "uninstall", "-g", "bash-language-server"], uninstallMethod: "npm" },
  { name: "YAML", command: "yaml-language-server", uninstallCmd: ["npm", "uninstall", "-g", "yaml-language-server"], uninstallMethod: "npm" },
  { name: "HTML/CSS/JSON", command: "vscode-json-language-server", uninstallCmd: ["npm", "uninstall", "-g", "vscode-langservers-extracted"], uninstallMethod: "npm" },
  { name: "Docker", command: "docker-langserver", uninstallCmd: ["npm", "uninstall", "-g", "dockerfile-language-server-nodejs"], uninstallMethod: "npm" },
  { name: "SQL", command: "sql-language-server", uninstallCmd: ["npm", "uninstall", "-g", "sql-language-server"], uninstallMethod: "npm" },
  { name: "PHP (intelephense)", command: "intelephense", uninstallCmd: ["npm", "uninstall", "-g", "intelephense"], uninstallMethod: "npm" },
  { name: "Svelte", command: "svelteserver", uninstallCmd: ["npm", "uninstall", "-g", "svelte-language-server"], uninstallMethod: "npm" },
  { name: "Vue", command: "vue-language-server", uninstallCmd: ["npm", "uninstall", "-g", "@vue/language-server"], uninstallMethod: "npm" },
  { name: "Tailwind CSS", command: "tailwindcss-language-server", uninstallCmd: ["npm", "uninstall", "-g", "@tailwindcss/language-server"], uninstallMethod: "npm" },
  { name: "GraphQL", command: "graphql-lsp", uninstallCmd: ["npm", "uninstall", "-g", "graphql-language-service-cli"], uninstallMethod: "npm" },
  // Rust-analyzer (installed via rustup)
  { name: "Rust (rust-analyzer)", command: "rust-analyzer", uninstallCmd: ["rustup", "component", "remove", "rust-analyzer"], uninstallMethod: "rustup" },
  // Go (installed via go install)
  { name: "Go (gopls)", command: "gopls", uninstallCmd: ["go", "clean", "-i", "golang.org/x/tools/gopls@latest"], uninstallMethod: "go" },
  // Ruby (installed via gem)
  { name: "Ruby (solargraph)", command: "solargraph", uninstallCmd: ["gem", "uninstall", "solargraph", "-x"], uninstallMethod: "gem" },
  // .NET (installed via dotnet tool)
  { name: "C# (OmniSharp)", command: "OmniSharp", uninstallCmd: ["dotnet", "tool", "uninstall", "-g", "omnisharp"], uninstallMethod: "dotnet" },
  // System package managers (clangd, jdtls, etc.) — can't reliably uninstall cross-platform
  { name: "C/C++ (clangd)", command: "clangd", uninstallCmd: ["npm", "uninstall", "-g", "clangd"], uninstallMethod: "system" },
  { name: "Java (jdtls)", command: "jdtls", uninstallCmd: ["brew", "uninstall", "jdtls"], uninstallMethod: "system" },
  // Cargo-installed
  { name: "TOML (taplo)", command: "taplo", uninstallCmd: ["cargo", "uninstall", "taplo-cli"], uninstallMethod: "cargo" },
  { name: "Markdown (marksman)", command: "marksman", uninstallCmd: ["brew", "uninstall", "marksman"], uninstallMethod: "system" },
  { name: "Zig (zls)", command: "zls", uninstallCmd: ["brew", "uninstall", "zls"], uninstallMethod: "system" },
  // Dart
  { name: "Dart", command: "dart", uninstallCmd: ["brew", "uninstall", "dart"], uninstallMethod: "system" },
  // Lua
  { name: "Lua", command: "lua-language-server", uninstallCmd: ["brew", "uninstall", "lua-language-server"], uninstallMethod: "system" },
  // Kotlin
  { name: "Kotlin", command: "kotlin-language-server", uninstallCmd: ["brew", "uninstall", "kotlin-language-server"], uninstallMethod: "system" },
  // Terraform
  { name: "Terraform", command: "terraform-ls", uninstallCmd: ["brew", "uninstall", "terraform-ls"], uninstallMethod: "system" },
  // Elixir
  { name: "Elixir", command: "elixir-ls", uninstallCmd: ["brew", "uninstall", "elixir-ls"], uninstallMethod: "system" },
  // Scala
  { name: "Scala (metals)", command: "metals", uninstallCmd: ["brew", "uninstall", "metals"], uninstallMethod: "system" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CommandResult {
  ok: boolean;
  output: string;
}

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  try {
    const proc = Bun.spawn([command, ...args], { stdout: "pipe", stderr: "pipe" });
    const exitCode = await proc.exited;
    const output = await new Response(proc.stdout).text();
    return { ok: exitCode === 0, output };
  } catch {
    return { ok: false, output: "" };
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  const isWindows = platform() === "win32";

  if (isWindows) {
    try {
      const proc = Bun.spawn(["where", cmd], { stdout: "pipe", stderr: "pipe" });
      return (await proc.exited) === 0;
    } catch {
      return false;
    }
  }

  try {
    const proc = Bun.spawn(["which", cmd], { stdout: "pipe", stderr: "pipe" });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

// ─── Uninstall Steps ─────────────────────────────────────────────────────────

interface UninstallResult {
  configRemoved: boolean;
  configBackupPath: string | null;
  mcpCacheCleaned: boolean;
  lspRemoved: string[];
  lspSkipped: string[];
  opencodejceRemoved: boolean;
  opencodeRemoved: boolean;
}

async function removeConfigDirectory(force: boolean): Promise<{ removed: boolean; backupPath: string | null }> {
  const configDir = getConfigDir();

  console.log();
  heading("1. Config Directory");
  info(`Path: ${configDir}`);

  if (!existsSync(configDir)) {
    warn("Config directory tidak ditemukan. Skip.");
    return { removed: false, backupPath: null };
  }

  if (!force) {
    const confirmed = await askConfirmation("  Hapus config directory? Backup akan dibuat terlebih dahulu. (y/N): ");
    if (!confirmed) {
      info("Config directory dipertahankan.");
      return { removed: false, backupPath: null };
    }
  }

  // Create backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = `${configDir}.bak.${timestamp}`;

  info(`Membuat backup: ${backupDir}`);
  try {
    await mkdir(backupDir, { recursive: true });
    await cp(configDir, backupDir, { recursive: true });
    success(`Backup berhasil: ${backupDir}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Gagal membuat backup: ${msg}`);
    return { removed: false, backupPath: null };
  }

  // Remove config
  info("Menghapus config directory...");
  try {
    await rm(configDir, { recursive: true, force: true });
    success("Config directory dihapus.");
    return { removed: true, backupPath: backupDir };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Gagal menghapus config: ${msg}`);
    return { removed: false, backupPath: backupDir };
  }
}

async function cleanMcpCache(force: boolean, keep: boolean): Promise<boolean> {
  console.log();
  heading("2. MCP Packages (npm/npx cache)");

  if (keep) {
    info("--keep-mcp flag aktif. MCP cache dipertahankan.");
    return false;
  }

  info("MCP servers dijalankan via npx dan tersimpan di npm cache:");
  for (const pkg of MCP_PACKAGES) {
    console.log(`    • ${pkg}`);
  }
  console.log();

  if (!force) {
    const confirmed = await askConfirmation("  Hapus MCP packages dari npm cache? (npm cache clean --force) (y/N): ");
    if (!confirmed) {
      info("npm cache dipertahankan.");
      return false;
    }
  }

  info("Membersihkan npm cache...");
  const result = await runCommand("npm", ["cache", "clean", "--force"]);

  if (result.ok) {
    success("npm cache berhasil dibersihkan (semua MCP packages dihapus).");
    return true;
  } else {
    warn("Gagal membersihkan npm cache. Coba jalankan manual: npm cache clean --force");
    return false;
  }
}

async function removeLspServers(force: boolean, keep: boolean): Promise<{ removed: string[]; skipped: string[] }> {
  console.log();
  heading("3. LSP Servers");

  if (keep) {
    info("--keep-lsp flag aktif. LSP servers dipertahankan.");
    return { removed: [], skipped: LSP_SERVERS.map((s) => s.name) };
  }

  // Check which LSP servers are actually installed
  info("Memeriksa LSP servers yang terinstall...");
  const installed: LspServerInfo[] = [];
  const notInstalled: LspServerInfo[] = [];

  for (const server of LSP_SERVERS) {
    const exists = await commandExists(server.command);
    if (exists) {
      installed.push(server);
    } else {
      notInstalled.push(server);
    }
  }

  if (installed.length === 0) {
    info("Tidak ada LSP server yang terdeteksi terinstall.");
    return { removed: [], skipped: [] };
  }

  console.log();
  info(`LSP servers yang terinstall (${installed.length}):`);
  for (const server of installed) {
    console.log(`    ✓ ${server.name}`);
  }
  console.log();

  if (!force) {
    const confirmed = await askConfirmation("  Hapus LSP servers yang di-install oleh opencode-jce? (y/N): ");
    if (!confirmed) {
      info("LSP servers dipertahankan.");
      return { removed: [], skipped: installed.map((s) => s.name) };
    }
  }

  const removed: string[] = [];
  const skipped: string[] = [];

  for (const server of installed) {
    info(`Menghapus ${server.name}...`);
    const [cmd, ...args] = server.uninstallCmd;
    const result = await runCommand(cmd, args);
    if (result.ok) {
      success(`${server.name} dihapus.`);
      removed.push(server.name);
    } else {
      if (server.uninstallMethod === "system") {
        warn(`${server.name} — diinstall via system package manager, hapus manual.`);
      } else {
        warn(`Gagal menghapus ${server.name}. Coba manual: ${server.uninstallCmd.join(" ")}`);
      }
      skipped.push(server.name);
    }
  }

  return { removed, skipped };
}

async function removeOpenCodeJceCli(force: boolean): Promise<boolean> {
  console.log();
  heading("4. opencode-jce CLI");

  if (!force) {
    const confirmed = await askConfirmation("  Hapus opencode-jce CLI? (y/N): ");
    if (!confirmed) {
      info("opencode-jce CLI dipertahankan.");
      return false;
    }
  }

  info("Menghapus opencode-jce...");
  const result = await runCommand("bun", ["remove", "-g", "opencode-jce"]);

  if (result.ok) {
    success("opencode-jce CLI dihapus.");
    return true;
  } else {
    warn("Gagal menghapus opencode-jce (mungkin tidak terinstall secara global).");
    return false;
  }
}

async function removeOpenCodeCli(force: boolean): Promise<boolean> {
  console.log();
  heading("5. OpenCode CLI");

  if (!force) {
    const confirmed = await askConfirmation("  Hapus OpenCode CLI? (y/N): ");
    if (!confirmed) {
      info("OpenCode CLI dipertahankan.");
      return false;
    }
  }

  info("Menghapus opencode...");
  const result = await runCommand("bun", ["remove", "-g", "opencode"]);

  if (result.ok) {
    success("OpenCode CLI dihapus.");
    return true;
  } else {
    warn("Gagal menghapus opencode (mungkin tidak terinstall secara global).");
    return false;
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function printSummary(result: UninstallResult): void {
  console.log();
  heading("📋 Uninstall Summary");
  console.log();

  const removed: string[] = [];
  const kept: string[] = [];

  // Config
  if (result.configRemoved) {
    removed.push("Config directory");
    if (result.configBackupPath) {
      info(`Backup tersimpan di: ${result.configBackupPath}`);
    }
  } else {
    kept.push("Config directory");
  }

  // MCP cache
  if (result.mcpCacheCleaned) {
    removed.push("npm/npx cache (MCP packages)");
  } else {
    kept.push("npm/npx cache (MCP packages)");
  }

  // LSP
  if (result.lspRemoved.length > 0) {
    removed.push(`LSP servers: ${result.lspRemoved.join(", ")}`);
  }
  if (result.lspSkipped.length > 0) {
    kept.push(`LSP servers: ${result.lspSkipped.join(", ")}`);
  }

  // CLIs
  if (result.opencodejceRemoved) {
    removed.push("opencode-jce CLI");
  } else {
    kept.push("opencode-jce CLI");
  }

  if (result.opencodeRemoved) {
    removed.push("OpenCode CLI");
  } else {
    kept.push("OpenCode CLI");
  }

  // Print
  if (removed.length > 0) {
    console.log();
    success("Dihapus:");
    for (const item of removed) {
      console.log(`    • ${item}`);
    }
  }

  if (kept.length > 0) {
    console.log();
    info("Dipertahankan:");
    for (const item of kept) {
      console.log(`    • ${item}`);
    }
  }

  console.log();
  info("Git dan Bun TIDAK dihapus (digunakan oleh tools lain).");
  console.log();
}

// ─── Command ─────────────────────────────────────────────────────────────────

interface UninstallOptions {
  force?: boolean;
  keepLsp?: boolean;
  keepMcp?: boolean;
}

export const uninstallCommand = new Command("uninstall")
  .description("Remove OpenCode JCE configuration, MCP cache, LSP servers, and CLI tools")
  .option("--force", "Remove everything without asking (respects --keep-* flags)")
  .option("--keep-lsp", "Don't remove LSP servers (even with --force)")
  .option("--keep-mcp", "Don't remove MCP cache (even with --force)")
  .action(async (options: UninstallOptions) => {
    banner();
    heading("OpenCode JCE — Uninstaller");

    const force = options.force ?? false;
    const keepLsp = options.keepLsp ?? false;
    const keepMcp = options.keepMcp ?? false;

    if (force) {
      warn("Mode --force aktif: semua komponen akan dihapus tanpa konfirmasi.");
      if (keepLsp) info("--keep-lsp: LSP servers akan dipertahankan.");
      if (keepMcp) info("--keep-mcp: MCP cache akan dipertahankan.");
    }

    const result: UninstallResult = {
      configRemoved: false,
      configBackupPath: null,
      mcpCacheCleaned: false,
      lspRemoved: [],
      lspSkipped: [],
      opencodejceRemoved: false,
      opencodeRemoved: false,
    };

    // Step 1: Config directory
    const configResult = await removeConfigDirectory(force);
    result.configRemoved = configResult.removed;
    result.configBackupPath = configResult.backupPath;

    // Step 2: MCP cache
    result.mcpCacheCleaned = await cleanMcpCache(force, keepMcp);

    // Step 3: LSP servers
    const lspResult = await removeLspServers(force, keepLsp);
    result.lspRemoved = lspResult.removed;
    result.lspSkipped = lspResult.skipped;

    // Step 4: opencode-jce CLI
    result.opencodejceRemoved = await removeOpenCodeJceCli(force);

    // Step 5: OpenCode CLI
    result.opencodeRemoved = await removeOpenCodeCli(force);

    // Summary
    printSummary(result);

    process.exit(EXIT_SUCCESS);
  });
