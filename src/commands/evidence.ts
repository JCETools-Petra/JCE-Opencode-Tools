import { Command } from "commander";
import { appendEvidence, loadEvidence } from "../plugin/lib/jce-intelligence.js";
import { heading, info, success } from "../lib/ui.js";

export const evidenceCommand = new Command("evidence")
  .description("Manage local JCE verification evidence")
  .addCommand(new Command("list")
    .description("List stored evidence")
    .option("--json", "Print JSON")
    .action((options) => {
      const records = loadEvidence(process.cwd());
      if (options.json) { console.log(JSON.stringify(records, null, 2)); return; }
      heading("Evidence Store");
      for (const record of records.slice(-20)) success(`${record.id} [${record.status}] ${record.summary}`);
      info(`${records.length} evidence records.`);
    }))
  .addCommand(new Command("add")
    .description("Add a manual evidence record")
    .requiredOption("--task <id>", "Task id")
    .requiredOption("--summary <text>", "Evidence summary")
    .option("--type <type>", "Evidence type", "manual")
    .option("--status <status>", "Evidence status", "unknown")
    .option("--command <command>", "Command used")
    .action((options) => {
      const record = appendEvidence(process.cwd(), { taskId: options.task, summary: options.summary, type: options.type, status: options.status, command: options.command });
      success(`Recorded ${record.id}`);
    }));
