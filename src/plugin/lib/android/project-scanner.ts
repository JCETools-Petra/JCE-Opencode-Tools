import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AndroidModuleInfo {
  path: string;
  directory: string;
  pluginIds: string[];
  namespace?: string;
  applicationId?: string;
  compileSdk?: string;
  minSdk?: string;
  targetSdk?: string;
  buildTypes: string[];
  productFlavors: string[];
  usesCompose: boolean;
  usesKsp: boolean;
  usesKapt: boolean;
  usesHilt: boolean;
  usesRoom: boolean;
  usesWorkManager: boolean;
  usesDataStore: boolean;
  hasAndroidTest: boolean;
  hasUnitTest: boolean;
  hasNativeCode: boolean;
}

export interface AndroidVersionInfo {
  agp?: string;
  kotlin?: string;
  ksp?: string;
  composeCompiler?: string;
  gradleWrapper?: string;
}

export interface AndroidCapabilities {
  compose: boolean;
  xmlViews: boolean;
  room: boolean;
  hilt: boolean;
  workManager: boolean;
  dataStore: boolean;
  ndk: boolean;
  multiModule: boolean;
  releaseSigningConfigured: boolean;
}

export interface AndroidProjectScan {
  detected: boolean;
  root: string;
  gradleWrapper: { present: boolean; files: string[] };
  settingsFile: string | null;
  versionCatalogs: string[];
  modules: AndroidModuleInfo[];
  versions: AndroidVersionInfo;
  capabilities: AndroidCapabilities;
  warnings: string[];
  recommendedVerification: string[];
}

