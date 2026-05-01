import { Command } from "commander";
import chalk from "chalk";
import { TokenTracker } from "../lib/tokens.js";
import { getConfigDir } from "../lib/config.js";
import { heading, info, success, error } from "../lib/ui.js";
import { logCommandStart, logCommandSuccess, logCommandError } from "../lib/logger.js";
import { EXIT_SUCCESS, EXIT_ERROR } from "../types.js";

/**
 * Format a cost value as USD.
 */
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count with thousands separator.
 */
function formatTokens(count: number): string {
  return count.toLocaleString();
}

// ─── Subcommands ─────────────────────────────────────────────

const showCommand = new Command("show")
  .description("Show token usage and estimated costs")
  .option("-p, --period <period>", "Time period: today, week, month", "today")
  .action(async (options: { period: string }) => {
    logCommandStart("tokens show", { period: options.period });

    const configDir = getConfigDir();
    const tracker = new TokenTracker(configDir);

    let entries;
    let periodLabel: string;

    switch (options.period) {
      case "week":
        entries = tracker.getThisWeek();
        periodLabel = "This Week (last 7 days)";
        break;
      case "month":
        entries = tracker.getThisMonth();
        periodLabel = "This Month";
        break;
      case "today":
      default:
        entries = tracker.getToday();
        periodLabel = "Today";
        break;
    }

    heading(`Token Usage — ${periodLabel}`);
    console.log();

    if (entries.length === 0) {
      info("No usage data recorded for this period.");
      info("Record usage with: opencode-jce tokens record --provider <provider> --model <model> --input <n> --output <n>");
      process.exit(EXIT_SUCCESS);
    }

    // Summary
    const totalTokens = tracker.getTotalTokens(entries);
    const totalCost = tracker.getTotalCost(entries);

    console.log(`  ${chalk.bold("Requests:")}      ${entries.length}`);
    console.log(`  ${chalk.bold("Input Tokens:")}  ${formatTokens(totalTokens.input)}`);
    console.log(`  ${chalk.bold("Output Tokens:")} ${formatTokens(totalTokens.output)}`);
    console.log(`  ${chalk.bold("Total Tokens:")}  ${formatTokens(totalTokens.input + totalTokens.output)}`);
    console.log(`  ${chalk.bold("Est. Cost:")}     ${chalk.yellow(formatCost(totalCost))}`);

    // Breakdown by provider
    const byProvider = tracker.getByProvider(entries);
    if (Object.keys(byProvider).length > 0) {
      heading("By Provider");
      console.log();
      for (const [provider, cost] of Object.entries(byProvider)) {
        const bar = "█".repeat(Math.max(1, Math.round((cost / totalCost) * 20)));
        console.log(`  ${chalk.bold(provider.padEnd(12))} ${formatCost(cost).padEnd(10)} ${chalk.cyan(bar)}`);
      }
    }

    // Breakdown by agent
    const byAgent = tracker.getByAgent(entries);
    if (Object.keys(byAgent).length > 0) {
      heading("By Agent");
      console.log();
      for (const [agent, cost] of Object.entries(byAgent)) {
        const bar = "█".repeat(Math.max(1, Math.round((cost / totalCost) * 20)));
        console.log(`  ${chalk.bold(agent.padEnd(12))} ${formatCost(cost).padEnd(10)} ${chalk.magenta(bar)}`);
      }
    }

    console.log();
    logCommandSuccess("tokens show", `period=${options.period} entries=${entries.length} cost=${totalCost.toFixed(4)}`);
    process.exit(EXIT_SUCCESS);
  });

const recordCommand = new Command("record")
  .description("Record a token usage entry (for integration with external tools)")
  .requiredOption("--provider <provider>", "Provider name (e.g. anthropic, openai)")
  .requiredOption("--model <model>", "Model name (e.g. claude-sonnet-4-20250514)")
  .requiredOption("--input <tokens>", "Number of input tokens", parseInt)
  .requiredOption("--output <tokens>", "Number of output tokens", parseInt)
  .option("--agent <agent>", "Agent name", "default")
  .option("--cost <cost>", "Estimated cost in USD (auto-calculated if omitted)", parseFloat)
  .action(async (options: {
    provider: string;
    model: string;
    input: number;
    output: number;
    agent: string;
    cost?: number;
  }) => {
    logCommandStart("tokens record", options);

    if (isNaN(options.input) || isNaN(options.output) || options.input < 0 || options.output < 0) {
      error("Input and output tokens must be non-negative numbers.");
      logCommandError("tokens record", "Invalid token counts");
      process.exit(EXIT_ERROR);
    }

    const configDir = getConfigDir();
    const tracker = new TokenTracker(configDir);

    // Auto-calculate cost if not provided
    const cost = options.cost ?? estimateCost(options.model, options.input, options.output);

    tracker.record({
      timestamp: new Date().toISOString(),
      provider: options.provider,
      model: options.model,
      agent: options.agent,
      inputTokens: options.input,
      outputTokens: options.output,
      cost,
    });

    success(`Recorded: ${options.input} input + ${options.output} output tokens (${options.provider}/${options.model})`);
    if (cost > 0) {
      info(`  Estimated cost: $${cost.toFixed(4)}`);
    }

    logCommandSuccess("tokens record", `provider=${options.provider} model=${options.model}`);
    process.exit(EXIT_SUCCESS);
  });

const resetCommand = new Command("reset")
  .description("Clear all token usage data for the current month")
  .option("--confirm", "Skip confirmation")
  .action(async (options: { confirm?: boolean }) => {
    logCommandStart("tokens reset");

    if (!options.confirm) {
      error("This will delete all usage data for the current month.");
      info("Run with --confirm to proceed: opencode-jce tokens reset --confirm");
      process.exit(EXIT_ERROR);
    }

    const configDir = getConfigDir();
    const tracker = new TokenTracker(configDir);

    // Record empty to overwrite
    const now = new Date();
    const { existsSync } = await import("fs");
    const { unlink } = await import("fs/promises");
    const { join } = await import("path");

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const filePath = join(configDir, "usage", `${year}-${month}.json`);

    if (existsSync(filePath)) {
      await unlink(filePath);
      success("Usage data cleared for the current month.");
    } else {
      info("No usage data to clear.");
    }

    logCommandSuccess("tokens reset");
    process.exit(EXIT_SUCCESS);
  });

// ─── Cost Estimation ─────────────────────────────────────────

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku-20241022": { input: 0.0008, output: 0.004 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "o3": { input: 0.01, output: 0.04 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K[model];
  if (!rates) return 0;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

// ─── Main Command ────────────────────────────────────────────

export const tokensCommand = new Command("tokens")
  .description("Track and manage token usage and costs")
  .addCommand(showCommand)
  .addCommand(recordCommand)
  .addCommand(resetCommand);

// Default action: show usage (backward compatible)
tokensCommand.action(async () => {
  // If no subcommand given, default to "show"
  await showCommand.parseAsync(["show", ...process.argv.slice(3)], { from: "user" });
});
