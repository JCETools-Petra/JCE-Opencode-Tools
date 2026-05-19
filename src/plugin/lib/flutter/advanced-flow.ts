import { scanFlutterProject, type FlutterProjectScan } from "./project-scanner.js";
import { classifyFlutterFailure, type FlutterFailureClassification } from "./failure-classifier.js";
import { buildFlutterVerificationRecipe, type FlutterVerificationCommand } from "./verification-recipe.js";

export type FlutterFlowKind = "diagnose" | "feature" | "ui" | "data" | "release" | "performance" | "platform";
export interface FlutterAdvancedProfile { projectType: "app" | "package" | "plugin" | "module" | "unknown"; primaryPlatform: string | null; stateManagement: string[]; routing: string[]; persistence: string[]; networking: string[]; verificationMatrix: FlutterVerificationCommand[]; persistentContext: string[]; risks: string[] }
export interface FlutterFlowTemplate { kind: FlutterFlowKind; title: string; triggers: string[]; steps: string[]; evidenceRequired: string[]; recommendedCommands: FlutterVerificationCommand[]; escalation: string[] }
export interface FlutterAdvancedFlowInput { root: string; prompt?: string; changedFiles?: string[]; diffText?: string; failureLog?: string }
export interface FlutterAdvancedFlowReport { profile: FlutterAdvancedProfile; scan: FlutterProjectScan; failure?: FlutterFailureClassification; selectedFlows: FlutterFlowTemplate[]; nextActions: string[] }
function unique<T>(items: T[]): T[] { return [...new Set(items)]; }
function command(command: string, reason: string, extra: Partial<FlutterVerificationCommand> = {}): FlutterVerificationCommand { return { command, reason, ...extra }; }
function projectType(scan: FlutterProjectScan): FlutterAdvancedProfile["projectType"] { if (!scan.detected) return "unknown"; if (scan.platforms.length > 0) return "app"; if (scan.dependencies.includes("plugin_platform_interface")) return "plugin"; return "package"; }
export function buildFlutterAdvancedProfile(scan: FlutterProjectScan, changedFiles: string[] = [], diffText = ""): FlutterAdvancedProfile {
  const recipe = buildFlutterVerificationRecipe({ files: changedFiles, diffText });
  const verificationMatrix = recipe.commands.length ? recipe.commands : scan.recommendedVerification.map((item) => command(item, "Baseline Flutter project verification from scan."));
  const persistentContext = unique([scan.detected ? `Flutter profile: ${projectType(scan)}, platforms ${scan.platforms.join(", ") || "none"}, state ${scan.stateManagement.join(", ") || "unknown"}.` : undefined, scan.version ? `Flutter app version ${scan.version}.` : undefined, verificationMatrix.length ? `Flutter verification commands: ${verificationMatrix.slice(0, 3).map((item) => item.command).join(", ")}.` : undefined].filter(Boolean) as string[]);
  return { projectType: projectType(scan), primaryPlatform: scan.platforms[0] ?? null, stateManagement: scan.stateManagement, routing: scan.routing, persistence: scan.persistence, networking: scan.networking, verificationMatrix, persistentContext, risks: unique([...scan.warnings, ...(scan.usesCodegen ? ["Code generation detected; generated outputs must be refreshed and verified."] : [])]) };
}
function template(kind: FlutterFlowKind, commands: FlutterVerificationCommand[]): FlutterFlowTemplate {
  const library: Record<FlutterFlowKind, FlutterFlowTemplate> = {
    diagnose: { kind, title: "Flutter diagnose flow", triggers: ["error", "crash", "analyze", "test failure"], steps: ["Scan pubspec/platforms", "Classify failure", "Inspect reported Dart/platform files", "Apply minimal fix", "Run targeted Flutter verification"], evidenceRequired: ["failure classification", "fresh command output"], recommendedCommands: commands.length ? commands : [command("flutter analyze", "Verify analyzer after diagnosis."), command("flutter test", "Verify tests after diagnosis.")], escalation: ["Use Android advanced flow for android/ Gradle failures", "Use macOS/Xcode environment for iOS failures"] },
    feature: { kind, title: "Flutter feature flow", triggers: ["add feature", "screen", "repository"], steps: ["Locate widget/state/repository boundaries", "Implement state and UI", "Update tests", "Run analyze/test"], evidenceRequired: ["files changed", "analyze/test output"], recommendedCommands: [command("flutter analyze", "Verify feature code."), command("flutter test", "Verify feature tests.")], escalation: ["Escalate cross-platform native behavior to platform flow"] },
    ui: { kind, title: "Flutter UI flow", triggers: ["widget", "layout", "overflow", "theme"], steps: ["Review widget constraints", "Prefer const/stateless boundaries", "Check accessibility/semantics", "Run widget/golden tests"], evidenceRequired: ["widget test or visual evidence"], recommendedCommands: [command("flutter test", "Run widget/golden tests.")], escalation: ["Use device/manual verification for responsive layout uncertainty"] },
    data: { kind, title: "Flutter data flow", triggers: ["api", "dio", "hive", "isar", "drift", "repository"], steps: ["Review repository/source-of-truth", "Validate serialization/codegen", "Test mappers and persistence", "Run codegen/analyze/test"], evidenceRequired: ["codegen if needed", "unit tests"], recommendedCommands: [command("dart run build_runner build --delete-conflicting-outputs", "Refresh generated models when codegen is used.", { optional: true }), command("flutter test", "Verify data logic.")], escalation: ["Review migrations/destructive persistence changes carefully"] },
    release: { kind, title: "Flutter release flow", triggers: ["release", "appbundle", "ipa", "obfuscate"], steps: ["Check pubspec version", "Check signing/platform policy", "Build release artifact", "Document symbols/obfuscation"], evidenceRequired: ["release build output"], recommendedCommands: [command("flutter build appbundle", "Verify Android app bundle release.", { releaseSensitive: true }), command("flutter build web", "Verify web release when applicable.", { optional: true })], escalation: ["Do not alter signing/bundle IDs without confirmation"] },
    performance: { kind, title: "Flutter performance flow", triggers: ["jank", "slow", "rebuild", "performance"], steps: ["Identify runtime vs build perf", "Check const/list/repaint boundaries", "Measure with repeatable command or DevTools", "Verify no regressions"], evidenceRequired: ["baseline/post-change evidence"], recommendedCommands: [command("flutter analyze", "Catch common performance lint issues.")], escalation: ["Use DevTools/manual profiling for frame jank"] },
    platform: { kind, title: "Flutter platform flow", triggers: ["android", "ios", "methodchannel", "plugin"], steps: ["Identify Dart/native boundary", "Check channel names and plugin registration", "Run platform build", "Collect platform logs if needed"], evidenceRequired: ["platform build/log evidence"], recommendedCommands: [command("flutter build apk --debug", "Verify Android host."), command("flutter build ios --no-codesign", "Verify iOS host on macOS.", { optional: true })], escalation: ["Route Android host failures to Android advanced classifier"] },
  };
  return library[kind];
}
export function selectFlutterFlowKinds(input: FlutterAdvancedFlowInput, failure?: FlutterFailureClassification): FlutterFlowKind[] {
  const corpus = `${input.prompt ?? ""}\n${input.changedFiles?.join("\n") ?? ""}\n${input.diffText ?? ""}`.toLowerCase();
  const kinds = new Set<FlutterFlowKind>();
  if (failure?.detected || /fix|bug|error|crash|fail|diagnos|analyze/.test(corpus)) kinds.add("diagnose");
  if (/feature|add|implement|tambah|buat/.test(corpus)) kinds.add("feature");
  if (/widget|layout|overflow|theme|screen|ui/.test(corpus)) kinds.add("ui");
  if (/api|repository|dio|http|hive|isar|drift|shared_preferences|freezed|json/.test(corpus)) kinds.add("data");
  if (/release|appbundle|apk|ipa|obfuscate|split-debug-info/.test(corpus)) kinds.add("release");
  if (/slow|jank|rebuild|performance|optimi[sz]e/.test(corpus)) kinds.add("performance");
  if (/android\/|ios\/|platform|methodchannel|plugin/.test(corpus)) kinds.add("platform");
  if (!kinds.size) kinds.add("diagnose");
  return [...kinds];
}
export function buildFlutterAdvancedFlow(input: FlutterAdvancedFlowInput): FlutterAdvancedFlowReport {
  const scan = scanFlutterProject(input.root);
  const failure = input.failureLog ? classifyFlutterFailure(input.failureLog) : undefined;
  const profile = buildFlutterAdvancedProfile(scan, input.changedFiles, input.diffText);
  const selectedFlows = selectFlutterFlowKinds(input, failure).map((kind) => template(kind, profile.verificationMatrix));
  const nextActions = unique([scan.detected ? "Persist Flutter profile facts in project context for future sessions." : "Confirm this is a Flutter project; scanner did not detect pubspec/lib signals.", failure?.detected ? `Triage ${failure.kind} before patching.` : undefined, ...selectedFlows.flatMap((flow) => flow.recommendedCommands.slice(0, 2).map((item) => `Run: ${item.command} — ${item.reason}`))].filter(Boolean) as string[]);
  return { profile, scan, failure, selectedFlows, nextActions };
}
