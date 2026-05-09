/**
 * Shared utility functions used across the CLI.
 * Extracted to avoid duplication between checker, fixer, and opencode-json-template.
 */

import { platform } from "os";
import { execFileSync } from "child_process";

// ─── Command Detection ───────────────────────────────────────

/**
 * Check if a command exists in PATH (async, uses Bun.spawn).
 */
export async function commandExistsAsync(command: string): Promise<boolean> {
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

/**
 * Check if a command exists in PATH (sync, uses execFileSync).
 * Validates command name against a safe pattern before execution.
 */
export function commandExistsSync(cmd: string): boolean {
  if (!/^[\w@./+:-]+$/.test(cmd)) return false;

  try {
    const checkCmd = platform() === "win32" ? "where" : "which";
    execFileSync(checkCmd, [cmd], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ─── Filetype Extensions Map ─────────────────────────────────

/** Map of filetype names to file extensions (shared across config and template modules). */
export const FILETYPE_EXTENSIONS: Record<string, string[]> = {
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
  bash: [".sh", ".bash"],
  sh: [".sh"],
  zsh: [".zsh"],
  yaml: [".yaml", ".yml"],
  yml: [".yaml", ".yml"],
  html: [".html", ".htm"],
  htm: [".html"],
  css: [".css"],
  scss: [".scss"],
  less: [".less"],
  kotlin: [".kt", ".kts"],
  dart: [".dart"],
  lua: [".lua"],
  svelte: [".svelte"],
  vue: [".vue"],
  terraform: [".tf", ".tfvars"],
  tf: [".tf"],
  hcl: [".hcl"],
  zig: [".zig"],
  markdown: [".md"],
  toml: [".toml"],
  graphql: [".graphql", ".gql"],
  gql: [".graphql", ".gql"],
  elixir: [".ex", ".exs"],
  eelixir: [".eex", ".heex"],
  scala: [".scala", ".sbt"],
  sbt: [".sbt"],
  csharp: [".cs"],
  json: [".json", ".jsonc"],
  jsonc: [".jsonc"],
};
