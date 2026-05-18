export type AndroidFailureKind =
  | "manifest-merger"
  | "resource-linking"
  | "dependency-resolution"
  | "duplicate-class"
  | "kotlin-compile"
  | "java-compile"
  | "ksp"
  | "kapt"
  | "hilt"
  | "room"
  | "r8"
  | "lint"
  | "install"
  | "runtime-crash"
  | "anr"
  | "native-crash"
  | "test-failure"
  | "unknown";

export interface AndroidFailureClassification {
  detected: boolean;
  kind: AndroidFailureKind;
  confidence: "low" | "medium" | "high";
  summary: string;
  evidence: string[];
  likelyCauses: string[];
  recommendedNextCommands: string[];
  recommendedFilesToInspect: string[];
  risks: string[];
}

interface AndroidFailureRule {
  kind: AndroidFailureKind;
  confidence: "low" | "medium" | "high";
  patterns: RegExp[];
  summary: string;
  likelyCauses: string[];
  recommendedNextCommands: string[];
  recommendedFilesToInspect: string[];
  risks: string[];
}

const RULES: AndroidFailureRule[] = [
  {
    kind: "manifest-merger",
    confidence: "high",
    patterns: [/Manifest merger failed/i, /android:exported/i],
    summary: "Android manifest merge failure detected.",
    likelyCauses: ["Conflicting manifest attributes", "Missing android:exported on components with intent filters"],
    recommendedNextCommands: ["./gradlew :app:processDebugMainManifest --info", "./gradlew :app:assembleDebug"],
    recommendedFilesToInspect: ["AndroidManifest.xml", "module build.gradle(.kts)"],
    risks: ["Permissions, exported components, and deep links may be broken."],
  },
  {
    kind: "resource-linking",
    confidence: "high",
    patterns: [/Android resource linking failed/i, /AAPT: error/i, /failed linking references/i],
    summary: "Android resource linking failure detected.",
    likelyCauses: ["Missing resource reference", "Theme/material mismatch", "Invalid XML resource"],
    recommendedNextCommands: ["./gradlew :app:mergeDebugResources", "./gradlew :app:assembleDebug"],
    recommendedFilesToInspect: ["res/layout/*.xml", "res/values/*.xml", "themes.xml"],
    risks: ["UI may fail to render or app may not compile."],
  },
  {
    kind: "dependency-resolution",
    confidence: "high",
    patterns: [/Could not resolve/i, /Could not find/i, /No matching variant/i],
    summary: "Gradle dependency resolution failure detected.",
    likelyCauses: ["Version mismatch", "Missing repository", "Invalid Gradle variant selection"],
    recommendedNextCommands: ["./gradlew :app:dependencies", "./gradlew :app:dependencyInsight --dependency <artifact> --configuration debugRuntimeClasspath"],
    recommendedFilesToInspect: ["build.gradle(.kts)", "settings.gradle(.kts)", "gradle/libs.versions.toml"],
    risks: ["Build graph may be inconsistent across modules."],
  },
  {
    kind: "duplicate-class",
    confidence: "high",
    patterns: [/Duplicate class/i, /found in modules/i],
    summary: "Duplicate class conflict detected.",
    likelyCauses: ["Conflicting transitive dependencies", "Mixing incompatible artifacts"],
    recommendedNextCommands: ["./gradlew :app:dependencyInsight --dependency <artifact> --configuration debugRuntimeClasspath"],
    recommendedFilesToInspect: ["build.gradle(.kts)", "gradle/libs.versions.toml"],
    risks: ["Dependency exclusions may affect runtime behavior if applied incorrectly."],
  },
  {
    kind: "ksp",
    confidence: "high",
    patterns: [/kspDebugKotlin/i, /SymbolProcessor/i, /KSP/i],
    summary: "KSP-generated code failure detected.",
    likelyCauses: ["Processor/Kotlin version mismatch", "Invalid annotation usage", "Generated source failure"],
    recommendedNextCommands: ["./gradlew :app:kspDebugKotlin --stacktrace", "./gradlew :app:compileDebugKotlin"],
    recommendedFilesToInspect: ["annotated Kotlin source", "build.gradle(.kts)"],
    risks: ["Generated code may be stale or incompatible with current plugin versions."],
  },
  {
    kind: "hilt",
    confidence: "high",
    patterns: [/MissingBinding/i, /Hilt/i, /Dagger/i, /@AndroidEntryPoint/i],
    summary: "Hilt/Dagger dependency injection failure detected.",
    likelyCauses: ["Missing binding/module", "Incorrect scope", "Missing Hilt annotation"],
    recommendedNextCommands: ["./gradlew :app:compileDebugKotlin", "./gradlew :app:kspDebugKotlin --stacktrace"],
    recommendedFilesToInspect: ["Hilt modules", "@AndroidEntryPoint/@HiltViewModel classes"],
    risks: ["DI graph failures usually block app startup or screen creation."],
  },
  {
    kind: "room",
    confidence: "high",
    patterns: [/Migration didn't properly handle/i, /Room/i, /Cannot figure out how to save this field/i],
    summary: "Room database failure detected.",
    likelyCauses: ["Broken migration", "Unsupported field mapping", "DAO/entity mismatch"],
    recommendedNextCommands: ["./gradlew :app:testDebugUnitTest"],
    recommendedFilesToInspect: ["@Entity", "@Dao", "RoomDatabase", "Migration classes"],
    risks: ["Database migration bugs can cause user data loss."],
  },
  {
    kind: "r8",
    confidence: "high",
    patterns: [/R8/i, /Missing class/i, /minifyReleaseWithR8/i, /proguard/i],
    summary: "R8/ProGuard release shrink failure detected.",
    likelyCauses: ["Missing keep rules", "Consumer rules mismatch", "Reflection-based library stripped"],
    recommendedNextCommands: ["./gradlew :app:bundleRelease", "./gradlew :app:lintVitalRelease"],
    recommendedFilesToInspect: ["proguard-rules.pro", "consumer-rules.pro", "release build.gradle(.kts)"],
    risks: ["Release-only crashes can ship if shrinker issues are not reproduced."],
  },
  {
    kind: "install",
    confidence: "high",
    patterns: [/INSTALL_FAILED/i, /INSTALL_PARSE_FAILED/i],
    summary: "ADB/app install failure detected.",
    likelyCauses: ["Signing mismatch", "Version downgrade", "Package incompatibility"],
    recommendedNextCommands: ["adb uninstall <applicationId>", "./gradlew :app:assembleDebug"],
    recommendedFilesToInspect: ["applicationId", "signingConfig", "versionCode"],
    risks: ["Device state may prevent clean repro until package is reset."],
  },
  {
    kind: "runtime-crash",
    confidence: "high",
    patterns: [/FATAL EXCEPTION/i, /Caused by:/i, /Process:/i],
    summary: "Android runtime crash detected.",
    likelyCauses: ["Nullability/lifecycle bug", "Bad DI wiring", "Illegal state on UI thread"],
    recommendedNextCommands: ["adb logcat", "./gradlew :app:connectedDebugAndroidTest"],
    recommendedFilesToInspect: ["Top app stack frame", "related Activity/Fragment/ViewModel"],
    risks: ["Crash may be user-visible and block critical flows."],
  },
  {
    kind: "anr",
    confidence: "high",
    patterns: [/ANR in/i, /Input dispatching timed out/i],
    summary: "Android ANR signal detected.",
    likelyCauses: ["Main-thread blocking I/O", "Slow startup", "Long binder/service work"],
    recommendedNextCommands: ["adb logcat", "adb shell dumpsys activity"],
    recommendedFilesToInspect: ["main-thread work", "startup path", "WorkManager/service code"],
    risks: ["ANRs are release-critical and can affect Play quality metrics."],
  },
  {
    kind: "native-crash",
    confidence: "high",
    patterns: [/Fatal signal/i, /SIGSEGV/i, /tombstone/i, /\.so/i],
    summary: "Android native crash detected.",
    likelyCauses: ["JNI ownership bug", "Out-of-bounds access", "ABI mismatch"],
    recommendedNextCommands: ["adb logcat", "./gradlew :app:externalNativeBuildDebug"],
    recommendedFilesToInspect: ["src/main/cpp", "JNI bridge code", "ABI packaging config"],
    risks: ["Native crashes are memory-safety issues and often device/ABI specific."],
  },
  {
    kind: "kotlin-compile",
    confidence: "medium",
    patterns: [/compileDebugKotlin/i, /Unresolved reference/i, /Type mismatch/i],
    summary: "Android Kotlin compilation failure detected.",
    likelyCauses: ["API mismatch", "Missing imports/dependencies", "Generated code not available"],
    recommendedNextCommands: ["./gradlew :app:compileDebugKotlin", "./gradlew :app:assembleDebug"],
    recommendedFilesToInspect: ["mentioned Kotlin source", "related generated bindings"],
    risks: ["Compile issues may hide a deeper Gradle/generation problem."],
  },
];

function evidenceLines(log: string, patterns: RegExp[]): string[] {
  return log.split(/\r?\n/).filter((line) => patterns.some((pattern) => pattern.test(line))).slice(0, 5);
}

export function classifyAndroidFailure(log: string): AndroidFailureClassification {
  const androidSignal = /gradle|android|androidx|manifest|aapt|ksp|hilt|room|adb|logcat|r8|proguard|install_failed|fatal exception|anr|sigsegv/i.test(log);
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(log))) {
      return {
        detected: true,
        kind: rule.kind,
        confidence: rule.confidence,
        summary: rule.summary,
        evidence: evidenceLines(log, rule.patterns),
        likelyCauses: rule.likelyCauses,
        recommendedNextCommands: rule.recommendedNextCommands,
        recommendedFilesToInspect: rule.recommendedFilesToInspect,
        risks: rule.risks,
      };
    }
  }
  return {
    detected: androidSignal,
    kind: "unknown",
    confidence: androidSignal ? "low" : "low",
    summary: androidSignal ? "Android/Gradle failure signal detected, but no classifier rule matched exactly." : "No Android-specific failure signal detected.",
    evidence: [],
    likelyCauses: androidSignal ? ["Review the failing Gradle task or top app stack frame."] : [],
    recommendedNextCommands: androidSignal ? ["./gradlew :app:assembleDebug", "adb logcat"] : [],
    recommendedFilesToInspect: androidSignal ? ["failing module build.gradle(.kts)", "top app stack frame"] : [],
    risks: androidSignal ? ["Unknown Android failures may require manual triage before safe fixes."] : [],
  };
}

export function summarizeAndroidFailure(log: string): string {
  const result = classifyAndroidFailure(log);
  return `${result.kind}: ${result.summary}`;
}
