import { Command } from "commander";
import chalk from "chalk";
import { TokenTracker } from "../lib/tokens.js";
import { getConfigDir } from "../lib/config.js";
import { heading, info, error } from "../lib/ui.js";
import { logCommandStart, logCommandSuccess } from "../lib/logger.js";
import { EXIT_SUCCESS } from "../types.js";

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

export const tokensCommand = new Command("tokens")
  .description("Show token usage and estimated costs")
  .option("-p, --period <period>", "Time period: today, week, month", "today")
  .action(async (options: { period: string }) => {
    logCommandStart("tokens", { period: options.period });

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
      info("Usage is tracked automatically when making API requests.");
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
    logCommandSuccess("tokens", `period=${options.period} entries=${entries.length} cost=${totalCost.toFixed(4)}`);
    process.exit(EXIT_SUCCESS);
  });
