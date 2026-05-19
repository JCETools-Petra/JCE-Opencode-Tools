import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";

export type SkillTier = "framework" | "language" | "domain" | "workflow" | "generic";

export interface SkillAuditFinding { severity: "info" | "warning" | "error"; message: string }
export interface SkillAuditResult { name: string; path: string; score: number; findings: SkillAuditFinding[]; hasFrontmatter: boolean; description?: string }
export interface SkillAuditReport { total: number; averageScore: number; results: SkillAuditResult[]; errors: number; warnings: number }

export interface SkillConflictResolution { selected: string[]; suppressed: { skill: string; reason: string }[] }
export interface Capability { id: string; title: string; domains: string[]; agents: string[]; skills: string[]; tools: string[]; verification: string[]; maturity: "baseline" | "advanced" }
export interface CapabilityRegistry { capabilities: Capability[] }
export interface EvidenceRecord { id: string; taskId: string; type: "command" | "source" | "review" | "manual" | "file"; summary: string; command?: string; status: "pass" | "fail" | "blocked" | "unknown"; timestamp: string }
export interface TelemetryEvent { kind: "skill_selected" | "task_blocked" | "agent_retry" | "verification_used"; name: string; at: string; metadata?: Record<string, unknown> }
export interface JceDoctorReport { checks: { name: string; status: "pass" | "warning" | "fail"; message: string }[]; summary: { pass: number; warning: number; fail: number } }

const FRAMEWORK = new Set(["nextjs", "react", "vue", "svelte", "angular", "laravel", "rails", "spring-boot", "express-nestjs", "django-fastapi", "flutter-dart", "android-kotlin", "react-native"]);
const LANGUAGE = new Set(["typescript", "python", "rust", "go", "java-kotlin", "php", "ruby", "cpp", "csharp", "shell-bash", "swift-ios", "scala", "elixir"]);
const WORKFLOW = new Set(["software-engineering", "jce-worker-operating-system", "verification-discipline", "delegation-quality", "release-engineering", "codebase-intelligence", "context-preservation"]);
const GENERIC = new Set(["frontend", "architecture", "security", "devops"]);

export function classifySkill(name: string): SkillTier {
  if (FRAMEWORK.has(name)) return "framework";
  if (LANGUAGE.has(name)) return "language";
  if (WORKFLOW.has(name)) return "workflow";
  if (GENERIC.has(name)) return "generic";
  return "domain";
}

function parseFrontmatter(text: string): Record<string, string> | undefined {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const data: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (item) data[item[1]!] = item[2]!.replace(/^['"]|['"]$/g, "");
  }
  return data;
}

export function auditSkillFile(path: string): SkillAuditResult {
  const text = readFileSync(path, "utf8");
  const folderName = basename(dirname(path));
  const frontmatter = parseFrontmatter(text);
  const findings: SkillAuditFinding[] = [];
  let score = 100;
  if (!frontmatter) { score -= 20; findings.push({ severity: "warning", message: "Missing YAML frontmatter." }); }
  if (frontmatter?.name && frontmatter.name !== folderName) { score -= 15; findings.push({ severity: "error", message: `Frontmatter name '${frontmatter.name}' does not match folder '${folderName}'.` }); }
  const description = frontmatter?.description;
  if (!description || description.length < 40) { score -= 15; findings.push({ severity: "warning", message: "Description is missing or too short for reliable routing." }); }
  if (!/\b(use|gunakan|when|loaded|trigger|untuk)\b/i.test(description ?? text.slice(0, 400))) { score -= 10; findings.push({ severity: "warning", message: "Trigger/use-case language is weak." }); }
  if (!/verify|verification|test|validasi|evidence|bukti/i.test(text)) { score -= 15; findings.push({ severity: "warning", message: "No explicit verification/evidence guidance found." }); }
  if (!/workflow|protocol|checklist|steps?|langkah/i.test(text)) { score -= 10; findings.push({ severity: "warning", message: "No clear workflow/checklist found." }); }
  if (text.length > 12000) { score -= 5; findings.push({ severity: "info", message: "Skill is large; consider splitting or summarizing." }); }
  return { name: frontmatter?.name ?? folderName, path, score: Math.max(0, score), findings, hasFrontmatter: Boolean(frontmatter), description };
}

export function auditSkills(skillsDir: string): SkillAuditReport {
  const paths = existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(skillsDir, entry.name, "SKILL.md")).filter(existsSync) : [];
  const results = paths.map(auditSkillFile).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  return { total: results.length, averageScore: results.length ? Math.round(totalScore / results.length) : 0, results, errors: results.flatMap((r) => r.findings).filter((f) => f.severity === "error").length, warnings: results.flatMap((r) => r.findings).filter((f) => f.severity === "warning").length };
}

