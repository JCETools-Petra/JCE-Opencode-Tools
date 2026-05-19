export type FlutterChangeKind = "dart" | "widget" | "test" | "pubspec" | "codegen" | "android" | "ios" | "web" | "assets" | "l10n" | "release" | "unknown";
export interface FlutterVerificationCommand { command: string; reason: string; requiresDevice?: boolean; releaseSensitive?: boolean; optional?: boolean }
export interface FlutterVerificationRecipe { detected: boolean; changeKinds: FlutterChangeKind[]; commands: FlutterVerificationCommand[]; notes: string[]; risks: string[] }
interface Input { prompt?: string; files?: string[]; diffText?: string }
function unique<T>(items: T[]): T[] { return [...new Set(items)]; }
function command(command: string, reason: string, extra: Partial<FlutterVerificationCommand> = {}): FlutterVerificationCommand { return { command, reason, ...extra }; }

export function detectFlutterChangeKinds(input: Input): FlutterChangeKind[] {
  const corpus = `${input.prompt ?? ""}\n${input.diffText ?? ""}\n${(input.files ?? []).join("\n")}`.toLowerCase();
  const kinds = new Set<FlutterChangeKind>();
  if (/flutter|dart|pubspec|widget|riverpod|bloc|gorouter|go_router/.test(corpus)) kinds.add("unknown");
  if (/\.dart\b|lib\//.test(corpus)) kinds.add("dart");
  if (/widget|statelesswidget|statefulwidget|consumerwidget|build\(buildcontext/.test(corpus)) kinds.add("widget");
  if (/test\/|_test\.dart|integration_test/.test(corpus)) kinds.add("test");
  if (/pubspec\.yaml|pubspec\.lock/.test(corpus)) kinds.add("pubspec");
  if (/build_runner|freezed|json_serializable|\.g\.dart|\.freezed\.dart/.test(corpus)) kinds.add("codegen");
  if (/android\//.test(corpus)) kinds.add("android");
  if (/ios\/|podfile|info\.plist/.test(corpus)) kinds.add("ios");
  if (/web\//.test(corpus)) kinds.add("web");
  if (/assets\/|fonts\/|images\//.test(corpus)) kinds.add("assets");
  if (/l10n|\.arb|localizations/.test(corpus)) kinds.add("l10n");
  if (/release|appbundle|apk|ipa|obfuscate|split-debug-info/.test(corpus)) kinds.add("release");
  return unique([...kinds]);
}

export function buildFlutterVerificationRecipe(input: Input): FlutterVerificationRecipe {
  const changeKinds = detectFlutterChangeKinds(input);
  if (!changeKinds.length) return { detected: false, changeKinds: [], commands: [], notes: [], risks: [] };
  const commands: FlutterVerificationCommand[] = [];
  const notes: string[] = [];
  const risks: string[] = [];
  if (changeKinds.includes("pubspec") || changeKinds.includes("assets") || changeKinds.includes("l10n")) commands.push(command("flutter pub get", "Refresh dependencies/assets/localization inputs."));
  if (changeKinds.includes("codegen")) commands.push(command("dart run build_runner build --delete-conflicting-outputs", "Regenerate Freezed/JSON/Riverpod/AutoRoute outputs."));
  if (changeKinds.includes("dart") || changeKinds.includes("widget") || changeKinds.includes("pubspec") || changeKinds.includes("codegen")) commands.push(command("flutter analyze", "Verify analyzer and type/lint correctness."));
  if (changeKinds.includes("dart") || changeKinds.includes("widget") || changeKinds.includes("test")) commands.push(command("flutter test", "Run unit/widget tests."));
  if (changeKinds.includes("android")) commands.push(command("flutter build apk --debug", "Verify Android host/debug build."));
  if (changeKinds.includes("ios")) commands.push(command("flutter build ios --no-codesign", "Verify iOS host build when running on macOS.", { optional: true }));
  if (changeKinds.includes("web")) commands.push(command("flutter build web", "Verify Flutter web build."));
  if (changeKinds.includes("release")) {
    commands.push(command("flutter build appbundle", "Verify Android release bundle packaging.", { releaseSensitive: true }));
    risks.push("Release builds may require signing, obfuscation, symbols, and store policy checks.");
  }
  if (changeKinds.includes("widget")) notes.push("Widget/UI changes benefit from golden or manual visual verification when available.");
  return { detected: true, changeKinds, commands: unique(commands.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item) as FlutterVerificationCommand), notes, risks };
}
