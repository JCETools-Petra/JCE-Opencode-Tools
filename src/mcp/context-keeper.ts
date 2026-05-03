#!/usr/bin/env bun
/**
 * context-keeper — MCP Server for automatic context preservation.
 *
 * Provides tools that the AI MUST call at specific points:
 *   - context_read:       Read .opencode-context.md (call at session start)
 *   - context_update:     Update specific sections (call after completing tasks)
 *   - context_checkpoint: Validate & prune the file (call before session ends)
 *
 * This turns "remember to edit a file" into explicit tool calls,
 * which AI models follow far more reliably than free-form instructions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile, writeFile, stat } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import {
  CONTEXT_FILENAME,
  ARCHIVE_FILENAME,
  MAX_LINES_TARGET,
  MAX_LINES_HARD,
  getContextTemplate,
} from "../lib/context-template.js";

// ─── Helpers (exported for testing) ──────────────────────────

export function getProjectRoot(): string {
  return process.env.PROJECT_ROOT || process.cwd();
}

function contextPath(): string {
  return join(getProjectRoot(), CONTEXT_FILENAME);
}

function archivePath(): string {
  return join(getProjectRoot(), ARCHIVE_FILENAME);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readContext(): Promise<string | null> {
  try {
    return await readFile(contextPath(), "utf-8");
  } catch {
    return null;
  }
}

async function writeContext(content: string): Promise<void> {
  // Update the "Last updated" line
  const today = new Date().toISOString().split("T")[0];
  const updated = content.replace(
    /> Last updated:.*/,
    `> Last updated: ${today}`
  );
  await writeFile(contextPath(), updated, "utf-8");
}

/**
 * Count non-empty lines in content.
 */
export function countLines(content: string): number {
  return content.split("\n").filter((l) => l.trim().length > 0).length;
}

/**
 * Remove completed tasks ([x]) from ## Current Status,
 * and resolved/completed items from ## Important Notes.
 *
 * Important Notes items are pruned if they:
 *   - Start with "- [x]" (completed checkbox)
 *   - Start with "- [RESOLVED]" (explicitly marked resolved)
 */
export function pruneCompleted(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let currentSection = "";

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line;
      result.push(line);
      continue;
    }

    // Prune [x] items from Current Status
    if (
      currentSection.startsWith("## Current Status") &&
      /^\s*-\s*\[x\]/i.test(line)
    ) {
      continue;
    }

    // Prune [x] and [RESOLVED] items from Important Notes
    if (
      currentSection.startsWith("## Important Notes") &&
      /^\s*-\s*(\[x\]|\[RESOLVED\])/i.test(line)
    ) {
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Extract a section's content by heading name.
 */
export function getSection(content: string, heading: string): string[] {
  const lines = content.split("\n");
  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(`## ${heading}`)) {
      inSection = true;
      continue;
    }
    if (line.startsWith("## ") && inSection) {
      break;
    }
    if (inSection) {
      result.push(line);
    }
  }

  return result.filter((l) => l.trim().length > 0);
}

/**
 * Replace a section's content by heading name.
 */
export function replaceSection(
  content: string,
  heading: string,
  newLines: string[]
): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inSection = false;
  let sectionReplaced = false;

  for (const line of lines) {
    if (line.startsWith(`## ${heading}`)) {
      inSection = true;
      sectionReplaced = true;
      result.push(line);
      for (const nl of newLines) {
        result.push(nl);
      }
      continue;
    }
    if (line.startsWith("## ") && inSection) {
      inSection = false;
    }
    if (!inSection) {
      result.push(line);
    }
  }

  // If section didn't exist, append it
  if (!sectionReplaced) {
    result.push("");
    result.push(`## ${heading}`);
    for (const nl of newLines) {
      result.push(nl);
    }
  }

  return result.join("\n");
}

// ─── MCP Server ──────────────────────────────────────────────

const server = new McpServer(
  {
    name: "context-keeper",
    version: "1.8.2",
  },
  {
    instructions: [
      "MANDATORY: Call context_read at the START of every session.",
      "Call context_update after completing any task or making architecture decisions.",
      "Call context_checkpoint before the session ends or before committing.",
    ].join(" "),
  }
);

// ─── Tool: context_read ──────────────────────────────────────

server.tool(
  "context_read",
  "Read .opencode-context.md at session start. Creates the file if it doesn't exist. Returns the current context.",
  {},
  async () => {
    const existing = await readContext();

    if (existing) {
      // Auto-prune completed tasks
      const pruned = pruneCompleted(existing);
      if (pruned !== existing) {
        await writeContext(pruned);
      }

      const lines = countLines(pruned);
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `--- .opencode-context.md (${lines} lines) ---`,
              pruned,
              "---",
              lines > MAX_LINES_TARGET
                ? `WARNING: File has ${lines} lines (target: ${MAX_LINES_TARGET}). Consider archiving old entries.`
                : `File size OK (${lines}/${MAX_LINES_TARGET} target lines).`,
              "",
              "REMINDER: You MUST call context_update after completing any task.",
              "REMINDER: You MUST call context_checkpoint before the session ends or before committing.",
              "Failure to do so will result in lost context for the next session.",
            ].join("\n"),
          },
        ],
      };
    }

    // Create new file from template
    await writeContext(getContextTemplate());
    return {
      content: [
        {
          type: "text" as const,
          text: `Created new ${CONTEXT_FILENAME} from template. Please auto-detect the project stack and update the ## Stack section.`,
        },
      ],
    };
  }
);