export function resolveSkillConflicts(skills: string[], max = 4): SkillConflictResolution {
  const unique = [...new Set(skills)];
  const selected: string[] = [];
  const suppressed: { skill: string; reason: string }[] = [];
  const has = (name: string) => unique.includes(name);
  const suppress = (skill: string, reason: string) => suppressed.push({ skill, reason });
  for (const skill of unique) {
    if (skill === "frontend" && (has("react") || has("nextjs") || has("vue") || has("svelte") || has("angular"))) { suppress(skill, "Specific frontend framework skill covers this task."); continue; }
    if (skill === "react" && has("nextjs")) { suppress(skill, "Next.js skill includes React-specific guidance for this task."); continue; }
    if (skill === "php" && has("laravel")) { suppress(skill, "Laravel skill is more specific than generic PHP."); continue; }
    if (skill === "java-kotlin" && has("android-kotlin")) { suppress(skill, "Android Kotlin skill is more specific than generic JVM guidance."); continue; }
    if (skill === "security" && has("android-security")) { suppress(skill, "Android security skill is more specific for Android surfaces."); continue; }
    selected.push(skill);
  }
  const rank = (skill: string) => ({ framework: 0, domain: 1, language: 2, workflow: 3, generic: 4 }[classifySkill(skill)] ?? 9);
  const ranked = selected.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const limited = ranked.slice(0, max);
  for (const skill of ranked.slice(max)) suppress(skill, `Limited to top ${max} skills for token discipline.`);
  return { selected: limited, suppressed };
}

export function buildCapabilityRegistry(): CapabilityRegistry {
  return { capabilities: [
    { id: "jce.skill-audit", title: "Skill quality audit and scoring", domains: ["jce", "skills"], agents: ["jce-worker"], skills: ["jce-worker-operating-system", "verification-discipline"], tools: [], verification: ["opencode-jce skills audit"], maturity: "advanced" },
    { id: "jce.skill-conflict-resolution", title: "Skill conflict resolution and ranking", domains: ["jce", "routing"], agents: ["jce-worker"], skills: ["delegation-quality"], tools: [], verification: ["opencode-jce skills resolve"], maturity: "advanced" },
    { id: "jce.capability-registry", title: "Capability registry and explainable discovery", domains: ["jce"], agents: ["jce-worker"], skills: ["codebase-intelligence"], tools: [], verification: ["opencode-jce capabilities list"], maturity: "advanced" },
    { id: "jce.behavior-doctor", title: "JCE-Worker doctor for agents/skills/runtime alignment", domains: ["jce", "config"], agents: ["jce-worker"], skills: ["developer-tooling"], tools: [], verification: ["opencode-jce jce-worker doctor"], maturity: "advanced" },
    { id: "jce.evidence-store", title: "Evidence store and export", domains: ["verification"], agents: ["jce-worker"], skills: ["verification-discipline"], tools: [], verification: ["opencode-jce evidence list"], maturity: "baseline" },
    { id: "jce.docs-generation", title: "Generated documentation from agents, skills, and capabilities", domains: ["docs"], agents: ["technical-writer"], skills: ["codebase-intelligence"], tools: [], verification: ["opencode-jce docs generate --check"], maturity: "baseline" },
    { id: "jce.telemetry", title: "Local non-PII skill and workflow telemetry", domains: ["analytics"], agents: ["jce-worker"], skills: ["observability"], tools: [], verification: ["opencode-jce analytics"], maturity: "baseline" },
    { id: "android.advanced-flow", title: "Android project diagnostics, verification, security, release readiness", domains: ["android"], agents: ["android"], skills: ["android-kotlin", "android-gradle", "android-security"], tools: ["android_logcat"], verification: ["./gradlew test", "./gradlew assembleDebug"], maturity: "advanced" },
    { id: "flutter.advanced-flow", title: "Flutter diagnostics, platform verification, release readiness", domains: ["flutter"], agents: ["mobile-dev"], skills: ["flutter-dart"], tools: [], verification: ["flutter analyze", "flutter test"], maturity: "advanced" },
    { id: "nextjs.advanced-flow", title: "Next.js route/component/env/build diagnostics", domains: ["web", "nextjs"], agents: ["frontend"], skills: ["nextjs", "react", "typescript"], tools: [], verification: ["npm run build", "npm test"], maturity: "baseline" },
    { id: "react.advanced-flow", title: "React component/hooks/accessibility/test diagnostics", domains: ["web", "react"], agents: ["frontend"], skills: ["react", "typescript"], tools: [], verification: ["npm test", "npm run lint"], maturity: "baseline" },
    { id: "node-api.advanced-flow", title: "Node/API endpoint/auth/schema verification planning", domains: ["api", "node"], agents: ["backend"], skills: ["express-nestjs", "api-design-patterns", "security"], tools: [], verification: ["npm test", "npm run typecheck"], maturity: "baseline" },
    { id: "devops-ci.advanced-flow", title: "Docker/CI workflow readiness and risk checks", domains: ["devops", "ci"], agents: ["devops"], skills: ["devops"], tools: [], verification: ["docker build", "actionlint"], maturity: "baseline" },
    { id: "security.advanced-flow", title: "Threat model, secrets, auth boundary, dependency risk baseline", domains: ["security"], agents: ["security"], skills: ["security", "auth-identity"], tools: [], verification: ["security scan", "test suite"], maturity: "baseline" },
  ] };
}

