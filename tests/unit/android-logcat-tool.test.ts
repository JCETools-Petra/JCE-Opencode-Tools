import { describe, expect, test } from "bun:test";
import { analyzeAndroidLogcat, buildAndroidLogcatTool, type AdbRunner } from "../../src/plugin/tools/android-logcat.ts";

function runnerFromMap(map: Record<string, { ok?: boolean; stdout?: string; stderr?: string }>): AdbRunner {
  return (args) => {
    const key = args.join(" ");
    const value = map[key];
    if (!value) return { ok: false, stdout: "", stderr: `unexpected adb args: ${key}` };
    return { ok: value.ok ?? true, stdout: value.stdout ?? "", stderr: value.stderr };
  };
}

describe("android_logcat tool", () => {
  test("collects logcat and classifies a runtime crash", () => {
    const runner = runnerFromMap({
      devices: { stdout: "List of devices attached\nemulator-5554\tdevice\n" },
      "-s emulator-5554 shell pidof com.example.app": { stdout: "1234\n" },
      "-s emulator-5554 logcat -d -v time -t 800": {
        stdout: "05-18 01:00:00.000 1234 1234 E AndroidRuntime: FATAL EXCEPTION: main\n05-18 01:00:00.001 1234 1234 E AndroidRuntime: Process: com.example.app\n05-18 01:00:00.002 1234 1234 E AndroidRuntime: Caused by: java.lang.IllegalStateException\n",
      },
    });

    const analysis = analyzeAndroidLogcat({ packageName: "com.example.app" }, runner);
    expect(analysis.status).toBe("ok");
    expect(analysis.selectedDevice).toBe("emulator-5554");
    expect(analysis.pid).toBe("1234");
    expect(analysis.classification.kind).toBe("runtime-crash");
    expect(analysis.logExcerpt).toContain("FATAL EXCEPTION");
  });

  test("reports blocker when no device is authorized", () => {
    const analysis = analyzeAndroidLogcat({}, runnerFromMap({ devices: { stdout: "List of devices attached\n" } }));
    expect(analysis.status).toBe("blocked");
    expect(analysis.warnings[0]).toContain("No authorized Android device");
  });

  test("formats tool output with failure summary", async () => {
    const tool = buildAndroidLogcatTool(runnerFromMap({
      devices: { stdout: "List of devices attached\nemulator-5554\tdevice\n" },
      "-s emulator-5554 logcat -d -v time -t 50": { stdout: "ANR in com.example.app\nInput dispatching timed out\n" },
    }));

    const output = await tool.execute({ lines: 50 } as any, {} as any);
    expect(String(output)).toContain("Android Logcat Analysis");
    expect(String(output)).toContain("Failure: anr");
  });
});
