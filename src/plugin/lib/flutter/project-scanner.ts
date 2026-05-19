import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface FlutterProjectScan {
  detected: boolean;
  root: string;
  pubspecPath: string | null;
  name?: string;
  version?: string;
  platforms: string[];
  dependencies: string[];
  devDependencies: string[];
  stateManagement: string[];
  routing: string[];
  persistence: string[];
  networking: string[];
  usesCodegen: boolean;
  usesMelos: boolean;
  hasTests: boolean;
  hasIntegrationTests: boolean;
  warnings: string[];
  recommendedVerification: string[];
}

function read(path: string): string { return existsSync(path) ? readFileSync(path, "utf8") : ""; }
function unique<T>(items: T[]): T[] { return [...new Set(items)]; }
function yamlValue(text: string, key: string): string | undefined { return text.match(new RegExp(`^${key}:\\s*([^\\n]+)`, "m"))?.[1]?.trim().replace(/["']/g, ""); }
function hasDep(text: string, dep: string): boolean { return new RegExp(`^\\s{2}${dep}:`, "m").test(text) || new RegExp(`\\b${dep}:`).test(text); }
function deps(text: string): string[] { return [...text.matchAll(/^\s{2}([a-zA-Z0-9_]+):/gm)].map((m) => m[1]).filter(Boolean) as string[]; }

export function scanFlutterProject(root: string): FlutterProjectScan {
  const pubspecPath = join(root, "pubspec.yaml");
  const pubspec = read(pubspecPath);
  const detected = Boolean(pubspec || existsSync(join(root, "lib", "main.dart")) || existsSync(join(root, "android")) && existsSync(join(root, "ios")) && existsSync(join(root, "lib")));
  const platforms = ["android", "ios", "web", "macos", "windows", "linux"].filter((platform) => existsSync(join(root, platform)));
  const dependencies = deps(pubspec);
  const stateManagement = ["flutter_riverpod", "riverpod", "provider", "bloc", "flutter_bloc", "get", "mobx"].filter((dep) => hasDep(pubspec, dep));
  const routing = ["go_router", "auto_route", "beamer"].filter((dep) => hasDep(pubspec, dep));
  const persistence = ["hive", "isar", "drift", "shared_preferences", "flutter_secure_storage", "sqflite"].filter((dep) => hasDep(pubspec, dep));
  const networking = ["dio", "http", "retrofit", "graphql_flutter"].filter((dep) => hasDep(pubspec, dep));
  const usesCodegen = ["build_runner", "freezed", "json_serializable", "riverpod_generator", "auto_route_generator"].some((dep) => hasDep(pubspec, dep));
  const warnings: string[] = [];
  if (detected && !pubspec) warnings.push("Flutter signals detected but pubspec.yaml is missing.");
  if (detected && !existsSync(join(root, "lib", "main.dart"))) warnings.push("Flutter project detected but lib/main.dart is missing.");
  if (usesCodegen && !existsSync(join(root, "build.yaml"))) warnings.push("Code generation packages detected; verify build_runner workflow and generated files.");
  return {
    detected,
    root,
    pubspecPath: existsSync(pubspecPath) ? pubspecPath : null,
    name: yamlValue(pubspec, "name"),
    version: yamlValue(pubspec, "version"),
    platforms,
    dependencies,
    devDependencies: dependencies,
    stateManagement,
    routing,
    persistence,
    networking,
    usesCodegen,
    usesMelos: existsSync(join(root, "melos.yaml")) || hasDep(pubspec, "melos"),
    hasTests: existsSync(join(root, "test")),
    hasIntegrationTests: existsSync(join(root, "integration_test")),
    warnings,
    recommendedVerification: unique(["flutter pub get", "flutter analyze", existsSync(join(root, "test")) ? "flutter test" : undefined, platforms.includes("android") ? "flutter build apk --debug" : undefined].filter(Boolean) as string[]),
  };
}
