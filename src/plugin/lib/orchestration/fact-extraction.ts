/**
 * Project-fact extraction from tool output.
 *
 * Extracted as a pure, testable function. The key precision rule: only
 * EXECUTION-derived output (bash / sub-agent results) is trusted for
 * tool/framework/error facts. File contents (read/grep) routinely mention
 * tool names like "jest" or "webpack" without those being real project facts,
 * so they are excluded to avoid false positives (root cause of noisy facts).
 */

import type { FactSource } from "./types.js";

export interface ExtractedFact {
  key: string;
  value: string;
  source: FactSource;
  confidence: number;
}

const EXECUTION_TOOLS = new Set(["bash", "task", "bg_collect"]);

// Anchored execution signals: an invocation at line start, optionally prefixed
// by a shell prompt ($, >). This is far stronger than a bare word match.
function invoked(output: string, command: string): boolean {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)\\s*(?:\\$|>|#)?\\s*${escaped}\\b`, "i").test(output);
}

const TEST_SUMMARY = /\b\d+\s+(?:pass(?:ed|ing)?|fail(?:ed|ing)?)\b|\bran\s+\d+\s+tests?\b|tests?:\s+\d+\s+passed/i;

/**
 * Extract durable project facts from a tool's output.
 * Returns an empty array for non-execution tools or when no high-signal
 * pattern is matched.
 */
export function extractProjectFacts(tool: string, output: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  if (typeof output !== "string" || output.length < 20 || output.length > 10000) return facts;
  if (!EXECUTION_TOOLS.has(tool)) return facts;

  // ─── Test runner (require invocation AND a result summary) ──────────────
  if (invoked(output, "bun test") && TEST_SUMMARY.test(output)) {
    facts.push({ key: "test.runner", value: "bun test", source: "tool", confidence: 0.9 });
  } else if (/PASS\b|FAIL\b|Tests:\s+\d+\s+passed/.test(output) && /\bjest\b/i.test(output)) {
    facts.push({ key: "test.runner", value: "jest", source: "tool", confidence: 0.8 });
  } else if ((invoked(output, "pytest") || /=+\s*test session starts\s*=+/i.test(output)) && /\bpassed\b|\bfailed\b/i.test(output)) {
    facts.push({ key: "test.runner", value: "pytest", source: "tool", confidence: 0.8 });
  } else if (invoked(output, "cargo test") && TEST_SUMMARY.test(output)) {
    facts.push({ key: "test.runner", value: "cargo test", source: "tool", confidence: 0.8 });
  }

  // ─── Build / typecheck ──────────────────────────────────────────────────
  if (/\berror TS\d+/i.test(output) || (invoked(output, "tsc") && /no\s*emit|--noEmit/i.test(output))) {
    facts.push({ key: "build.typecheck", value: "tsc", source: "tool", confidence: 0.9 });
  }
  if (invoked(output, "vite") || /\bvite\s+v\d|building for production/i.test(output)) {
    facts.push({ key: "build.bundler", value: "vite", source: "tool", confidence: 0.7 });
  }
  if (invoked(output, "webpack") || /webpack\s+\d+\.\d+|webpack compiled/i.test(output)) {
    facts.push({ key: "build.bundler", value: "webpack", source: "tool", confidence: 0.7 });
  }

  // ─── Package manager (invocation only) ──────────────────────────────────
  if (invoked(output, "bun install") || invoked(output, "bun add") || invoked(output, "bun remove")) {
    facts.push({ key: "package.manager", value: "bun", source: "tool", confidence: 0.9 });
  } else if (invoked(output, "npm install") || invoked(output, "npm ci")) {
    facts.push({ key: "package.manager", value: "npm", source: "tool", confidence: 0.8 });
  } else if (invoked(output, "pnpm install") || invoked(output, "pnpm add")) {
    facts.push({ key: "package.manager", value: "pnpm", source: "tool", confidence: 0.8 });
  }

  // ─── Last error type (useful for re-planning) ───────────────────────────
  if (/\berror TS\d+/i.test(output)) {
    facts.push({ key: "last.error.type", value: "typescript", source: "tool", confidence: 0.9 });
  } else if (/\bSyntaxError\b/.test(output)) {
    facts.push({ key: "last.error.type", value: "syntax", source: "tool", confidence: 0.9 });
  } else if (/\bReferenceError\b/.test(output)) {
    facts.push({ key: "last.error.type", value: "reference", source: "tool", confidence: 0.9 });
  }

  return facts;
}
