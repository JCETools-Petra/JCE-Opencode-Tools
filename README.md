# OpenCode Suite

> One command. Full setup. Zero hassle.

OpenCode Suite gives you a complete, optimized OpenCode CLI environment in a single terminal command. It installs all required tools and configures 14 AI agents, 8 model profiles, MCP tools, and LSP settings automatically.

## Quick Install

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/USERNAME/opencode-suite/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/USERNAME/opencode-suite/main/install.ps1 | iex
```

## What Gets Installed

| Tool | Purpose |
|------|---------|
| Git | Version control |
| Bun | JavaScript runtime & package manager |
| OpenCode CLI | AI-powered coding assistant |

> Already have these installed? They'll be detected and skipped automatically.

## What Gets Configured

### 14 AI Agents

Specialized agents for every task:

| Agent | Role |
|-------|------|
| Debugger | Bug hunting & troubleshooting |
| Reviewer | Code review & best practices |
| Security | Vulnerability scanning |
| Docs Researcher | Library documentation lookup |
| Architect | System design |
| Refactorer | Code cleanup |
| Tester | Test writing |
| DevOps | CI/CD & deployment |
| Frontend | UI development |
| Backend | API development |
| Database | SQL & schema design |
| Performance | Profiling & optimization |
| Mentor | Teaching & explanations |
| Planner | Task breakdown |

### 8 Model Profiles

| Profile | Best For |
|---------|----------|
| `codex-5.3` | Full power coding |
| `sonnet-4.6` | Balanced quality/speed |
| `opus-latest` | Maximum quality |
| `hybrid-hemat` | Cost-optimized (auto-routes) |
| `speed` | Fastest responses |
| `quality` | Best output quality |
| `local` | Offline/privacy (Ollama) |
| `budget` | Maximum savings |

### MCP Tools

- **Context7** — Real-time library documentation search
- **GitHub Search** — Search code across GitHub
- **Web Fetch** — Retrieve web content

### LSP Support

Autocomplete and error highlighting for: Python, TypeScript/JavaScript, Rust, Docker, SQL

## Token Saving

Every profile includes built-in token optimization:
- Context truncation to reduce unnecessary history
- Aggressive summarization in budget profiles
- Per-agent token budgets (not one-size-fits-all)

## Requirements

- Terminal access (bash, zsh, or PowerShell)
- Internet connection
- Admin/sudo access (for installing Git on Linux)

## After Installation

```bash
opencode
```

That's it. All agents, profiles, and tools are ready to use.

## License

MIT
