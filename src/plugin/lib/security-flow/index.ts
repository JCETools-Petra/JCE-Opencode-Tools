import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

export interface SecurityAdvancedFlow { detected: boolean; threatModel: string[]; verification: string[]; risks: string[] }
export interface SecurityFinding { id: string; severity: "low" | "medium" | "high" | "critical"; file: string; type: string; evidence: string; remediation: string }
export interface SecurityProjectScan extends SecurityAdvancedFlow { findings: SecurityFinding[]; filesScanned: number }

export function buildSecurityAdvancedFlow(files: string[]): SecurityAdvancedFlow {
  const corpus = files.join("\n").toLowerCase();
  const threatModel = [/auth|jwt|oauth|session/.test(corpus) ? "identity/session assets" : undefined, /upload|file|path/.test(corpus) ? "file/path trust boundary" : undefined, /sql|query|database/.test(corpus) ? "database injection boundary" : undefined, /webview|cors|csrf|xss/.test(corpus) ? "web security boundary" : undefined].filter(Boolean) as string[];
  return { detected: threatModel.length > 0, threatModel, verification: ["dependency audit", "targeted security tests"], risks: [/secret|api_key|password|token/.test(corpus) ? "Potential secret-bearing code path; scan before commit." : undefined].filter(Boolean) as string[] };
}

function walk(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    if (!existsSync(dir) || out.length > 250) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "build"].includes(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(ts|js|tsx|jsx|json|yml|yaml|env|properties|xml)$|Dockerfile/i.test(entry.name)) out.push(path);
    }
  };
  visit(root);
  return out;
}

export function scanSecurityProject(root: string): SecurityProjectScan {
  const paths = walk(root);
  const findings: SecurityFinding[] = [];
  let sequence = 1;
  const add = (severity: SecurityFinding["severity"], file: string, type: string, evidence: string, remediation: string) => findings.push({ id: `SEC-${String(sequence++).padStart(3, "0")}`, severity, file, type, evidence, remediation });
  for (const path of paths) {
    const rel = relative(root, path).replace(/\\/g, "/");
    let text: string;
    try { text = readFileSync(path, "utf8"); } catch { continue; }
    if (/api[_-]?key\s*[:=]\s*['"][^'"]{12,}/i.test(text) || /password\s*[:=]\s*['"][^'"]{8,}/i.test(text)) add("critical", rel, "secret", "Hardcoded credential-like value", "Move secrets to environment/secret manager and rotate exposed values.");
    if (/dangerouslySetInnerHTML|innerHTML\s*=/.test(text)) add("high", rel, "xss", "Raw HTML rendering sink", "Sanitize trusted HTML and prefer safe rendering APIs.");
    if (/exec\(|spawn\(|system\(/.test(text) && !/allowlist|sanitize|validate/i.test(text)) add("high", rel, "command-injection", "Shell execution without visible validation", "Validate against allowlists and avoid shell interpolation.");
    if (/SELECT[\s\S]*\$\{|query\([^)]*\+/.test(text)) add("high", rel, "sql-injection", "Potential string-built SQL", "Use parameterized queries or query builder bindings.");
    if (/cors\(\s*\{?\s*origin\s*:\s*['"]\*/i.test(text)) add("medium", rel, "cors", "Wildcard CORS origin", "Restrict CORS origins per environment.");
    if (/verify\s*:\s*false|rejectUnauthorized\s*:\s*false/i.test(text)) add("high", rel, "tls", "TLS verification disabled", "Do not disable certificate verification outside controlled tests.");
  }
  const base = buildSecurityAdvancedFlow(paths.map((path) => relative(root, path)));
  return { ...base, detected: base.detected || findings.length > 0, findings, filesScanned: paths.length, risks: [...base.risks, ...findings.map((f) => `${f.id} ${f.severity}: ${f.file} ${f.type}`)] };
}
