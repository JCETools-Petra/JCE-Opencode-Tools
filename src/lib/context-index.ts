import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { ContextCaptureInput } from "./context-autocapture.js";

export const CONTEXT_INDEX_ROOT = ".opencode-jce/context";
export const CONTEXT_INDEX_SESSION = `${CONTEXT_INDEX_ROOT}/session.md`;
export const CONTEXT_INDEX_DIR = `${CONTEXT_INDEX_ROOT}/indexes`;
export const CONTEXT_NOTES_DIR = `${CONTEXT_INDEX_ROOT}/notes`;

export type ContextBucket =
  | "agents"
  | "android"
  | "config"
  | "frontend"
  | "release"
  | "security"
  | "testing"
  | "general";

export interface ContextIndexInput extends ContextCaptureInput {
  bucket?: string;
  agent?: string;
}

export interface ContextIndexWriteResult {
  bucket: string;
  sessionPath: string;
  indexPath: string;
  notePath: string | null;
  entry: string;
}

const BUCKET_DESCRIPTIONS: Record<ContextBucket, string> = {
  agents: "agent workflows, prompts, skills, and orchestration behavior",
  android: "Android builds, Gradle, Compose, devices, crashes, and releases",
  config: "installer, config, MCP, update, and project tooling changes",
  frontend: "UI, React, styling, accessibility, and browser verification",
  release: "version bumps, changelogs, tags, pushes, and release notes",
  security: "auth, permissions, secrets, vulnerable surfaces, and compliance",
  testing: "test strategy, verification commands, failures, and coverage",
  general: "project facts and handoff notes that do not fit a narrower bucket",
};

function cleanBucketName(bucket: string | undefined): string {
  const normalized = (bucket ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "general";
}

export function inferContextBucket(input: ContextIndexInput): ContextBucket {
  const explicit = cleanBucketName(input.bucket);
  if (explicit !== "general") return explicit as ContextBucket;

  const text = [
    input.summary,
    ...(input.changedFiles ?? []),
    ...(input.verification ?? []),
    ...(input.blockers ?? []),
    ...(input.nextSteps ?? []),
  ].join("\n").toLowerCase();

  if (/android|gradle|compose|adb|logcat|apk|aab|\.kt\b/.test(text)) return "android";
  if (/release|changelog|tag|version|push|publish|install\.ps1|install\.sh/.test(text)) return "release";
  if (/agent|skill|orchestration|jce-worker|prompt|handoff/.test(text)) return "agents";
  if (/mcp|config|installer|update|opencode\.json|agents\.md/.test(text)) return "config";
  if (/test|typecheck|verified|coverage|spec/.test(text)) return "testing";
  if (/security|auth|secret|permission|vulnerab|cve/.test(text)) return "security";
  if (/react|frontend|ui|css|tailwind|browser|accessibility/.test(text)) return "frontend";
  return "general";
}

function nowStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const millis = String(date.getMilliseconds()).padStart(3, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${millis}`;
}

function today(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function firstSentence(input: string | undefined, fallback: string): string {
  const cleaned = (input ?? "").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, 180);
}

function noteFilename(bucket: string, summary: string, date = new Date()): string {
  const slug = summary.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "context-note";
  return `${nowStamp(date)}-${bucket}-${slug}.md`;
}

async function uniqueNoteFilename(projectRoot: string, bucket: string, summary: string): Promise<string> {
  const base = noteFilename(bucket, summary);
  let candidate = base;
  let suffix = 1;
  while (await exists(join(projectRoot, CONTEXT_NOTES_DIR, candidate))) {
    candidate = base.replace(/\.md$/, `-${suffix}.md`);
    suffix += 1;
  }
  return candidate;
}

function renderSession(bucket: string, date = new Date()): string {
  const lines = [
    "# JCE Context Index",
    "> Auto-maintained by JCE context-keeper. Read this before opening detailed notes.",
    `> Last updated: ${today(date)}`,
    "",
    "## Buckets",
  ];
  for (const [name, description] of Object.entries(BUCKET_DESCRIPTIONS)) {
    const marker = name === bucket ? ` Last updated: ${today(date)}` : "";
    lines.push(`- \`${name}\` - ${description}.${marker} -> indexes/${name}.md`);
  }
  return `${lines.join("\n")}\n`;
}

function upsertBucketInSession(content: string, bucket: string, date = new Date()): string {
  const description = BUCKET_DESCRIPTIONS[bucket as ContextBucket] ?? "project context bucket";
  const line = `- \`${bucket}\` - ${description}. Last updated: ${today(date)} -> indexes/${bucket}.md`;
  const pattern = new RegExp("^- `" + bucket + "` .*$", "m");
  if (pattern.test(content)) return content.replace(pattern, line);
  const withDate = content.replace(/^> Last updated: .*$/m, `> Last updated: ${today(date)}`);
  return withDate.trimEnd() + `\n${line}\n`;
}

function renderIndex(bucket: string): string {
  const description = BUCKET_DESCRIPTIONS[bucket as ContextBucket] ?? "project context bucket";
  return [`# ${bucket} Context Index`, `> Scope: ${description}.`, "", "## Entries", ""].join("\n");
}