// ─── Tool: context_update ────────────────────────────────────

server.tool(
  "context_update",
  "Update a specific section of .opencode-context.md. Use after completing tasks, making decisions, or adding dependencies.",
  {
    section: z
      .enum([
        "Stack",
        "Architecture Decisions",
        "Conventions",
        "Current Status",
        "Important Notes",
      ])
      .describe("Which section to update"),
    action: z
      .enum(["add", "replace"])
      .describe(
        "add = append lines to section, replace = replace entire section content"
      ),
    lines: z
      .array(z.string().max(200))
      .min(1)
      .max(20)
      .describe(
        'Lines to add/replace. Use "- [x] task" for completed, "- [ ] task" for pending.'
      ),
  },
  async ({ section, action, lines: rawLines }) => {
    // Sanitize: strip lines that could corrupt section structure
    const lines = rawLines
      .map((l) => (l.startsWith("## ") ? `- ${l.slice(3)}` : l))
      .map((l) => l.replace(/\r?\n/g, " ")); // no embedded newlines

    let content = await readContext();

    if (!content) {
      // Auto-create if missing
      content = getContextTemplate();
    }

    let updated: string;

    if (action === "replace") {
      updated = replaceSection(content, section, lines);
    } else {
      // Add: append to existing section
      const existing = getSection(content, section);
      // Deduplicate: don't add lines that already exist
      const newLines = lines.filter(
        (l) => !existing.some((e) => e.trim() === l.trim())
      );
      if (newLines.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No new lines to add — all entries already exist in ## ${section}.`,
            },
          ],
        };
      }
      updated = replaceSection(content, section, [...existing, ...newLines]);
    }

    await writeContext(updated);

    const lineCount = countLines(updated);
    const warning =
      lineCount > MAX_LINES_HARD
        ? `\nWARNING: File now has ${lineCount} lines (hard limit: ${MAX_LINES_HARD}). Call context_checkpoint to auto-archive.`
        : "";

    return {
      content: [
        {
          type: "text" as const,
          text: `Updated ## ${section} (${action}). File: ${lineCount} lines.${warning}\nREMINDER: Call context_checkpoint before session ends or before committing.`,
        },
      ],
    };
  }
);

// ─── Tool: context_checkpoint ────────────────────────────────

server.tool(
  "context_checkpoint",
  "Validate, prune, and optionally archive .opencode-context.md. Call before session ends or before committing.",
  {},
  async () => {
    let content = await readContext();

    if (!content) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No ${CONTEXT_FILENAME} found. Nothing to checkpoint.`,
          },
        ],
      };
    }

    const actions: string[] = [];

    // Step 1: Prune completed tasks
    const pruned = pruneCompleted(content);
    if (pruned !== content) {
      actions.push("Pruned completed/resolved items from Current Status and Important Notes");
      content = pruned;
    }

    // Step 2: Check if archive is needed
    const lineCount = countLines(content);
    if (lineCount > MAX_LINES_HARD) {
      // Archive old Architecture Decisions and Important Notes
      const archDecisions = getSection(content, "Architecture Decisions");
      const impNotes = getSection(content, "Important Notes");

      if (archDecisions.length > 3 || impNotes.length > 3) {
        const today = new Date().toISOString().split("T")[0];
        let archiveContent = "";

        if (await fileExists(archivePath())) {
          archiveContent = await readFile(archivePath(), "utf-8");
          archiveContent += "\n";
        } else {
          archiveContent = `# Context Archive\n> Historical decisions and notes. Reference only.\n\n`;
        }

        archiveContent += `## Archived: ${today}\n`;

        if (archDecisions.length > 3) {
          // Keep last 3, archive the rest
          const toArchive = archDecisions.slice(0, -3);
          const toKeep = archDecisions.slice(-3);
          archiveContent += `### Architecture Decisions\n${toArchive.join("\n")}\n\n`;
          content = replaceSection(content, "Architecture Decisions", toKeep);
          actions.push(
            `Archived ${toArchive.length} old architecture decisions`
          );
        }

        if (impNotes.length > 3) {
          const toArchive = impNotes.slice(0, -3);
          const toKeep = impNotes.slice(-3);
          archiveContent += `### Important Notes\n${toArchive.join("\n")}\n\n`;
          content = replaceSection(content, "Important Notes", toKeep);
          actions.push(`Archived ${toArchive.length} old important notes`);
        }

        await writeFile(archivePath(), archiveContent, "utf-8");

        // Add archive reference if not present
        if (!content.includes("see .opencode-context-archive.md")) {
          content = content.replace(
            "> Auto-maintained by AI.",
            "> Auto-maintained by AI. Archived entries: see .opencode-context-archive.md"
          );
        }
      }
    }

    await writeContext(content);

    const finalLines = countLines(content);
    actions.push(`Final file: ${finalLines} lines`);

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Checkpoint complete:",
            ...actions.map((a) => `  - ${a}`),
            "",
            finalLines > MAX_LINES_TARGET
              ? `Note: File still above target (${finalLines}/${MAX_LINES_TARGET}). Consider manually trimming verbose entries.`
              : "File size is within target.",
          ].join("\n"),
        },
      ],
    };
  }
);

// ─── Start ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("context-keeper failed to start:", err);
  process.exit(1);
});
