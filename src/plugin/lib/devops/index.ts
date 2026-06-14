import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

export interface DevopsAdvancedFlow { detected: boolean; surfaces: string[]; verification: string[]; risks: string[] }
export interface DevopsFinding { severity: "low" | "medium" | "high"; file: string; message: string; remediation: string }
export interface DevopsProjectScan extends DevopsAdvancedFlow { dockerfiles: string[]; workflows: string[]; findings: DevopsFinding[] }

export function buildDevopsAdvancedFlow(files: string[]): DevopsAdvancedFlow {
  const corpus = files.join("\n").toLowerCase();
  const surfaces = [/dockerfile|docker-compose/.test(corpus) ? "docker" : undefined, /\.github\/workflows|gitlab-ci|circleci/.test(corpus) ? "ci" : undefined, /terraform|helm|kubernetes|k8s/.test(corpus) ? "infrastructure" : undefined].filter(Boolean) as string[];
  return { detected: surfaces.length > 0, surfaces, verification: ["docker build .", "opencode-jce validate"], risks: [/secret|token|password/.test(corpus) ? "Secret handling must be verified before commit." : undefined].filter(Boolean) as string[] };
}

function walk(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    if (!existsSync(dir) || out.length > 200) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/Dockerfile|docker-compose|\.ya?ml$|\.tf$/.test(entry.name)) out.push(path);
    }
  };
  visit(root);
  return out;
}

export function scanDevopsProject(root: string): DevopsProjectScan {
  const paths = walk(root);
  const dockerfiles: string[] = [];
  const workflows: string[] = [];
  const findings: DevopsFinding[] = [];
  for (const path of paths) {
    const rel = relative(root, path).replace(/\\/g, "/");
    let text: string;
    try { text = readFileSync(path, "utf8"); } catch { continue; }
    if (/dockerfile/i.test(rel)) {
      dockerfiles.push(rel);
      if (/FROM\s+[^\s:]+\s*(\n|$)/i.test(text)) findings.push({ severity: "medium", file: rel, message: "Base image is not pinned to an explicit tag.", remediation: "Pin image tags or digests for reproducible builds." });
      if (/USER\s+root/i.test(text) || !/\nUSER\s+/i.test(text)) findings.push({ severity: "medium", file: rel, message: "Container user hardening not detected.", remediation: "Run as a non-root user where possible." });
      if (/ADD\s+/i.test(text)) findings.push({ severity: "low", file: rel, message: "ADD instruction detected.", remediation: "Prefer COPY unless archive/remote URL behavior is required." });
    }
    if (/\.github\/workflows\//.test(rel) || /workflow|jobs:/i.test(text)) {
      workflows.push(rel);
      if (/pull_request_target/i.test(text)) findings.push({ severity: "high", file: rel, message: "pull_request_target can expose secrets to untrusted code.", remediation: "Use pull_request unless privileged write-token behavior is required and isolated." });
      if (!/permissions:/i.test(text)) findings.push({ severity: "medium", file: rel, message: "Workflow permissions are not explicitly scoped.", remediation: "Set least-privilege permissions at workflow or job level." });
      if (/secrets\./i.test(text)) findings.push({ severity: "medium", file: rel, message: "Workflow consumes secrets.", remediation: "Verify environment protection, masking, and trusted event triggers." });
    }
  }
  const base = buildDevopsAdvancedFlow(paths.map((path) => relative(root, path)));
  return { ...base, detected: base.detected || dockerfiles.length > 0 || workflows.length > 0, dockerfiles, workflows, findings, risks: [...base.risks, ...findings.map((f) => `${f.file}: ${f.message}`)] };
}
