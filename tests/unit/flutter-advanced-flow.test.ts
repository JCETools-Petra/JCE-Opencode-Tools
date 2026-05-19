import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assessFlutterReleaseReadiness,
  buildFlutterAdvancedFlow,
  buildFlutterVerificationRecipe,
  classifyFlutterFailure,
  evaluateFlutterEvidence,
  planFlutterCommands,
  probeFlutterEnvironment,
  scanFlutterProject,
  selectFlutterFlowKinds,
} from "../../src/plugin/lib/flutter/index.ts";

function fixture(): string { return mkdtempSync(join(tmpdir(), "opencode-jce-flutter-")); }
function writeFlutterProject(root: string): void {
  mkdirSync(join(root, "lib"), { recursive: true });
  mkdirSync(join(root, "test"), { recursive: true });
  mkdirSync(join(root, "android"), { recursive: true });
  mkdirSync(join(root, "web"), { recursive: true });
  writeFileSync(join(root, "lib", "main.dart"), "import 'package:flutter/material.dart';\nvoid main() => runApp(const MaterialApp());", "utf8");
  writeFileSync(join(root, "pubspec.yaml"), `name: demo_app
version: 1.2.3+4
dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^2.5.0
  go_router: ^14.0.0
  dio: ^5.0.0
  hive: ^2.2.3
dev_dependencies:
  build_runner: ^2.4.0
  freezed: ^2.5.0
`, "utf8");
}

describe("Flutter advanced flow pack", () => {
  test("scans project and builds advanced profile/report", () => {
    const root = fixture();
    try {
      writeFlutterProject(root);
      const scan = scanFlutterProject(root);
      expect(scan.detected).toBe(true);
      expect(scan.platforms).toContain("android");
      expect(scan.stateManagement).toContain("flutter_riverpod");
      const report = buildFlutterAdvancedFlow({ root, prompt: "add Flutter widget feature", changedFiles: ["lib/home_screen.dart"] });
      expect(report.profile.projectType).toBe("app");
      expect(report.profile.routing).toContain("go_router");
      expect(report.selectedFlows.map((flow) => flow.kind)).toContain("feature");
      expect(report.profile.persistentContext.some((line) => line.includes("Flutter profile"))).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("detects verification commands and failure categories", () => {
    const recipe = buildFlutterVerificationRecipe({ files: ["pubspec.yaml", "lib/user.freezed.dart", "android/app/build.gradle"] });
    expect(recipe.commands.some((command) => command.command === "flutter pub get")).toBe(true);
    expect(recipe.commands.some((command) => command.command.includes("build_runner"))).toBe(true);
    expect(recipe.commands.some((command) => command.command === "flutter build apk --debug")).toBe(true);
    const failure = classifyFlutterFailure("A RenderFlex overflowed by 32 pixels on the right");
    expect(failure.kind).toBe("layout-overflow");
    expect(selectFlutterFlowKinds({ root: ".", prompt: "fix release platform MethodChannel performance" })).toEqual(expect.arrayContaining(["diagnose", "release", "platform", "performance"]));
  });

  test("probes environment, plans commands, gates evidence, and checks release readiness", () => {
    const root = fixture();
    try {
      writeFlutterProject(root);
      const env = probeFlutterEnvironment((command, args) => {
        if (command === "flutter" && args[0] === "--version") return { stdout: "Flutter 3.22.0" };
        if (command === "dart") return { stdout: "Dart SDK version: 3.4.0" };
        if (command === "flutter" && args[0] === "doctor") return { stdout: "[✓] Flutter\n[✓] Android toolchain" };
        if (command === "flutter" && args[0] === "devices") return { stdout: "Chrome • chrome • web-javascript • Google Chrome" };
        return { stdout: "" };
      });
      expect(env.flutter.available).toBe(true);
      expect(env.devices[0].id).toBe("chrome");
      const report = buildFlutterAdvancedFlow({ root, prompt: "release appbundle" });
      const plan = planFlutterCommands({ profile: report.profile, flows: report.selectedFlows, changedFiles: ["lib/main.dart"], environment: env });
      expect(plan.commands.some((command) => command.command === "flutter analyze")).toBe(true);
      const gate = evaluateFlutterEvidence(plan.commands, plan.commands.filter((command) => command.priority === "required").map((command) => ({ command: command.command, exitCode: 0 })));
      expect(gate.status).toBe("pass");
      const readiness = assessFlutterReleaseReadiness(report.scan);
      expect(readiness.ready).toBe(true);
      expect(readiness.commands).toContain("flutter build appbundle");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
