import { Command } from "commander";
import { loadTelemetry, summarizeTelemetry } from "../plugin/lib/jce-intelligence.js";
import { heading, info, success } from "../lib/ui.js";

export const analyticsCommand = new Command("analytics")
  .description("Show local non-PII JCE telemetry summary")
  .option("--json", "Print JSON")
  .action((options) => {
    const events = loadTelemetry(process.cwd());
    const summary = summarizeTelemetry(events);
    if (options.json) { console.log(JSON.stringify({ events: events.length, summary }, null, 2)); return; }
    heading("JCE Analytics");
    for (const [key, value] of Object.entries(summary).sort((a, b) => b[1] - a[1])) success(`${key}: ${value}`);
    info(`${events.length} telemetry events.`);
  });
