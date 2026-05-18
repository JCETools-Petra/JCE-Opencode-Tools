import { describe, expect, test } from "bun:test";
import { classifyAndroidFailure, summarizeAndroidFailure } from "../../src/plugin/lib/android/failure-classifier.ts";

describe("Android failure classifier", () => {
  test("classifies manifest merger failures", () => {
    const result = classifyAndroidFailure("Execution failed\nManifest merger failed : android:exported needs to be explicitly specified");
    expect(result.detected).toBe(true);
    expect(result.kind).toBe("manifest-merger");
    expect(result.recommendedNextCommands).toContain("./gradlew :app:processDebugMainManifest --info");
  });

  test("classifies duplicate class conflicts", () => {
    const result = classifyAndroidFailure("Duplicate class kotlin.collections.jdk8 found in modules foo and bar");
    expect(result.kind).toBe("duplicate-class");
    expect(result.recommendedNextCommands[0]).toContain("dependencyInsight");
  });

  test("classifies runtime crashes", () => {
    const result = classifyAndroidFailure("FATAL EXCEPTION: main\nProcess: com.example\nCaused by: java.lang.IllegalStateException");
    expect(result.kind).toBe("runtime-crash");
    expect(summarizeAndroidFailure("FATAL EXCEPTION: main")).toContain("runtime-crash");
  });

  test("does not detect non-Android errors", () => {
    const result = classifyAndroidFailure("TypeError: undefined is not a function");
    expect(result.detected).toBe(false);
    expect(result.kind).toBe("unknown");
  });
});
