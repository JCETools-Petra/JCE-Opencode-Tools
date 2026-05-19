import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

export interface WebProjectProfile { detected: boolean; framework: "nextjs" | "react" | "unknown"; signals: string[]; verification: string[]; risks: string[] }
export interface WebRouteInfo { path: string; kind: "page" | "layout" | "route" | "component"; dynamic: boolean; serverAction: boolean; clientComponent: boolean }
export interface WebProjectScan extends WebProjectProfile { routes: WebRouteInfo[]; stateHooks: string[]; accessibilityRisks: string[]; envKeys: string[] }

export function buildWebAdvancedFlow(files: string[]): WebProjectProfile {
  const corpus = files.join("\n").toLowerCase();
  const next = /next\.config|app\/|pages\/|server action|route\.ts/.test(corpus);
  const react = next || /src\/.*\.(tsx|jsx)|useeffect|usestate|vite\.config/.test(corpus);
  const signals = [next ? "nextjs routing/build surface" : undefined, react ? "react component surface" : undefined, /\.env|process\.env/.test(corpus) ? "environment config" : undefined].filter(Boolean) as string[];
  const verification = next ? ["npm run build", "npm test"] : react ? ["npm test", "npm run lint"] : [];
  const risks = [next ? "Server/client boundary and caching behavior require build verification." : undefined, /dangerouslysetinnerhtml|innerhtml/.test(corpus) ? "Potential XSS-prone rendering path." : undefined].filter(Boolean) as string[];
  return { detected: react || next, framework: next ? "nextjs" : react ? "react" : "unknown", signals, verification, risks };
}

function walk(root: string, max = 200): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    if (out.length >= max || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(tsx|jsx|ts|js|mjs|cjs)$|^package\.json$|^next\.config\./.test(entry.name)) out.push(path);
    }
  };
  visit(root);
  return out;
}

export function scanWebProject(root: string): WebProjectScan {
  const paths = walk(root);
  const rels = paths.map((path) => relative(root, path).replace(/\\/g, "/"));
  const base = buildWebAdvancedFlow(rels);
  const routes: WebRouteInfo[] = [];
  const stateHooks = new Set<string>();
  const accessibilityRisks: string[] = [];
  const envKeys = new Set<string>();
  for (const path of paths) {
    const rel = relative(root, path).replace(/\\/g, "/");
    const text = readFileSync(path, "utf8");
    const isRoute = /(?:^|\/)route\.(ts|js)$/.test(rel);
    const isPage = /(?:^|\/)page\.(tsx|jsx|ts|js)$/.test(rel);
    const isLayout = /(?:^|\/)layout\.(tsx|jsx|ts|js)$/.test(rel);
    const isComponent = /\.(tsx|jsx)$/.test(rel) && !isPage && !isLayout;
    if (isRoute || isPage || isLayout || isComponent) routes.push({ path: rel, kind: isRoute ? "route" : isPage ? "page" : isLayout ? "layout" : "component", dynamic: /\[[^\]]+\]/.test(rel), serverAction: /['"]use server['"]/.test(text), clientComponent: /['"]use client['"]/.test(text) });
    for (const hook of text.matchAll(/\b(useState|useEffect|useReducer|useMemo|useCallback|useContext)\b/g)) stateHooks.add(hook[1]!);
    if (/<img\b(?![^>]*\balt=)/i.test(text)) accessibilityRisks.push(`${rel}: img without alt`);
    if (/<button\b(?![^>]*>|[^<]*<\/button>)/i.test(text)) accessibilityRisks.push(`${rel}: button content should be verified`);
    for (const env of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) envKeys.add(env[1]!);
  }
  const risks = [...base.risks, ...accessibilityRisks, routes.some((r) => r.serverAction) ? "Server Actions require auth/input validation review." : undefined].filter(Boolean) as string[];
  return { ...base, detected: base.detected || routes.length > 0, routes, stateHooks: [...stateHooks], accessibilityRisks, envKeys: [...envKeys], risks };
}
