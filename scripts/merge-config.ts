#!/usr/bin/env bun
/**
 * Merges OpenCode Suite config with existing config.
 * Strategy: ADD what's missing, DON'T TOUCH what exists.
 *
 * Usage: bun run scripts/merge-config.ts <source-dir> <target-dir>
 *   source-dir: directory containing new config files (e.g., /tmp/opencode-suite/config)
 *   target-dir: user's config directory (e.g., ~/.config/opencode)
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  statSync,
} from "fs";
import { join, basename } from "path";

const sourceDir = process.argv[2]; // e.g., /tmp/opencode-suite/config
const targetDir = process.argv[3]; // e.g., ~/.config/opencode

if (!sourceDir || !targetDir) {
  console.error("Usage: merge-config.ts <source-dir> <target-dir>");
  console.error("  source-dir: directory containing new config files");
  console.error("  target-dir: user's config directory");
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  console.error(`Source directory does not exist: ${sourceDir}`);
  process.exit(1);
}

// Ensure target directories exist
mkdirSync(targetDir, { recursive: true });
mkdirSync(join(targetDir, "profiles"), { recursive: true });

// --- Merge mcp.json ---
function mergeMcp() {
  const targetFile = join(targetDir, "mcp.json");
  const sourceFile = join(sourceDir, "mcp.json");

  if (!existsSync(sourceFile)) return;

  const sourceData = JSON.parse(readFileSync(sourceFile, "utf8"));

  if (existsSync(targetFile)) {
    const targetData = JSON.parse(readFileSync(targetFile, "utf8"));
    // Only add servers that don't exist in target
    for (const [key, value] of Object.entries(sourceData.mcpServers || {})) {
      if (!targetData.mcpServers?.[key]) {
        if (!targetData.mcpServers) targetData.mcpServers = {};
        targetData.mcpServers[key] = value;
        console.log(`  [+] MCP server added: ${key}`);
      } else {
        console.log(`  [=] MCP server exists, skipped: ${key}`);
      }
    }
    writeFileSync(targetFile, JSON.stringify(targetData, null, 2));
  } else {
    // No existing file, just copy
    copyFileSync(sourceFile, targetFile);
    console.log(`  [+] mcp.json created (new)`);
  }
}

// --- Merge agents.json ---
function mergeAgents() {
  const targetFile = join(targetDir, "agents.json");
  const sourceFile = join(sourceDir, "agents.json");

  if (!existsSync(sourceFile)) return;

  const sourceData = JSON.parse(readFileSync(sourceFile, "utf8"));

  if (existsSync(targetFile)) {
    const targetData = JSON.parse(readFileSync(targetFile, "utf8"));
    const existingIds = new Set(
      (targetData.agents || []).map((a: any) => a.id)
    );

    let added = 0;
    for (const agent of sourceData.agents || []) {
      if (!existingIds.has(agent.id)) {
        if (!targetData.agents) targetData.agents = [];
        targetData.agents.push(agent);
        added++;
      }
    }
    console.log(`  [+] Agents: ${added} added, ${existingIds.size} preserved`);
    writeFileSync(targetFile, JSON.stringify(targetData, null, 2));
  } else {
    copyFileSync(sourceFile, targetFile);
    console.log(`  [+] agents.json created (new)`);
  }
}

// --- Merge lsp.json ---
function mergeLsp() {
  const targetFile = join(targetDir, "lsp.json");
  const sourceFile = join(sourceDir, "lsp.json");

  if (!existsSync(sourceFile)) return;

  const sourceData = JSON.parse(readFileSync(sourceFile, "utf8"));

  if (existsSync(targetFile)) {
    const targetData = JSON.parse(readFileSync(targetFile, "utf8"));
    for (const [key, value] of Object.entries(sourceData.lsp || {})) {
      if (!targetData.lsp?.[key]) {
        if (!targetData.lsp) targetData.lsp = {};
        (targetData.lsp as Record<string, unknown>)[key] = value;
        console.log(`  [+] LSP added: ${key}`);
      } else {
        console.log(`  [=] LSP exists, skipped: ${key}`);
      }
    }
    writeFileSync(targetFile, JSON.stringify(targetData, null, 2));
  } else {
    copyFileSync(sourceFile, targetFile);
    console.log(`  [+] lsp.json created (new)`);
  }
}

// --- Merge profiles (only copy missing) ---
function mergeProfiles() {
  const sourceProfiles = join(sourceDir, "profiles");
  const targetProfiles = join(targetDir, "profiles");

  if (!existsSync(sourceProfiles)) return;

  let added = 0;
  let skipped = 0;
  for (const file of readdirSync(sourceProfiles)) {
    const sourcePath = join(sourceProfiles, file);
    // Skip directories
    if (statSync(sourcePath).isDirectory()) continue;

    const target = join(targetProfiles, file);
    if (!existsSync(target)) {
      copyFileSync(sourcePath, target);
      added++;
    } else {
      skipped++;
    }
  }
  console.log(`  [+] Profiles: ${added} added, ${skipped} already exist`);
}

// --- Merge prompts directory (only copy missing) ---
function mergePrompts() {
  const sourcePrompts = join(sourceDir, "prompts");
  const targetPrompts = join(targetDir, "prompts");

  if (!existsSync(sourcePrompts)) return;

  mkdirSync(targetPrompts, { recursive: true });

  let added = 0;
  let skipped = 0;
  for (const file of readdirSync(sourcePrompts)) {
    const sourcePath = join(sourcePrompts, file);
    // Skip directories
    if (statSync(sourcePath).isDirectory()) continue;

    const target = join(targetPrompts, file);
    if (!existsSync(target)) {
      copyFileSync(sourcePath, target);
      added++;
    } else {
      skipped++;
    }
  }
  console.log(`  [+] Prompts: ${added} added, ${skipped} already exist`);
}

// --- Copy only if not exists (for other files) ---
function copyIfMissing(filename: string) {
  const sourceFile = join(sourceDir, filename);
  const targetFile = join(targetDir, filename);

  if (!existsSync(sourceFile)) return;

  if (!existsSync(targetFile)) {
    copyFileSync(sourceFile, targetFile);
    console.log(`  [+] ${filename} created (new)`);
  } else {
    console.log(`  [=] ${filename} exists, skipped`);
  }
}

// --- Run all merges ---
console.log("");
console.log("Merging configuration (preserving existing settings)...");
console.log("");
console.log("MCP Tools:");
mergeMcp();
console.log("");
console.log("AI Agents:");
mergeAgents();
console.log("");
console.log("LSP Servers:");
mergeLsp();
console.log("");
console.log("Model Profiles:");
mergeProfiles();
console.log("");
console.log("Prompt Templates:");
mergePrompts();
console.log("");
console.log("Other configs:");
copyIfMissing("fallback.json");
console.log("");
console.log("Done — existing config preserved!");
