import { execFileSync } from "node:child_process";

export interface FlutterDeviceInfo { id: string; name: string; platform: string }
export interface FlutterEnvironmentProbe { flutter: { available: boolean; version?: string }; dart: { available: boolean; version?: string }; doctor: { available: boolean; summary?: string }; devices: FlutterDeviceInfo[]; blockers: string[]; warnings: string[] }
export type FlutterProbeRunner = (command: string, args: string[]) => { stdout: string; stderr?: string };
const defaultRunner: FlutterProbeRunner = (command, args) => ({ stdout: execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) });
function tryRun(runner: FlutterProbeRunner, command: string, args: string[]): string | null { try { const result = runner(command, args); return `${result.stdout}\n${result.stderr ?? ""}`.trim(); } catch { return null; } }
function parseDevices(text: string | null): FlutterDeviceInfo[] {
  if (!text) return [];
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.includes("•") && !line.toLowerCase().includes("no devices"))
    .map((line) => { const parts = line.split("•").map((part) => part.trim()); return parts.length >= 3 ? { name: parts[0] ?? "unknown", id: parts[1] ?? "unknown", platform: parts.slice(2).join(" • ") } : null; })
    .filter((item): item is FlutterDeviceInfo => item !== null);
}
export function probeFlutterEnvironment(runner: FlutterProbeRunner = defaultRunner): FlutterEnvironmentProbe {
  const flutterVersion = tryRun(runner, "flutter", ["--version"]);
  const dartVersion = tryRun(runner, "dart", ["--version"]);
  const doctor = tryRun(runner, "flutter", ["doctor", "-v"]);
  const devicesOutput = tryRun(runner, "flutter", ["devices"]);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!flutterVersion) blockers.push("Flutter SDK is not available on PATH.");
  if (!dartVersion) blockers.push("Dart SDK is not available on PATH.");
  if (doctor && /\[✗\]|\[x\]/i.test(doctor)) warnings.push("flutter doctor reports one or more failed toolchain checks.");
  const devices = parseDevices(devicesOutput);
  if (flutterVersion && devices.length === 0) warnings.push("No Flutter device target detected; device/integration flows may be blocked.");
  return { flutter: { available: Boolean(flutterVersion), version: flutterVersion?.split(/\r?\n/)[0] }, dart: { available: Boolean(dartVersion), version: dartVersion?.split(/\r?\n/)[0] }, doctor: { available: Boolean(doctor), summary: doctor?.split(/\r?\n/).slice(0, 8).join("\n") }, devices, blockers, warnings };
}
