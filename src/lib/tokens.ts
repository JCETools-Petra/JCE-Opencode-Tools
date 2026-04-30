import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

// ─── Types ───────────────────────────────────────────────────

export interface TokenUsageEntry {
  timestamp: string;
  provider: string;
  model: string;
  agent: string;
  inputTokens: number;
  outputTokens: number;
  cost: number; // estimated USD
}

interface MonthlyUsageFile {
  entries: TokenUsageEntry[];
}

// ─── Constants ───────────────────────────────────────────────

const USAGE_DIR = "usage";

// ─── Token Tracker Class ─────────────────────────────────────

export class TokenTracker {
  private configDir: string;
  private usageDir: string;

  constructor(configDir: string) {
    this.configDir = configDir;
    this.usageDir = join(configDir, USAGE_DIR);
  }

  /**
   * Ensure the usage directory exists.
   */
  private ensureUsageDir(): void {
    if (!existsSync(this.usageDir)) {
      mkdirSync(this.usageDir, { recursive: true });
    }
  }

  /**
   * Get the filename for a given month (YYYY-MM.json).
   */
  private getMonthlyFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}.json`;
  }

  /**
   * Get the full path to a monthly usage file.
   */
  private getMonthlyFilePath(date: Date): string {
    return join(this.usageDir, this.getMonthlyFilename(date));
  }

  /**
   * Load entries from a monthly file.
   */
  private loadMonthlyFile(date: Date): TokenUsageEntry[] {
    const filePath = this.getMonthlyFilePath(date);

    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const data = JSON.parse(content) as MonthlyUsageFile;
      return data.entries || [];
    } catch {
      return [];
    }
  }

  /**
   * Save entries to a monthly file.
   */
  private saveMonthlyFile(date: Date, entries: TokenUsageEntry[]): void {
    this.ensureUsageDir();
    const filePath = this.getMonthlyFilePath(date);
    const data: MonthlyUsageFile = { entries };
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Record a new token usage entry.
   */
  record(entry: TokenUsageEntry): void {
    const date = new Date(entry.timestamp);
    const entries = this.loadMonthlyFile(date);
    entries.push(entry);
    this.saveMonthlyFile(date, entries);
  }

  /**
   * Get all entries for today.
   */
  getToday(): TokenUsageEntry[] {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const entries = this.loadMonthlyFile(now);
    return entries.filter((e) => e.timestamp.startsWith(todayStr));
  }

  /**
   * Get all entries for this week (last 7 days).
   */
  getThisWeek(): TokenUsageEntry[] {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // May span two months
    const entries: TokenUsageEntry[] = [];
    entries.push(...this.loadMonthlyFile(now));

    if (weekAgo.getMonth() !== now.getMonth()) {
      entries.push(...this.loadMonthlyFile(weekAgo));
    }

    return entries.filter((e) => new Date(e.timestamp) >= weekAgo);
  }

  /**
   * Get all entries for this month.
   */
  getThisMonth(): TokenUsageEntry[] {
    const now = new Date();
    return this.loadMonthlyFile(now);
  }

  /**
   * Calculate total cost from a set of entries.
   */
  getTotalCost(entries: TokenUsageEntry[]): number {
    return entries.reduce((sum, e) => sum + e.cost, 0);
  }

  /**
   * Get total tokens (input + output) from entries.
   */
  getTotalTokens(entries: TokenUsageEntry[]): { input: number; output: number } {
    return entries.reduce(
      (acc, e) => ({
        input: acc.input + e.inputTokens,
        output: acc.output + e.outputTokens,
      }),
      { input: 0, output: 0 }
    );
  }

  /**
   * Group cost by provider.
   */
  getByProvider(entries: TokenUsageEntry[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of entries) {
      result[entry.provider] = (result[entry.provider] || 0) + entry.cost;
    }
    return result;
  }

  /**
   * Group cost by agent.
   */
  getByAgent(entries: TokenUsageEntry[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of entries) {
      result[entry.agent] = (result[entry.agent] || 0) + entry.cost;
    }
    return result;
  }
}
