import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const CLI_PAYLOAD_MANIFEST_PATH = join("config", "cli-payload.txt");

export function resolveCliPayloadManifestPath(baseDir = process.cwd()): string {
  const direct = join(baseDir, CLI_PAYLOAD_MANIFEST_PATH);
  if (existsSync(direct)) return direct;
  const cliNested = join(baseDir, "cli", CLI_PAYLOAD_MANIFEST_PATH);
  if (existsSync(cliNested)) return cliNested;
  return direct;
}

export function getRequiredCliPayloadFiles(baseDir = process.cwd()): string[] {
  const path = resolveCliPayloadManifestPath(baseDir);
  if (!existsSync(path)) throw new Error(`Missing CLI payload manifest: ${path}`);
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
}
