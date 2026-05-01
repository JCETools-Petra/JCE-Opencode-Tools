import { describe, test, expect } from "bun:test";
import { VERSION, GITHUB_RAW_BASE, GITHUB_REPO, COST_PER_1K } from "../../src/lib/constants.js";
import packageJson from "../../package.json";

// ─── VERSION ─────────────────────────────────────────────────

describe("VERSION", () => {
  test("matches package.json version", () => {
    expect(VERSION).toBe(packageJson.version);
  });

  test("is a valid semver string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ─── GITHUB_RAW_BASE ─────────────────────────────────────────

describe("GITHUB_RAW_BASE", () => {
  test("contains the repo name", () => {
    expect(GITHUB_RAW_BASE).toContain("JCE-Opencode-Tools");
  });

  test("starts with raw.githubusercontent.com", () => {
    expect(GITHUB_RAW_BASE).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
  });

  test("ends with /main", () => {
    expect(GITHUB_RAW_BASE).toMatch(/\/main$/);
  });

  test("is derived from GITHUB_REPO", () => {
    expect(GITHUB_RAW_BASE).toBe(
      `https://raw.githubusercontent.com/${GITHUB_REPO}/main`
    );
  });
});

// ─── COST_PER_1K ─────────────────────────────────────────────

describe("COST_PER_1K", () => {
  test("has entry for claude-sonnet", () => {
    expect(COST_PER_1K["claude-sonnet"]).toBeDefined();
  });

  test("has entry for claude-opus", () => {
    expect(COST_PER_1K["claude-opus"]).toBeDefined();
  });

  test("has entry for claude-haiku", () => {
    expect(COST_PER_1K["claude-haiku"]).toBeDefined();
  });

  test("has entry for gpt-4o", () => {
    expect(COST_PER_1K["gpt-4o"]).toBeDefined();
  });

  test("has entry for gpt-4o-mini", () => {
    expect(COST_PER_1K["gpt-4o-mini"]).toBeDefined();
  });

  test("has entry for deepseek", () => {
    expect(COST_PER_1K["deepseek"]).toBeDefined();
  });

  test("has entry for gemini-pro", () => {
    expect(COST_PER_1K["gemini-pro"]).toBeDefined();
  });

  test("has entry for gemini-flash", () => {
    expect(COST_PER_1K["gemini-flash"]).toBeDefined();
  });

  test("has at least 8 model entries", () => {
    expect(Object.keys(COST_PER_1K).length).toBeGreaterThanOrEqual(8);
  });

  test("all entries have positive input cost", () => {
    for (const [model, cost] of Object.entries(COST_PER_1K)) {
      expect(cost.input).toBeGreaterThan(0);
    }
  });

  test("all entries have positive output cost", () => {
    for (const [model, cost] of Object.entries(COST_PER_1K)) {
      expect(cost.output).toBeGreaterThan(0);
    }
  });

  test("output cost is >= input cost for all models", () => {
    for (const [model, cost] of Object.entries(COST_PER_1K)) {
      expect(cost.output).toBeGreaterThanOrEqual(cost.input);
    }
  });

  test("each entry has exactly input and output keys", () => {
    for (const [model, cost] of Object.entries(COST_PER_1K)) {
      expect(Object.keys(cost).sort()).toEqual(["input", "output"]);
    }
  });
});