export function assessJceDoctor(root: string): JceDoctorReport {
  const checks: JceDoctorReport["checks"] = [];
  const add = (name: string, status: "pass" | "warning" | "fail", message: string) => checks.push({ name, status, message });
  const skillsDir = join(root, "config", "skills");
  const agentsPath = join(root, "config", "agents.json");
  add("agents.json", existsSync(agentsPath) ? "pass" : "fail", existsSync(agentsPath) ? "Agent registry exists." : "Missing config/agents.json.");
  const skillCount = existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length : 0;
  add("skills", skillCount >= 50 ? "pass" : "warning", `${skillCount} skill directories detected.`);
  const capabilities = buildCapabilityRegistry().capabilities.length;
  add("capabilities", capabilities >= 10 ? "pass" : "warning", `${capabilities} capabilities registered.`);
  add("context-keeper", existsSync(join(root, "src", "mcp", "context-keeper.ts")) ? "pass" : "warning", "Context keeper source checked.");
  const summary = { pass: checks.filter((c) => c.status === "pass").length, warning: checks.filter((c) => c.status === "warning").length, fail: checks.filter((c) => c.status === "fail").length };
  return { checks, summary };
}

export function evidencePath(root: string): string { return join(root, ".opencode-jce", "evidence.json"); }
export function telemetryPath(root: string): string { return join(root, ".opencode-jce", "telemetry.json"); }

export function loadEvidence(root: string): EvidenceRecord[] {
  const path = evidencePath(root);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed as EvidenceRecord[] : [];
}

export function appendEvidence(root: string, record: Omit<EvidenceRecord, "id" | "timestamp">): EvidenceRecord {
  const records = loadEvidence(root);
  const saved: EvidenceRecord = { ...record, id: `ev-${Date.now()}-${records.length + 1}`, timestamp: new Date().toISOString() };
  const path = evidencePath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify([...records, saved], null, 2) + "\n", "utf8");
  return saved;
}

export function loadTelemetry(root: string): TelemetryEvent[] {
  const path = telemetryPath(root);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed as TelemetryEvent[] : [];
}

export function summarizeTelemetry(events: TelemetryEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, event) => { const key = `${event.kind}:${event.name}`; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
}

export function generateCapabilitiesMarkdown(registry = buildCapabilityRegistry()): string {
  const rows = registry.capabilities.map((cap) => `| ${cap.id} | ${cap.title} | ${cap.agents.join(", ")} | ${cap.skills.join(", ")} | ${cap.maturity} |`);
  return ["# JCE Capability Matrix", "", "| ID | Title | Agents | Skills | Maturity |", "|---|---|---|---|---|", ...rows, ""].join("\n");
}
