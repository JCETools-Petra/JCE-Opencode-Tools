import { Command } from "commander";
import chalk from "chalk";
import { TokenTracker } from "../lib/tokens.js";
import { generateAnalytics, AnalyticsSummary } from "../lib/analytics.js";
import { getConfigDir } from "../lib/config.js";
import { info } from "../lib/ui.js";
import { logCommandStart, logCommandSuccess } from "../lib/logger.js";
import { EXIT_SUCCESS } from "../types.js";

// ─── Helpers ─────────────────────────────────────────────────

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case "increasing":
      return "📈 Increasing";
    case "decreasing":
      return "📉 Decreasing";
    default:
      return "➡️  Stable";
  }
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

function renderBar(value: number, maxValue: number, maxWidth: number = 24): string {
  if (maxValue === 0) return "";
  const width = Math.max(1, Math.round((value / maxValue) * maxWidth));
  return "█".repeat(width);
}

// ─── Dashboard Renderer ──────────────────────────────────────

function renderDashboard(summary: AnalyticsSummary, periodLabel: string): void {
  const width = 56;
  const border = "═".repeat(width - 2);
  const innerWidth = width - 4;

  // Top border
  console.log(chalk.cyan(`╔${border}╗`));
  console.log(chalk.cyan(`║`) + centerText("OpenCode Suite — Dashboard", innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`╠${border}╣`));

  // Summary section
  console.log(chalk.cyan(`║`) + " ".repeat(innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + padLine(`  📊 ${periodLabel}`, innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + padLine(`  ${"─".repeat(37)}`, innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + padLine(`  Requests:  ${summary.totalRequests}`, innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + padLine(`  Tokens:    ${formatTokenCount(summary.totalTokens.input)} input / ${formatTokenCount(summary.totalTokens.output)} output`, innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + padLine(`  Cost:      ${formatCost(summary.totalCost)}`, innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + padLine(`  Trend:     ${getTrendIcon(summary.costTrend)}`, innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + padLine(`  Complexity: ${summary.averageComplexity}`, innerWidth) + chalk.cyan(`║`));
  console.log(chalk.cyan(`║`) + " ".repeat(innerWidth) + chalk.cyan(`║`));

  // Top Agents
  if (summary.topAgents.length > 0) {
    console.log(chalk.cyan(`║`) + padLine(`  🏆 Top Agents`, innerWidth) + chalk.cyan(`║`));
    console.log(chalk.cyan(`║`) + padLine(`  ${"─".repeat(37)}`, innerWidth) + chalk.cyan(`║`));
    for (let i = 0; i < summary.topAgents.length; i++) {
      const agent = summary.topAgents[i];
      const line = `  ${i + 1}. ${agent.agent.padEnd(14)} ${String(agent.requests).padStart(4)} req   ${formatCost(agent.cost)}`;
      console.log(chalk.cyan(`║`) + padLine(line, innerWidth) + chalk.cyan(`║`));
    }
    console.log(chalk.cyan(`║`) + " ".repeat(innerWidth) + chalk.cyan(`║`));
  }

  // Top Models
  if (summary.topModels.length > 0) {
    console.log(chalk.cyan(`║`) + padLine(`  🤖 Top Models`, innerWidth) + chalk.cyan(`║`));
    console.log(chalk.cyan(`║`) + padLine(`  ${"─".repeat(37)}`, innerWidth) + chalk.cyan(`║`));
    for (let i = 0; i < summary.topModels.length; i++) {
      const model = summary.topModels[i];
      const line = `  ${i + 1}. ${model.model.padEnd(16)} ${String(model.requests).padStart(4)} req   ${formatCost(model.cost)}`;
      console.log(chalk.cyan(`║`) + padLine(line, innerWidth) + chalk.cyan(`║`));
    }
    console.log(chalk.cyan(`║`) + " ".repeat(innerWidth) + chalk.cyan(`║`));
  }

  // Daily Usage Chart
  if (summary.dailyUsage.length > 0) {
    const maxRequests = Math.max(...summary.dailyUsage.map((d) => d.requests));

    console.log(chalk.cyan(`║`) + padLine(`  📈 Daily Usage (last ${summary.dailyUsage.length} days)`, innerWidth) + chalk.cyan(`║`));
    console.log(chalk.cyan(`║`) + padLine(`  ${"─".repeat(37)}`, innerWidth) + chalk.cyan(`║`));
    for (const day of summary.dailyUsage) {
      const label = getDayLabel(day.date);
      const bar = renderBar(day.requests, maxRequests);
      const line = `  ${label} ${chalk.green(bar)} ${day.requests} req`;
      console.log(chalk.cyan(`║`) + padLine(line, innerWidth) + chalk.cyan(`║`));
    }
    console.log(chalk.cyan(`║`) + " ".repeat(innerWidth) + chalk.cyan(`║`));
  }

  // Bottom border
  console.log(chalk.cyan(`╚${border}╝`));
}

function centerText(text: string, width: number): string {
  const padding = Math.max(0, width - text.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return " ".repeat(left) + chalk.bold(text) + " ".repeat(right);
}

function padLine(text: string, width: number): string {
  // Strip ANSI codes for length calculation
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  const padding = Math.max(0, width - stripped.length);
  return text + " ".repeat(padding);
}

// ─── Command ─────────────────────────────────────────────────

export const dashboardCommand = new Command("dashboard")
  .description("Show a terminal-based analytics dashboard")
  .option("-p, --period <period>", "Time period: week, month, all", "month")
  .action(async (options: { period: string }) => {
    logCommandStart("dashboard", { period: options.period });

    const configDir = getConfigDir();
    const tracker = new TokenTracker(configDir);

    // Determine period and get data
    let periodLabel: string;
    let entries;
    const period = options.period as "week" | "month" | "all";

    switch (period) {
      case "week":
        entries = tracker.getThisWeek();
        periodLabel = "This Week";
        break;
      case "all":
        entries = tracker.getThisMonth(); // "all" still loads current month file
        periodLabel = "All Time (Current Month)";
        break;
      case "month":
      default:
        entries = tracker.getThisMonth();
        periodLabel = "This Month";
        break;
    }

    if (entries.length === 0) {
      console.log();
      info("No usage data available for the selected period.");
      info("Usage is tracked automatically when making API requests.");
      info("Try: opencode-suite dashboard --period week");
      process.exit(EXIT_SUCCESS);
    }

    // Generate analytics
    const summary = generateAnalytics(entries, period);

    console.log();
    renderDashboard(summary, periodLabel);
    console.log();

    logCommandSuccess("dashboard", `period=${period} requests=${summary.totalRequests}`);
    process.exit(EXIT_SUCCESS);
  });
