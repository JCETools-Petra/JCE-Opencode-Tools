import { Command } from "commander";
import { scanApiProject } from "../plugin/lib/api/index.js";
import { scanDevopsProject } from "../plugin/lib/devops/index.js";
import { scanSecurityProject } from "../plugin/lib/security-flow/index.js";
import { scanWebProject } from "../plugin/lib/web/index.js";
import { heading, info, success, warn } from "../lib/ui.js";

type FlowKind = "web" | "api" | "devops" | "security";

function scan(kind: FlowKind, root: string): unknown {
  if (kind === "web") return scanWebProject(root);
  if (kind === "api") return scanApiProject(root);
  if (kind === "devops") return scanDevopsProject(root);
  return scanSecurityProject(root);
}

export const flowCommand = new Command("flow")
  .description("Run advanced flow scanners")
  .argument("<kind>", "web, api, devops, or security")
  .option("--root <path>", "Project root", process.cwd())
  .option("--json", "Print JSON")
  .action((kind: string, options) => {
    if (!["web", "api", "devops", "security"].includes(kind)) {
      console.error(`Unknown flow: ${kind}`);
      process.exitCode = 1;
      return;
    }
    const result = scan(kind as FlowKind, options.root);
    if (options.json) { console.log(JSON.stringify(result, null, 2)); return; }
    const data = result as { detected?: boolean; risks?: string[]; verification?: string[] };
    heading(`${kind} advanced flow`);
    data.detected ? success("Project signals detected") : warn("No strong project signals detected");
    if (data.verification?.length) info(`Verification: ${data.verification.join(", ")}`);
    for (const risk of data.risks?.slice(0, 20) ?? []) warn(risk);
  });
