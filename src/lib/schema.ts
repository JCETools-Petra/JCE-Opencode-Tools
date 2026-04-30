import Ajv from "ajv";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ajv = new Ajv({ allErrors: true });

/**
 * Get the path to the schemas directory (relative to the repo root).
 * Since this CLI runs via `bun run src/index.ts` or as a global install,
 * we resolve relative to the package root.
 */
function getSchemasDir(): string {
  // When running from source: resolve from this file's location
  const thisFile = fileURLToPath(import.meta.url);
  const srcDir = dirname(dirname(thisFile)); // src/lib -> src -> root
  return join(srcDir, "..", "schemas");
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Load a JSON schema file from the schemas/ directory.
 */
async function loadSchema(schemaFileName: string): Promise<object> {
  const schemaPath = join(getSchemasDir(), schemaFileName);
  const content = await readFile(schemaPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Validate a data object against a named schema file.
 */
export async function validateAgainstSchema(
  data: unknown,
  schemaFileName: string
): Promise<ValidationResult> {
  const schema = await loadSchema(schemaFileName);
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors || []).map((err) => {
    const path = err.instancePath || "/";
    return `${path} ${err.message}`;
  });

  return { valid: false, errors };
}