function renderNote(input: ContextIndexInput, bucket: string, summary: string): string {
  const lines = [
    `# ${summary}`,
    "",
    `- Date: ${new Date().toISOString()}`,
    `- Bucket: ${bucket}`,
    `- Agent: ${input.agent ?? "JCE-Worker"}`,
    "",
    "## Summary",
    `- ${summary}`,
  ];
  if (input.changedFiles?.length) lines.push("", "## Files", ...input.changedFiles.map((file) => `- ${file}`));
  if (input.verification?.length) lines.push("", "## Verification", ...input.verification.map((item) => `- ${item}`));
  if (input.blockers?.length) lines.push("", "## Blockers", ...input.blockers.map((item) => `- ${item}`));
  if (input.nextSteps?.length) lines.push("", "## Next Steps", ...input.nextSteps.map((item) => `- ${item}`));
  if (input.android) {
    lines.push("", "## Android");
    if (input.android.module) lines.push(`- Module: ${input.android.module}`);
    if (input.android.packageName) lines.push(`- Package: ${input.android.packageName}`);
    if (input.android.commands?.length) lines.push(`- Commands: ${input.android.commands.join(", ")}`);
    if (typeof input.android.logcatAvailable === "boolean") lines.push(`- Logcat available: ${input.android.logcatAvailable}`);
  }
  return `${lines.join("\n")}\n`;
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function writeFileAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

export async function ensureContextIndex(projectRoot: string, bucket: string = "general"): Promise<void> {
  await mkdir(join(projectRoot, CONTEXT_INDEX_DIR), { recursive: true });
  await mkdir(join(projectRoot, CONTEXT_NOTES_DIR), { recursive: true });
  const sessionPath = join(projectRoot, CONTEXT_INDEX_SESSION);
  if (!(await exists(sessionPath))) await writeFileAtomic(sessionPath, renderSession(bucket));
  const indexPath = join(projectRoot, CONTEXT_INDEX_DIR, `${bucket}.md`);
  if (!(await exists(indexPath))) await writeFileAtomic(indexPath, renderIndex(bucket));
}

export async function writeContextIndex(projectRoot: string, input: ContextIndexInput): Promise<ContextIndexWriteResult | null> {
  const summary = firstSentence(input.summary, "Context checkpoint");
  const hasDetails = Boolean(input.summary || input.changedFiles?.length || input.verification?.length || input.blockers?.length || input.nextSteps?.length || input.android);
  if (!hasDetails) return null;

  const bucket = cleanBucketName(input.bucket ?? inferContextBucket(input));
  await ensureContextIndex(projectRoot, bucket);

  const sessionPath = join(projectRoot, CONTEXT_INDEX_SESSION);
  const indexPath = join(projectRoot, CONTEXT_INDEX_DIR, `${bucket}.md`);
  const noteName = await uniqueNoteFilename(projectRoot, bucket, summary);
  const noteRel = `../notes/${noteName}`;
  const notePath = join(projectRoot, CONTEXT_NOTES_DIR, noteName);
  const entry = `- ${new Date().toISOString()} - ${input.agent ?? "JCE-Worker"}: ${summary} -> ${noteRel}`;

  const sessionContent = await readIfExists(sessionPath);
  await writeFileAtomic(sessionPath, upsertBucketInSession(sessionContent ?? renderSession(bucket), bucket));

  const indexContent = await readIfExists(indexPath);
  const baseIndex = indexContent ?? renderIndex(bucket);
  const updatedIndex = baseIndex.includes(entry) ? baseIndex : baseIndex.replace("## Entries\n", `## Entries\n${entry}\n`);
  await writeFileAtomic(indexPath, updatedIndex);
  await writeFileAtomic(notePath, renderNote(input, bucket, summary));

  return { bucket, sessionPath: CONTEXT_INDEX_SESSION, indexPath: `${CONTEXT_INDEX_DIR}/${bucket}.md`, notePath: `${CONTEXT_NOTES_DIR}/${noteName}`, entry };
}

export async function readContextIndex(projectRoot: string, bucket?: string): Promise<string> {
  const cleanBucket = bucket ? cleanBucketName(bucket) : undefined;
  const sessionPath = join(projectRoot, CONTEXT_INDEX_SESSION);
  if (!(await exists(sessionPath))) return `No ${CONTEXT_INDEX_SESSION} found. Call context_index_update or context_checkpoint with summary first.`;
  if (!cleanBucket) return await readFile(sessionPath, "utf8");
  const indexPath = join(projectRoot, CONTEXT_INDEX_DIR, `${cleanBucket}.md`);
  if (!(await exists(indexPath))) return `No context bucket "${cleanBucket}" found under ${CONTEXT_INDEX_DIR}.`;
  return await readFile(indexPath, "utf8");
}

export async function listContextBuckets(projectRoot: string): Promise<string[]> {
  const indexesDir = join(projectRoot, CONTEXT_INDEX_DIR);
  try {
    const entries = await readdir(indexesDir);
    return entries.filter((entry) => entry.endsWith(".md")).map((entry) => basename(entry, ".md")).sort();
  } catch {
    return [];
  }
}
