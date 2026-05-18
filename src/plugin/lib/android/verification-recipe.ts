export type AndroidChangeKind =
  | "kotlin"
  | "java"
  | "compose"
  | "xml-resource"
  | "manifest"
  | "gradle"
  | "room"
  | "hilt"
  | "ksp"
  | "release"
  | "r8-proguard"
  | "ndk"
  | "instrumented"
  | "unknown";

export interface AndroidVerificationCommand {
  command: string;
  reason: string;
  requiresDevice?: boolean;
  releaseSensitive?: boolean;
  optional?: boolean;
}

export interface AndroidVerificationRecipe {
  detected: boolean;
  module: string | null;
  changeKinds: AndroidChangeKind[];
  commands: AndroidVerificationCommand[];
  notes: string[];
  risks: string[];
}

interface AndroidVerificationInput {
  prompt?: string;
  files?: string[];
  diffText?: string;
  module?: string | null;
}

function normalizeModule(module: string | null | undefined): string | null {
  if (!module) return null;
  return module.startsWith(":") ? module : `:${module}`;
}

function task(module: string | null, gradleTask: string): string {
  const normalizedModule = normalizeModule(module);
  return normalizedModule ? `./gradlew ${normalizedModule}:${gradleTask}` : `./gradlew ${gradleTask}`;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function detectModuleFromFiles(files: string[]): string | null {
  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    const match = normalized.match(/^([^/]+)\/src\//);
    if (match) return `:${match[1]}`;
    const manifestMatch = normalized.match(/^([^/]+)\/AndroidManifest\.xml$/);
    if (manifestMatch) return `:${manifestMatch[1]}`;
    const gradleMatch = normalized.match(/^([^/]+)\/build\.gradle(\.kts)?$/);
    if (gradleMatch) return `:${gradleMatch[1]}`;
  }
  return null;
}

export function detectAndroidChangeKinds(input: AndroidVerificationInput): AndroidChangeKind[] {
  const files = input.files ?? [];
  const corpus = `${input.prompt ?? ""}\n${input.diffText ?? ""}\n${files.join("\n")}`.toLowerCase();
  const kinds = new Set<AndroidChangeKind>();

  if (/android|androidx|androidmanifest|jetpack compose|gradle android plugin|adb|logcat|apk|aab/.test(corpus)) kinds.add("unknown");
  if (/\.kt\b|viewmodel|activity|fragment/.test(corpus)) kinds.add("kotlin");
  if (/\.java\b/.test(corpus)) kinds.add("java");
  if (/compose|@composable|lazycolumn|collectasstatewithlifecycle|materialtheme/.test(corpus)) kinds.add("compose");
  if (/androidmanifest\.xml|android:exported|manifest merger failed/.test(corpus)) kinds.add("manifest");
  if (/res\/layout|res\/values|\.xml\b|resource linking failed|aapt/.test(corpus)) kinds.add("xml-resource");
  if (/build\.gradle|build\.gradle\.kts|settings\.gradle|settings\.gradle\.kts|libs\.versions\.toml|agp|gradle/.test(corpus)) kinds.add("gradle");
  if (/room|@entity|@dao|migration/.test(corpus)) kinds.add("room");
  if (/hilt|dagger|@hiltandroidapp|@androidentrypoint|@hiltviewmodel/.test(corpus)) kinds.add("hilt");
  if (/ksp|kapt|symbolprocessor/.test(corpus)) kinds.add("ksp");
  if (/release|bundlerelease|assemblerelease|signingconfig|play console|versioncode|versionname/.test(corpus)) kinds.add("release");
  if (/r8|proguard|minifyreleasewithr8|consumer-rules\.pro|mapping\.txt/.test(corpus)) kinds.add("r8-proguard");
  if (/src\/main\/cpp|cmakelists\.txt|jni|ndk|\.cpp\b|\.c\b|\.h\b/.test(corpus)) kinds.add("ndk");
  if (/connecteddebugandroidtest|androidtest|robolectric|instrumented|emulator|device/.test(corpus)) kinds.add("instrumented");

  if (kinds.size === 0) return [];
  return unique([...kinds]);
}

function command(command: string, reason: string, options: Partial<AndroidVerificationCommand> = {}): AndroidVerificationCommand {
  return { command, reason, ...options };
}

export function buildAndroidVerificationRecipe(input: AndroidVerificationInput): AndroidVerificationRecipe {
  const files = input.files ?? [];
  const changeKinds = detectAndroidChangeKinds(input);
  const detected = changeKinds.length > 0;
  const module = normalizeModule(input.module) ?? detectModuleFromFiles(files) ?? (detected ? ":app" : null);
  const commands: AndroidVerificationCommand[] = [];
  const notes: string[] = [];
  const risks: string[] = [];

  if (!detected) {
    return { detected: false, module: null, changeKinds: [], commands: [], notes: [], risks: [] };
  }

  if (changeKinds.includes("kotlin") || changeKinds.includes("java")) {
    commands.push(command(task(module, "testDebugUnitTest"), "Verify JVM logic and Android Kotlin/Java regressions."));
    commands.push(command(task(module, "assembleDebug"), "Verify the debug build still compiles."));
  }
  if (changeKinds.includes("compose")) {
    commands.push(command(task(module, "connectedDebugAndroidTest"), "Verify Compose/device behavior when instrumentation coverage exists.", { requiresDevice: true, optional: true }));
    notes.push("Compose UI changes benefit from instrumentation or manual visual verification when available.");
  }
  if (changeKinds.includes("manifest")) {
    commands.push(command(task(module, "processDebugMainManifest"), "Validate manifest merge and exported/permission issues."));
    risks.push("Manifest changes can affect exported components, permissions, and deep links.");
  }
  if (changeKinds.includes("xml-resource")) {
    commands.push(command(task(module, "mergeDebugResources"), "Validate resource merging and XML references."));
  }
  if (changeKinds.includes("gradle")) {
    commands.push(command(task(module, "dependencies"), "Inspect dependency graph when build configuration changes."));
    risks.push("Gradle/AGP/Kotlin/KSP changes can break build compatibility across modules.");
  }
  if (changeKinds.includes("room")) {
    notes.push("Run Room migration tests if schema or entities changed.");
    risks.push("Room schema changes require migration coverage to avoid production data loss.");
  }
  if (changeKinds.includes("hilt") || changeKinds.includes("ksp")) {
    commands.push(command(task(module, "compileDebugKotlin"), "Verify generated code and dependency injection compilation."));
  }
  if (changeKinds.includes("release") || changeKinds.includes("r8-proguard")) {
    commands.push(command(task(module, "bundleRelease"), "Verify release packaging for APK/AAB sensitive changes.", { releaseSensitive: true }));
    commands.push(command(task(module, "lintVitalRelease"), "Catch release-only manifest/resource/API issues.", { releaseSensitive: true }));
    risks.push("Release configuration changes must be validated against shrinker/signing behavior.");
  }
  if (changeKinds.includes("ndk")) {
    commands.push(command(task(module, "externalNativeBuildDebug"), "Verify native code still builds for debug targets."));
  }
  if (changeKinds.includes("instrumented") && !commands.some((item) => item.command.includes("connectedDebugAndroidTest"))) {
    commands.push(command(task(module, "connectedDebugAndroidTest"), "Run Android instrumentation coverage for platform-specific behavior.", { requiresDevice: true }));
  }

  return {
    detected: true,
    module,
    changeKinds,
    commands: unique(commands.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item) as AndroidVerificationCommand),
    notes: unique(notes),
    risks: unique(risks),
  };
}
