import { Command } from "commander";
import { buildCapabilityRegistry, generateCapabilitiesMarkdown } from "../plugin/lib/jce-intelligence.js";
import { heading, info, success } from "../lib/ui.js";

export const capabilitiesCommand = new Command("capabilities")
  .description("Inspect JCE capability registry")
  .addCommand(new Command("list")
    .description("List registered capabilities")
    .option("--json", "Print JSON")
    .action((options) => {
      const registry = buildCapabilityRegistry();
      if (options.json) { console.log(JSON.stringify(registry, null, 2)); return; }
      heading("JCE Capabilities");
      for (const cap of registry.capabilities) success(`${cap.id} — ${cap.title} (${cap.maturity})`);
      info(`${registry.capabilities.length} capabilities registered.`);
    }))
  .addCommand(new Command("explain")
    .description("Explain a single capability")
    .argument("id", "Capability id")
    .option("--json", "Print JSON")
    .action((id, options) => {
      const cap = buildCapabilityRegistry().capabilities.find((item) => item.id === id);
      if (!cap) { console.error(`Capability not found: ${id}`); process.exitCode = 1; return; }
      if (options.json) { console.log(JSON.stringify(cap, null, 2)); return; }
      heading(cap.id);
      info(cap.title);
      console.log(`Agents: ${cap.agents.join(", ")}`);
      console.log(`Skills: ${cap.skills.join(", ")}`);
      console.log(`Verification: ${cap.verification.join(", ")}`);
    }))
  .addCommand(new Command("markdown")
    .description("Print capability matrix markdown")
    .action(() => console.log(generateCapabilitiesMarkdown())));
