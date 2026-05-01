import { describe, test, expect } from "bun:test";
import { analyzeComplexity, routeToProfile } from "../../src/lib/router.js";
import type { Profile } from "../../src/types.js";

// ─── Helpers ─────────────────────────────────────────────────

/** Minimal profile stubs for routing tests */
function makeProfiles(...ids: string[]): Profile[] {
  return ids.map((id) => ({
    id,
    name: id,
    description: `Profile ${id}`,
    provider: "anthropic" as const,
    model: "test-model",
    maxTokens: 4096,
    temperature: 0.1,
    apiKeyEnv: "TEST_KEY",
    tokenSaving: { contextTruncation: false, maxContextMessages: 10 },
  }));
}

// ─── analyzeComplexity ───────────────────────────────────────

describe("analyzeComplexity", () => {
  describe("simple prompts", () => {
    test("short greeting is simple", () => {
      expect(analyzeComplexity("hello")).toBe("simple");
    });

    test("'what is a variable?' is simple", () => {
      expect(analyzeComplexity("what is a variable?")).toBe("simple");
    });

    test("'explain this' is simple", () => {
      expect(analyzeComplexity("explain this")).toBe("simple");
    });

    test("'list all files' is simple", () => {
      expect(analyzeComplexity("list all files")).toBe("simple");
    });

    test("'define a function' is simple", () => {
      expect(analyzeComplexity("define a function")).toBe("simple");
    });

    test("'thanks' is simple", () => {
      expect(analyzeComplexity("thanks")).toBe("simple");
    });

    test("empty string is simple", () => {
      expect(analyzeComplexity("")).toBe("simple");
    });

    test("single character is simple", () => {
      expect(analyzeComplexity("x")).toBe("simple");
    });
  });

  describe("complex prompts", () => {
    test("'design a microservice architecture' is complex", () => {
      expect(analyzeComplexity("design a microservice architecture with scalability and security")).toBe("complex");
    });

    test("prompt with multiple complex keywords is complex", () => {
      expect(analyzeComplexity(
        "I need to refactor the authentication system and optimize the database queries for better performance"
      )).toBe("complex");
    });

    test("long prompt with code blocks is complex", () => {
      const prompt = "Here is my code that needs debugging:\n```\nfunction broken() {\n  return undefined;\n}\n```\nIt has a concurrency issue with the distributed system.";
      expect(analyzeComplexity(prompt)).toBe("complex");
    });

    test("security + architecture keywords trigger complex", () => {
      expect(analyzeComplexity(
        "Review the security of our authentication and authorization architecture"
      )).toBe("complex");
    });
  });

  describe("moderate prompts", () => {
    test("'how should I optimize my database query?' is moderate", () => {
      // Length < 50 (-2) + "optimize" (+2) + how-question (+1) = score 1 → moderate
      expect(analyzeComplexity("How should I optimize my database query?")).toBe("moderate");
    });

    test("'how would I refactor my code?' is moderate", () => {
      // Length < 50 (-2) + "refactor" (+2) + how-question (+1) = score 1 → moderate
      expect(analyzeComplexity("How would I refactor my code?")).toBe("moderate");
    });
  });

  describe("edge cases", () => {
    test("handles empty string gracefully", () => {
      const result = analyzeComplexity("");
      expect(["simple", "moderate", "complex"]).toContain(result);
    });

    test("handles very long prompt", () => {
      const longPrompt = "a ".repeat(500);
      const result = analyzeComplexity(longPrompt);
      expect(["simple", "moderate", "complex"]).toContain(result);
    });

    test("is case-insensitive for keywords", () => {
      expect(analyzeComplexity("ARCHITECTURE design")).toBe(
        analyzeComplexity("architecture design")
      );
    });
  });
});

// ─── routeToProfile ──────────────────────────────────────────

describe("routeToProfile", () => {
  const allProfiles = makeProfiles("speed", "budget", "sonnet-4.6", "quality", "opus-latest");

  test("returns a valid RoutingDecision shape", () => {
    const result = routeToProfile("hello", allProfiles);
    expect(result).toHaveProperty("profile");
    expect(result).toHaveProperty("reason");
    expect(result).toHaveProperty("complexity");
  });

  describe("simple prompts route to budget/speed", () => {
    test("short greeting routes to speed or budget", () => {
      const result = routeToProfile("hello", allProfiles);
      expect(["speed", "budget"]).toContain(result.profile);
      expect(result.complexity).toBe("simple");
    });

    test("'what is a variable?' routes to speed or budget", () => {
      const result = routeToProfile("what is a variable?", allProfiles);
      expect(["speed", "budget"]).toContain(result.profile);
    });
  });

  describe("complex prompts route to quality", () => {
    test("architecture prompt routes to quality or opus", () => {
      const result = routeToProfile(
        "design a microservice architecture with scalability and security",
        allProfiles
      );
      expect(["quality", "opus-latest"]).toContain(result.profile);
      expect(result.complexity).toBe("complex");
    });
  });

  describe("moderate prompts route to balanced profiles", () => {
    test("moderate prompt routes to sonnet or quality", () => {
      // "How would I refactor my code?" scores as moderate
      const result = routeToProfile("How would I refactor my code?", allProfiles);
      expect(["sonnet-4.6", "quality"]).toContain(result.profile);
      expect(result.complexity).toBe("moderate");
    });
  });

  describe("fallback behavior", () => {
    test("falls back to first profile when no preferred match", () => {
      const customProfiles = makeProfiles("custom-1", "custom-2");
      const result = routeToProfile("hello", customProfiles);
      expect(result.profile).toBe("custom-1");
    });

    test("returns 'none' when no profiles available", () => {
      const result = routeToProfile("hello", []);
      expect(result.profile).toBe("none");
      expect(result.reason).toContain("No profiles available");
    });
  });

  describe("reason is always a non-empty string", () => {
    test("simple prompt has a reason", () => {
      const result = routeToProfile("hi", allProfiles);
      expect(result.reason.length).toBeGreaterThan(0);
    });

    test("complex prompt has a reason", () => {
      const result = routeToProfile(
        "refactor the authentication architecture for better security",
        allProfiles
      );
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });
});
