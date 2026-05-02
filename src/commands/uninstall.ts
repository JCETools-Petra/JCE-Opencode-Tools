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

// ─── LSP Servers (all that the installer can install) ────────────────────────

interface LspServerInfo {
  name: string;
  command: string; // Binary name to check if installed
  /** Uninstall strategies in order of preference. Tries each until one succeeds. */
  uninstallStrategies: string[][];
}

/**
 * Build the LSP server list with platform-appropriate uninstall commands.
 */
function buildLspServers(): LspServerInfo[] {
  const isWindows = platform() === "win32";

  return [
    // npm-installed (cross-platform, always works)
    { name: "Python (pyright)", command: "pyright-langserver", uninstallStrategies: [["npm", "uninstall", "-g", "pyright"]] },
    { name: "TypeScript", command: "typescript-language-server", uninstallStrategies: [["npm", "uninstall", "-g", "typescript-language-server"]] },
    { name: "Bash", command: "bash-language-server", uninstallStrategies: [["npm", "uninstall", "-g", "bash-language-server"]] },
    { name: "YAML", command: "yaml-language-server", uninstallStrategies: [["npm", "uninstall", "-g", "yaml-language-server"]] },
    { name: "HTML/CSS/JSON", command: "vscode-json-language-server", uninstallStrategies: [["npm", "uninstall", "-g", "vscode-langservers-extracted"]] },
    { name: "Docker", command: "docker-langserver", uninstallStrategies: [["npm", "uninstall", "-g", "dockerfile-language-server-nodejs"]] },
    { name: "SQL", command: "sql-language-server", uninstallStrategies: [["npm", "uninstall", "-g", "sql-language-server"]] },
    { name: "PHP (intelephense)", command: "intelephense", uninstallStrategies: [["npm", "uninstall", "-g", "intelephense"]] },
    { name: "Svelte", command: "svelteserver", uninstallStrategies: [["npm", "uninstall", "-g", "svelte-language-server"]] },
    { name: "Vue", command: "vue-language-server", uninstallStrategies: [["npm", "uninstall", "-g", "@vue/language-server"]] },
    { name: "Tailwind CSS", command: "tailwindcss-language-server", uninstallStrategies: [["npm", "uninstall", "-g", "@tailwindcss/language-server"]] },
    { name: "GraphQL", command: "graphql-lsp", uninstallStrategies: [["npm", "uninstall", "-g", "graphql-language-service-cli"]] },

    // Rust-analyzer: try multiple approaches
    { name: "Rust (rust-analyzer)", command: "rust-analyzer", uninstallStrategies: isWindows
      ? [
          ["rustup", "component", "remove", "rust-analyzer"],
          ["cargo", "uninstall", "rust-analyzer"],
          ["winget", "uninstall", "rust-analyzer"],
        ]
      : [
          ["rustup", "component", "remove", "rust-analyzer"],
          ["cargo", "uninstall", "rust-analyzer"],
        ]
    },

    // Go
    { name: "Go (gopls)", command: "gopls", uninstallStrategies: isWindows
      ? [["go", "clean", "-i", "golang.org/x/tools/gopls@latest"]]
      : [["go", "clean", "-i", "golang.org/x/tools/gopls@latest"], ["rm", "-f", "$(which gopls)"]]
    },

    // Ruby
    { name: "Ruby (solargraph)", command: "solargraph", uninstallStrategies: [["gem", "uninstall", "solargraph", "-x"]] },

    // .NET — try dotnet tool first, then winget
    { name: "C# (OmniSharp)", command: "OmniSharp", uninstallStrategies: isWindows
      ? [["dotnet", "tool", "uninstall", "-g", "csharp-ls"], ["winget", "uninstall", "OmniSharp.OmniSharp"]]
      : [["dotnet", "tool", "uninstall", "-g", "omnisharp"]]
    },

    // C/C++ (clangd) — platform-specific
    { name: "C/C++ (clangd)", command: "clangd", uninstallStrategies: isWindows
      ? [["winget", "uninstall", "LLVM.LLVM"], ["scoop", "uninstall", "llvm"], ["choco", "uninstall", "llvm"]]
      : [["brew", "uninstall", "llvm"], ["apt-get", "remove", "-y", "clangd"]]
    },

    // Java (jdtls)
    { name: "Java (jdtls)", command: "jdtls", uninstallStrategies: isWindows
      ? [["winget", "uninstall", "jdtls"], ["scoop", "uninstall", "jdtls"], ["choco", "uninstall", "jdtls"]]
      : [["brew", "uninstall", "jdtls"]]
    },

    // Cargo-installed tools
    { name: "TOML (taplo)", command: "taplo", uninstallStrategies: [["cargo", "uninstall", "taplo-cli"]] },

    // Marksman — multiple strategies per platform
    { name: "Markdown (marksman)", command: "marksman", uninstallStrategies: isWindows
      ? [["winget", "uninstall", "marksman"], ["scoop", "uninstall", "marksman"], ["cargo", "uninstall", "marksman"]]
      : [["brew", "uninstall", "marksman"], ["cargo", "uninstall", "marksman"]]
    },

    // Zig
    { name: "Zig (zls)", command: "zls", uninstallStrategies: isWindows
      ? [["scoop", "uninstall", "zls"], ["cargo", "uninstall", "zls"]]
      : [["brew", "uninstall", "zls"], ["cargo", "uninstall", "zls"]]
    },

    // Dart
    { name: "Dart", command: "dart", uninstallStrategies: isWindows
      ? [["choco", "uninstall", "dart-sdk"], ["scoop", "uninstall", "dart"]]
      : [["brew", "uninstall", "dart"]]
    },

    // Lua
    { name: "Lua", command: "lua-language-server", uninstallStrategies: isWindows
      ? [["scoop", "uninstall", "lua-language-server"]]
      : [["brew", "uninstall", "lua-language-server"]]
    },

    // Kotlin
    { name: "Kotlin", command: "kotlin-language-server", uninstallStrategies: isWindows
      ? [["scoop", "uninstall", "kotlin-language-server"]]
      : [["brew", "uninstall", "kotlin-language-server"]]
    },

    // Terraform
    { name: "Terraform", command: "terraform-ls", uninstallStrategies: isWindows
      ? [["winget", "uninstall", "HashiCorp.Terraform"]]
      : [["brew", "uninstall", "terraform-ls"]]
    },

    // Elixir
    { name: "Elixir", command: "elixir-ls", uninstallStrategies: isWindows
      ? [["scoop", "uninstall", "elixir-ls"]]
      : [["brew", "uninstall", "elixir-ls"]]
    },

    // Scala
    { name: "Scala (metals)", command: "metals", uninstallStrategies: isWindows
      ? [["cs", "uninstall", "metals"]]
      : [["brew", "uninstall", "metals"], ["cs", "uninstall", "metals"]]
    },
  ];
}

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
    // First try `where` (checks PATH)
    try {
      const proc = Bun.spawn(["where", cmd], { stdout: "pipe", stderr: "pipe" });
      if ((await proc.exited) === 0) return true;
    } catch {}

    // Also check common Windows installation paths (matching install.ps1 behavior)
    const home = process.env.USERPROFILE || "";
    const knownPaths = [
      join(home, "go", "bin", `${cmd}.exe`),
      join(home, ".dotnet", "tools", `${cmd}.exe`),
      join(home, ".cargo", "bin", `${cmd}.exe`),
      `C:\\Program Files\\LLVM\\bin\\${cmd}.exe`,
      `C:\\Program Files\\Go\\bin\\${cmd}.exe`,
      join(home, ".rustup", "toolchains", "stable-x86_64-pc-windows-msvc", "bin", `${cmd}.exe`),
    ];

    for (const p of knownPaths) {
      if (existsSync(p)) return true;
    }

    return false;
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

  const lspServers = buildLspServers();

  if (keep) {
    info("--keep-lsp flag aktif. LSP servers dipertahankan.");
    return { removed: [], skipped: lspServers.map((s) => s.name) };
  }

  // Check which LSP servers are actually installed
  info("Memeriksa LSP servers yang terinstall...");
  const installed: LspServerInfo[] = [];

  for (const server of lspServers) {
    const exists = await commandExists(server.command);
    if (exists) {
      installed.push(server);
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

    // Try each uninstall strategy in order until one succeeds
    let uninstalled = false;
    for (const strategy of server.uninstallStrategies) {
      const [cmd, ...args] = strategy;
      // Check if the uninstall tool exists first
      const toolExists = await commandExists(cmd);
      if (!toolExists) continue;

      const result = await runCommand(cmd, args);
      if (result.ok) {
        success(`${server.name} dihapus.`);
        removed.push(server.name);
        uninstalled = true;
        break;
      }
    }

    if (!uninstalled) {
      const fallbackCmd = server.uninstallStrategies[0].join(" ");
      warn(`Gagal menghapus ${server.name}. Coba manual: ${fallbackCmd}`);
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
