import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const CLI_PAYLOAD_MANIFEST_PATH = join("config", "cli-payload.txt");

export function getRequiredCliPayloadFiles(baseDir = process.cwd()): string[] {
  const path = join(baseDir, CLI_PAYLOAD_MANIFEST_PATH);
  if (!existsSync(path)) throw new Error(`Missing CLI payload manifest: ${path}`);
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
}
