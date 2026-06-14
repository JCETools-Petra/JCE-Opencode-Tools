import { describe, test, expect } from "bun:test";
import { isRecord, asArray, text, listOrNone } from "../../src/plugin/lib/shared-predicates.ts";

describe("shared-predicates", () => {
  describe("isRecord", () => {
    test("true for plain objects", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });
    test("false for null", () => expect(isRecord(null)).toBe(false));
    test("false for arrays", () => expect(isRecord([1, 2])).toBe(false));
    test("false for primitives", () => {
      expect(isRecord(42)).toBe(false);
      expect(isRecord("str")).toBe(false);
      expect(isRecord(undefined)).toBe(false);
      expect(isRecord(true)).toBe(false);
    });
  });

  describe("asArray", () => {
    test("returns array unchanged", () => {
      const arr = [1, 2, 3];
      expect(asArray(arr)).toBe(arr);
    });
    test("returns empty array for non-array", () => {
      expect(asArray(null)).toEqual([]);
      expect(asArray(undefined)).toEqual([]);
      expect(asArray("string")).toEqual([]);
      expect(asArray(42)).toEqual([]);
      expect(asArray({})).toEqual([]);
    });
  });

  describe("text", () => {
    test("returns trimmed string", () => expect(text("hello")).toBe("hello"));
    test("returns fallback for empty string", () => expect(text("", "fallback")).toBe("fallback"));
    test("returns fallback for whitespace-only", () => expect(text("   ", "fb")).toBe("fb"));
    test("returns string for numbers", () => expect(text(42)).toBe("42"));
    test("returns string for booleans", () => expect(text(true)).toBe("true"));
    test("returns fallback for null/undefined", () => {
      expect(text(null)).toBe("none");
      expect(text(undefined, "n/a")).toBe("n/a");
    });
    test("default fallback is 'none'", () => expect(text(null)).toBe("none"));
  });

  describe("listOrNone", () => {
    test("formats items as markdown list", () => {
      expect(listOrNone(["a", "b"])).toBe("- a\n- b");
    });
    test("returns '- none' for empty array", () => {
      expect(listOrNone([])).toBe("- none");
    });
  });
});
