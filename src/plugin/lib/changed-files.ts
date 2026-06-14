/**
 * Changed-file extraction for runtime review gates.
 *
 * The final review gate needs real edit scope. Direct Write/Edit tools expose a
 * filePath/path argument, but other mutation paths (notably apply_patch and git
 * status/diff-like command output) report paths only in text. This module keeps
 * extraction conservative: collect clear file paths from trusted tool args and
 * well-known patch/status formats, never arbitrary prose.
 */

import { isRecord } from "./shared-predicates.js";

const PATCH_FILE_HEADER = /^\*\*\*\s+(?:Add File|Update File|Delete File):\s+(.+)$/gm;
const PATCH_MOVE_HEADER = /^\*\*\*\s+Move to:\s+(.+)$/gm;
const GIT_STATUS_LINE = /^\s*(?:[MADRCU?!]{1,2}|[ MADRCU?!][ MADRCU?!])\s+(.+)$/gm;
const DIFF_HEADER = /^diff --git a\/(.+?) b\/(.+)$/gm;
const MUTATING_COMMAND_PATH = /\b(?:Set-Content|Add-Content|Out-File|Remove-Item|New-Item|Move-Item|Copy-Item)\b(?:[^\n;|]*?)(?:-LiteralPath|-Path|-Destination|-FilePath)?\s+["']?([^"'\s;|]+\.[A-Za-z0-9]+)["']?/gi;
const SHELL_REDIRECT_PATH = /(?:>|>>|2>)\s*["']?([^"'\s;|]+\.[A-Za-z0-9]+)["']?/g;

function normalizePath(path: string): string | null {
  const trimmed = path.trim().replace(/^['"`]+|['"`]+$/g, "");
  if (!trimmed || trimmed === "/dev/null") return null;
  if (/\s+$/.test(trimmed)) return null;
  // Avoid shell/prose fragments. Keep Windows absolute, relative, and POSIX-ish
  // project paths that include at least one path separator or file extension.
  if (!/[\\/]/.test(trimmed) && !/\.[A-Za-z0-9]+$/.test(trimmed)) return null;
  return trimmed;
}

function addPath(paths: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const normalized = normalizePath(value);
  if (normalized) paths.add(normalized);
}

function extractFromPatchText(text: string, paths: Set<string>): void {
  for (const match of text.matchAll(PATCH_FILE_HEADER)) addPath(paths, match[1]);
  for (const match of text.matchAll(PATCH_MOVE_HEADER)) addPath(paths, match[1]);
}

function extractFromGitLikeOutput(text: string, paths: Set<string>): void {
  for (const match of text.matchAll(DIFF_HEADER)) {
    addPath(paths, match[1]);
    addPath(paths, match[2]);
  }
  for (const match of text.matchAll(GIT_STATUS_LINE)) {
    const candidate = match[1].includes(" -> ") ? match[1].split(" -> ").pop() : match[1];
    addPath(paths, candidate);
  }
}

function extractFromMutatingShellCommand(command: string, paths: Set<string>): void {
  for (const match of command.matchAll(MUTATING_COMMAND_PATH)) addPath(paths, match[1]);
  for (const match of command.matchAll(SHELL_REDIRECT_PATH)) addPath(paths, match[1]);
}

export function extractChangedFilesFromTool(tool: string, args: unknown, output: unknown): string[] {
  const paths = new Set<string>();
  const toolName = tool.toLowerCase();
  const textOutput = typeof output === "string" ? output : "";

  if (isRecord(args)) {
    addPath(paths, args.filePath);
    addPath(paths, args.path);
    addPath(paths, args.filename);
    if (Array.isArray(args.files)) {
      for (const file of args.files) addPath(paths, file);
    }

    if (toolName === "apply_patch" && typeof args.patchText === "string") {
      extractFromPatchText(args.patchText, paths);
    }
    if (toolName === "bash" && typeof args.command === "string") {
      extractFromMutatingShellCommand(args.command, paths);
      if (/\bgit\s+(status|diff)\b/i.test(args.command)) extractFromGitLikeOutput(textOutput, paths);
    }
  }

  if (toolName === "apply_patch") extractFromPatchText(textOutput, paths);

  return [...paths];
}
