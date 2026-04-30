import { Command } from "commander";
import chalk from "chalk";
import { TokenTracker } from "../lib/tokens.js";
import { analyzeCostOptimizations } from "../lib/optimizer.js";
import { listProfiles } from "../lib/profiles.js";
import { getConfigDir } from "../lib/config.js";
import { heading, info, success, warn } from "../lib/ui.js";
import { logCommandStart, logCommandSuccess } from "../lib/logger.js";
import { EXIT_SUCCESS } from "../types.js";

export const optimizeCommand = new Command("optimize")
  .description("Analyze usage patterns and suggest cost optimizations")
  .option("-p, --period <period>", "Time period to analyze: today, week, month", "week")
  .action(async (options: { period: string }) => {
    logCommandStart("optimize", { period: options.period });

    const configDir = getConfigDir();
    const tracker = new TokenTracker(configDir);
    const profiles = await listProfiles();

    let entries;
    let periodLabel: string;

    switch (options.period) {
      case "month":
        entries = tracker.getThisMonth();
        periodLabel = "this month";
        break;
      case "today":
        entries = tracker.getToday();
        periodLabel = "today";
        break;
      case "week":
      default:
        entries = tracker.getThisWeek();
        periodLabel = "this week";
        break;
    }

    heading(`Cost Optimization — Analyzing ${periodLabel}`);
    console.log();

    if (entries.length === 0) {
      info("No usage data to analyze for this period.");
      info("Use the CLI for a while, then run this command again.");
      process.exit(EXIT_SUCCESS);
    }

    // Show current spend
    const totalCost = tracker.getTotalCost(entries);
    console.log(`  ${chalk.bold("Period:")}       ${periodLabel}`);
    console.log(`  ${chalk.bold("Requests:")}     ${entries.length}`);
    console.log(`  ${chalk.bold("Current Cost:")} ${chalk.yellow("$" + totalCost.toFixed(4))}`);
    console.log();

    // Get suggestions
    const suggestions = analyzeCostOptimizations(entries, profiles);

    if (suggestions.length === 0) {
      success("Your usage looks optimized! No suggestions at this time.");
      console.log();
      process.exit(EXIT_SUCCESS);
    }

    heading("Suggestions");
    console.log();

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      console.log(`  ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.bold(s.currentProfile)} → ${chalk.green(s.suggestedProfile)}`);
      console.log(`     ${chalk.yellow(s.estimatedSavings)}`);
      console.log(`     ${s.reason}`);
      console.log();
    }

    // Summary
    console.log("─".repeat(50));
    warn(`Found ${suggestions.length} optimization${suggestions.length > 1 ? "s" : ""} that could reduce costs.`);
    info("Use 'opencode-jce use <profile-id>' to switch profiles.");
    info("Use 'opencode-jce route <prompt>' for automatic routing.");
    console.log();

    logCommandSuccess("optimize", `suggestions=${suggestions.length}`);
    process.exit(EXIT_SUCCESS);
  });
