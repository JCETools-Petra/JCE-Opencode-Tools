# Changelog

All notable changes to OpenCode JCE are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/), versioned with [Semantic Versioning](https://semver.org/).

---

## [2.0.16] - 2026-05-08

### Fixed
- Registered Token Savings as an OpenCode TUI plugin via `tui.json` so fresh installs load the sidebar widget on OpenCode 1.14.34.
- Split `opencode-jce` server plugin and `opencode-jce-token-savings` TUI plugin exports to match OpenCode plugin loader requirements.

### Changed
- Converted Token Savings sidebar source to `src/plugin/tui.tsx` using OpenTUI Solid JSX.
- Bumped project, installer, config, MCP, README, and release workflow test versions to `2.0.16`.

### Verified
- `bun run typecheck`
- `bun test` (`700 pass`, `0 fail`)

---

## [2.0.15] - 2026-05-08

### Added
- Added TUI sidebar Token Savings display between MCP and LSP sections.
- Persisted aggregate context budget telemetry so TUI can show saved percentage and compressed/original chars.

### Changed
- Hardened `opencode-jce update` directory fetch accounting, CLI staging rollback, and stale context-keeper command refresh.
- Bumped project, installer, config, MCP, README, and release workflow test versions to `2.0.15`.

### Verified
- `bun run typecheck`
- `bun test` (`698 pass`, `0 fail`)

---

## [2.0.13] - 2026-05-08

### Fixed
- Linux LSP installer now installs missing prerequisites before installing dependent language servers.
- Added automatic prerequisite setup for Go, Rust/Cargo, RubyGems, .NET SDK, Elixir/Mix, and Coursier.
- Fixed Linux LSP commands for gopls, Solargraph, Taplo, ElixirLS, Metals, and csharp-ls so they no longer fail silently when toolchains are missing.
- Added regression coverage for Linux LSP prerequisite installers and removed stale direct install-command expectations.

### Changed
- Removed generated docs from the repository and kept `docs/` ignored.
- Bumped project, installer, config, MCP, README, and release workflow test versions to `2.0.13`.

### Verified
- `bash -n install.sh`
- `bun run typecheck`
- `bun test` (`688 pass`, `0 fail`)
- `bun ./src/index.ts --version` (`2.0.13`)

---

## [2.0.12] - 2026-05-08

### Fixed
- Hardened plugin audit follow-ups while leaving the explicitly skipped fallback endpoint issue untouched.
- Protected team profile resolution from path traversal and pinned team config writes to the expected config path.
- Added manifest and MCP validation plus safer registry writes for plugin installation flows.
- Required verification evidence for empty workflow completion paths.
- Expired stale background tasks during status reads and freed concurrency slots.
- Hardened Linux installer tarball fallback by validating extracted repository layout before use.
- Added OpenCode model discovery caching to reduce repeated settings lookups.

### Changed
- Added release context checkpoint for `2.0.12`.
- Preserved Windows installer behavior while Linux installer hardening continued separately in later release work.

### Verified
- `bash -n install.sh`
- PowerShell parser validation for `install.ps1`
- `bun run typecheck`
- `bun test`
- `bun ./src/index.ts --version` (`2.0.12`)

---

## [1.2.0] — 2026-05-01

### Added
- **35 on-demand skill files** — modular AI instructions loaded based on task context
  - Core: software-engineering, security, architecture, frontend, devops, developer-tooling, ai-optimization, advanced-patterns, sql-database, tailwind
  - Frontend frameworks: React, Vue, Svelte, Next.js, Angular
  - Backend frameworks: Laravel, Django/FastAPI, Express/NestJS, Spring Boot, Rails
  - Mobile: React Native, Flutter/Dart, Swift/iOS
  - Languages: TypeScript, Python, Rust, Go, C#, Java/Kotlin, PHP, Ruby, C/C++, Shell/Bash, Elixir, Scala
- **AGENTS.md v3.0** — compact router (97 lines) that auto-loads relevant skills
- **28 LSP servers** — expanded from 10 to 28 (added C#, Bash, YAML, HTML, CSS, Kotlin, Dart, Lua, Svelte, Vue, Terraform, Tailwind, Zig, Markdown, TOML, GraphQL, Elixir, Scala)
- **fallback.schema.json** — schema validation for provider fallback config
- **`src/lib/constants.ts`** — centralized version, GitHub URL, model pricing
- **Shared `formatCost()` helper** in `ui.ts` — removed duplicates from dashboard and tokens
- **CI: `bun test` job** — tests now actually run in CI
- **CI: schema validation** — AJV validates all configs against schemas
- **CI: Bun caching** — faster CI runs with dependency caching
- LICENSE, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md

### Fixed
- **Security: command injection** in `plugins.ts` — replaced `execSync` with `Bun.spawn` array form
- **Security: path traversal** in `prompts.ts` — validate resolved path stays within prompts directory
- **Security: filesystem MCP root access** — restricted from `/` to `./` (current directory only)
- **CI: `bun.lockb` → `bun.lock`** — cache key referenced wrong lockfile name
- **CI: `--frozen-lockfile` removed** — caused failures due to Bun version mismatch
- **CI: Windows compatibility** — explicit `bun run ./src/index.ts` for cross-platform
- **Windows installer: winget exit code 43** — "already installed" now treated as success
- **Windows installer: gopls build** — stderr progress no longer treated as failure
- **Windows installer: correct winget IDs** — fixed LLVM, Lua, Dart, Terraform, Elixir, Marksman
- **Windows installer: C# LSP** — switched from broken `omnisharp` to `csharp-ls v0.15.0`
- **Windows installer: Java LSP** — downloads Eclipse JDTLS binary instead of non-existent npm package
- **Unguarded `JSON.parse`** — added try/catch in agents, fallback, plugins, schema, merge-config (6 files)
- **Version mismatch** — synchronized `1.1.0` across `install.sh`, `install.ps1`, `ui.ts`, `index.ts`
- **`install.sh` summary counts** — corrected from "14 agents/8 profiles" to "30/20"
- **README inaccuracies** — MCP count 6→5, removed Brave Search, fixed provider labels

### Changed
- **AGENTS.md** — rewritten from monolithic 1333-line file to 97-line router + 35 modular skill files
- **Hardcoded values extracted** — version, GitHub URL, model pricing moved to `constants.ts`
- **`Invoke-Expression` replaced** — Windows installer uses safer `cmd /c` for LSP installs

---

## [1.1.0] — 2026-04-30

### Added
- Interactive LSP server selection during install
- MCP package pre-caching to prevent timeout
- Dead feature wiring and Windows compatibility fixes

### Fixed
- Removed paid Brave Search MCP
- Doctor shows MCP exit 143 as OK
- Profile schema supports all providers
- Removed API key setup (managed by OpenCode CLI)
- Windows global CLI install fixes (.cmd wrapper)
- PowerShell installer ASCII-only for `irm|iex` compatibility

---

## [1.0.0] — 2026-04-28

### Added
- 16 CLI commands (validate, use, doctor, setup, update, uninstall, route, tokens, optimize, agent, prompts, plugin, team, memory, dashboard, fallback)
- 30 AI agents with specialized system prompts
- 20 model profiles (Anthropic, OpenAI, Google, DeepSeek, xAI, Mistral, Ollama)
- 5 MCP servers (Context7, GitHub Search, Web Fetch, Filesystem, Memory)
- 10 LSP server configurations
- Smart routing engine for automatic model selection
- Token usage tracking with cost breakdown
- Multi-provider fallback with health checks
- Rate limit handler with exponential backoff
- Cost optimizer with usage pattern analysis
- Custom agent builder (CRUD)
- Prompt template library
- Community plugin system
- Team config sharing via Git
- Persistent context memory
- Analytics dashboard
- Docker support
- Offline bundle support
- GitHub Actions CI pipeline
- Cross-platform installers (Bash + PowerShell)
- JSON Schema validation for all configs
