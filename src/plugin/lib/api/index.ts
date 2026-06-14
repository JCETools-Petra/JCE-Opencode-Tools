import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

export interface ApiAdvancedFlow { detected: boolean; surfaces: string[]; verification: string[]; risks: string[] }
export interface ApiEndpoint { file: string; methods: string[]; authSignals: string[]; validationSignals: string[]; databaseSignals: string[] }
export interface ApiProjectScan extends ApiAdvancedFlow { endpoints: ApiEndpoint[]; authFiles: string[]; schemaFiles: string[] }

export function buildApiAdvancedFlow(files: string[]): ApiAdvancedFlow {
  const corpus = files.join("\n").toLowerCase();
  const surfaces = [/route\.|controller|endpoint|express|nestjs|fastify/.test(corpus) ? "http endpoints" : undefined, /jwt|session|passport|oauth|auth/.test(corpus) ? "auth boundary" : undefined, /zod|joi|yup|validator|schema/.test(corpus) ? "validation schema" : undefined, /prisma|typeorm|sequelize|knex|sql/.test(corpus) ? "database access" : undefined].filter(Boolean) as string[];
  return { detected: surfaces.length > 0, surfaces, verification: ["npm run typecheck", "npm test"], risks: surfaces.includes("auth boundary") ? ["Authorization and IDOR checks require targeted tests."] : [] };
}

function walk(root: string, max = 200): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    if (out.length >= max || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".next") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(ts|js|tsx|jsx)$/.test(entry.name)) out.push(path);
    }
  };
  visit(root);
  return out;
}

export function scanApiProject(root: string): ApiProjectScan {
  const paths = walk(root);
  const endpoints: ApiEndpoint[] = [];
  const authFiles: string[] = [];
  const schemaFiles: string[] = [];
  for (const path of paths) {
    const rel = relative(root, path).replace(/\\/g, "/");
    let text: string;
    try { text = readFileSync(path, "utf8"); } catch { continue; }
    const methods = [...new Set([...text.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]!))];
    const isEndpoint = methods.length > 0 || /router\.|app\.(get|post|put|patch|delete)|@Controller|route\./i.test(text + rel);
    const authSignals = [...new Set([...text.matchAll(/\b(jwt|session|passport|oauth|auth|guard|middleware)\b/gi)].map((m) => m[1]!.toLowerCase()))];
    const validationSignals = [...new Set([...text.matchAll(/\b(zod|joi|yup|schema|parse|safeParse|validate)\b/gi)].map((m) => m[1]!.toLowerCase()))];
    const databaseSignals = [...new Set([...text.matchAll(/\b(prisma|typeorm|sequelize|knex|sql|query|repository)\b/gi)].map((m) => m[1]!.toLowerCase()))];
    if (authSignals.length) authFiles.push(rel);
    if (validationSignals.length) schemaFiles.push(rel);
    if (isEndpoint) endpoints.push({ file: rel, methods, authSignals, validationSignals, databaseSignals });
  }
  const base = buildApiAdvancedFlow(paths.map((path) => relative(root, path)));
  const risks = [...base.risks, ...endpoints.filter((e) => e.authSignals.length === 0).map((e) => `${e.file}: no auth signal detected`), ...endpoints.filter((e) => e.validationSignals.length === 0).map((e) => `${e.file}: no validation signal detected`)];
  return { ...base, detected: base.detected || endpoints.length > 0, endpoints, authFiles: [...new Set(authFiles)], schemaFiles: [...new Set(schemaFiles)], risks };
}
