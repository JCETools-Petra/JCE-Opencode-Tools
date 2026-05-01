# Skill: TypeScript / JavaScript
# Loaded on-demand when working with .ts, .js, .tsx, .jsx files

---

## TypeScript / JavaScript

```typescript
// ✅ Use strict TypeScript
// tsconfig: "strict": true, "noUncheckedIndexedAccess": true

// ✅ Discriminated unions over type assertions
type Result<T> = { ok: true; data: T } | { ok: false; error: Error };

// ✅ Avoid any — use unknown and narrow
function parse(input: unknown): Config {
  if (!isConfig(input)) throw new Error("Invalid config");
  return input;
}

// ✅ Nullish coalescing over logical OR
const port = config.port ?? 3000;  // 0 is valid
// ❌ config.port || 3000  — 0 becomes 3000

// ✅ Branded types for type safety
type UserId = string & { __brand: "UserId" };
type OrderId = string & { __brand: "OrderId" };
// Can't accidentally pass UserId where OrderId is expected

// ✅ Exhaustive switch with never
function handleStatus(status: "active" | "inactive" | "banned"): string {
  switch (status) {
    case "active": return "Welcome";
    case "inactive": return "Please verify email";
    case "banned": return "Account suspended";
    default: const _exhaustive: never = status; return _exhaustive;
  }
}

// ❌ Avoid: eval(), any, @ts-ignore, == (use ===), delete operator
```

**Node.js specifics:**
- Use `node:` prefix: `import { readFile } from "node:fs/promises"`
- Handle signals: SIGTERM, SIGINT for graceful shutdown
- Use `AbortController` for cancellation
- Streams for large data: `pipeline()` from `node:stream/promises`
- Worker threads for CPU-intensive tasks

---

## General Polyglot Rules

Regardless of language:
- **Consistent naming** within the project's convention
- **Small functions** — each does one thing (max ~40 lines)
- **Early returns** — reduce nesting, handle errors first
- **No magic numbers** — use named constants
- **Comments explain WHY, not WHAT** — code should be self-documenting
- **Delete dead code** — don't comment it out, that's what git is for
- **Immutability by default** — mutate only when necessary
- **Parse, don't validate** — transform untyped data into typed structures at boundaries
