import { describe, expect, test } from "bun:test";
import { resolveAgentModel } from "../../src/plugin/lib/profile-resolver.ts";

describe("profile resolver", () => {
  test("resolves any role to a model config with provider and model", () => {
    const result = resolveAgentModel("sisyphus");
    expect(result.provider).toBeDefined();
    expect(result.model).toBeDefined();
    expect(typeof result.provider).toBe("string");
    expect(typeof result.model).toBe("string");
  });

  test("returns fallback for unknown role", () => {
    const result = resolveAgentModel("unknown-role");
    expect(result).toBeDefined();
    expect(typeof result.provider).toBe("string");
    expect(typeof result.model).toBe("string");
    expect(result.provider.length).toBeGreaterThan(0);
    expect(result.model.length).toBeGreaterThan(0);
  });

  test("all known roles resolve without error", () => {
    const roles = ["sisyphus", "oracle", "librarian", "explorer", "frontend"];
    for (const role of roles) {
      const result = resolveAgentModel(role);
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
    }
  });
});