function safeRead(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function parseIncludes(text: string): string[] {
  const matches = [...text.matchAll(/include\(([^)]+)\)|include\s+([^\n]+)/g)];
  const modules: string[] = [];
  for (const match of matches) {
    const body = (match[1] ?? match[2] ?? "").trim();
    for (const entry of body.split(",")) {
      const cleaned = entry.trim().replace(/["']/g, "");
      if (cleaned.startsWith(":")) modules.push(cleaned);
    }
  }
  return unique(modules);
}

function moduleDirFromPath(root: string, modulePath: string): string {
  return join(root, modulePath.replace(/^:/, "").replace(/:/g, "/"));
}

function parsePluginIds(text: string): string[] {
  return unique([...text.matchAll(/id\(["']([^"']+)["']\)|id\s+["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]).filter(Boolean) as string[]);
}

function parseSimpleValue(text: string, key: string): string | undefined {
  const match = text.match(new RegExp(`${key}\\s*[= ]\\s*["']?([^"'\\n]+)["']?`));
  return match?.[1]?.trim();
}

function parseBlockNames(text: string, blockName: string): string[] {
  const blockMatch = text.match(new RegExp(`${blockName}\\s*\\{([\\s\\S]*?)\\}`, "m"));
  if (!blockMatch) return [];
  return unique([...blockMatch[1].matchAll(/create\(["']([^"']+)["']\)|register\(["']([^"']+)["']\)|([A-Za-z0-9_]+)\s*\{/g)].map((m) => m[1] ?? m[2] ?? m[3]).filter(Boolean) as string[]);
}

function detectModule(root: string, modulePath: string): AndroidModuleInfo {
  const directory = moduleDirFromPath(root, modulePath);
  const gradleKts = join(directory, "build.gradle.kts");
  const gradleGroovy = join(directory, "build.gradle");
  const gradleText = safeRead(gradleKts) || safeRead(gradleGroovy);
  const pluginIds = parsePluginIds(gradleText);

  return {
    path: modulePath,
    directory,
    pluginIds,
    namespace: parseSimpleValue(gradleText, "namespace"),
    applicationId: parseSimpleValue(gradleText, "applicationId"),
    compileSdk: parseSimpleValue(gradleText, "compileSdk"),
    minSdk: parseSimpleValue(gradleText, "minSdk"),
    targetSdk: parseSimpleValue(gradleText, "targetSdk"),
    buildTypes: parseBlockNames(gradleText, "buildTypes"),
    productFlavors: parseBlockNames(gradleText, "productFlavors"),
    usesCompose: /compose\s*=\s*true|androidx\.compose|composeOptions/i.test(gradleText),
    usesKsp: /com\.google\.devtools\.ksp|\bksp\b/.test(gradleText),
    usesKapt: /kapt|kotlin-kapt/.test(gradleText),
    usesHilt: /hilt|dagger/i.test(gradleText),
    usesRoom: /androidx\.room|\broom\b/i.test(gradleText),
    usesWorkManager: /androidx\.work|workmanager/i.test(gradleText),
    usesDataStore: /androidx\.datastore|datastore/i.test(gradleText),
    hasAndroidTest: existsSync(join(directory, "src", "androidTest")),
    hasUnitTest: existsSync(join(directory, "src", "test")),
    hasNativeCode: existsSync(join(directory, "src", "main", "cpp")) || existsSync(join(directory, "src", "main", "jniLibs")),
  };
}

function parseVersions(root: string): AndroidVersionInfo {
  const catalogPath = join(root, "gradle", "libs.versions.toml");
  const wrapperPath = join(root, "gradle", "wrapper", "gradle-wrapper.properties");
  const catalog = safeRead(catalogPath);
  const wrapper = safeRead(wrapperPath);
  const versionValue = (name: string) => catalog.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`))?.[1];
  return {
    agp: versionValue("agp"),
    kotlin: versionValue("kotlin"),
    ksp: versionValue("ksp"),
    composeCompiler: versionValue("composeCompiler"),
    gradleWrapper: wrapper.match(/gradle-([\d.]+)-/i)?.[1],
  };
}

export function scanAndroidProject(root: string): AndroidProjectScan {
  const settingsKts = join(root, "settings.gradle.kts");
  const settingsGroovy = join(root, "settings.gradle");
  const settingsFile = existsSync(settingsKts) ? settingsKts : existsSync(settingsGroovy) ? settingsGroovy : null;
  const settingsText = settingsFile ? safeRead(settingsFile) : "";
  const gradleWrapperFiles = [join(root, "gradlew"), join(root, "gradlew.bat")].filter(existsSync);
  const versionCatalogs = [join(root, "gradle", "libs.versions.toml")].filter(existsSync);
  const modulePaths = settingsText ? parseIncludes(settingsText) : [];
  const modules = modulePaths.map((modulePath) => detectModule(root, modulePath));
  const detected = Boolean(settingsFile || gradleWrapperFiles.length || modules.some((module) => module.pluginIds.some((id) => id.startsWith("com.android."))));
  const capabilities: AndroidCapabilities = {
    compose: modules.some((module) => module.usesCompose),
    xmlViews: modules.some((module) => existsSync(join(module.directory, "src", "main", "res", "layout"))),
    room: modules.some((module) => module.usesRoom),
    hilt: modules.some((module) => module.usesHilt),
    workManager: modules.some((module) => module.usesWorkManager),
    dataStore: modules.some((module) => module.usesDataStore),
    ndk: modules.some((module) => module.hasNativeCode),
    multiModule: modules.length > 1,
    releaseSigningConfigured: modules.some((module) => /signingConfigs|signingConfig/.test(safeRead(join(module.directory, "build.gradle.kts")) || safeRead(join(module.directory, "build.gradle")))),
  };
  const warnings: string[] = [];
  if (detected && gradleWrapperFiles.length === 0) warnings.push("Android project detected but Gradle wrapper is missing.");
  if (detected && modules.length === 0) warnings.push("Android settings file found but no modules were parsed.");
  if (modules.filter((module) => module.pluginIds.includes("com.android.application")).length > 1) warnings.push("Multiple Android application modules detected.");
  if (modules.some((module) => module.usesCompose) && !parseVersions(root).composeCompiler) warnings.push("Compose detected but compose compiler version could not be resolved from version catalog.");
  if (modules.some((module) => module.usesKsp && module.usesKapt)) warnings.push("A module uses both KSP and KAPT; generated code compatibility should be reviewed.");

  return {
    detected,
    root,
    gradleWrapper: { present: gradleWrapperFiles.length > 0, files: gradleWrapperFiles },
    settingsFile,
    versionCatalogs,
    modules,
    versions: parseVersions(root),
    capabilities,
    warnings,
    recommendedVerification: unique([
      modules.some((module) => module.pluginIds.includes("com.android.application")) ? "./gradlew :app:assembleDebug" : undefined,
      capabilities.compose ? "./gradlew :app:testDebugUnitTest" : undefined,
      capabilities.compose || modules.some((module) => module.hasAndroidTest) ? "./gradlew :app:connectedDebugAndroidTest" : undefined,
    ].filter(Boolean) as string[]),
  };
}
