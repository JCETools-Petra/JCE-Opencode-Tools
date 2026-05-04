import { describe, expect, test } from "bun:test";
import { buildAgentConfigs } from "../../src/plugin/config.ts";

describe("plugin agents", () => {
  test("builds 5 agent configs with correct IDs", () => {
    const agents = buildAgentConfigs();
    const ids = Object.keys(agents);
    expect(ids).toContain("sisyphus");
    expect(ids).toContain("oracle");
    expect(ids).toContain("librarian");
    expect(ids).toContain("explorer");
    expect(ids).toContain("frontend");
    expect(ids).toHaveLength(5);
  });

  test("sisyphus agent has boulder/todo system prompt", () => {
    const agents = buildAgentConfigs();
    expect(agents.sisyphus.systemPrompt).toContain("todo");
    expect(agents.sisyphus.systemPrompt).toContain("boulder");
    expect(agents.sisyphus.systemPrompt).toContain("Sisyphus");
  });

  test("each agent has a model string in provider/model format", () => {
    const agents = buildAgentConfigs();
    for (const [, agent] of Object.entries(agents)) {
      expect(agent.model).toBeDefined();
      expect(agent.model).toContain("/");
    }
  });
});
