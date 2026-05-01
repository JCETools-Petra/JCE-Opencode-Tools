<div align="center">

# ⚡ OpenCode JCE

### The Ultimate OpenCode CLI Toolkit

[![CI](https://github.com/JCETools-Petra/JCE-Opencode-Tools/actions/workflows/ci.yml/badge.svg)](https://github.com/JCETools-Petra/JCE-Opencode-Tools/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-brightgreen)]()
[![Agents](https://img.shields.io/badge/AI%20Agents-30-purple)]()
[![Profiles](https://img.shields.io/badge/Model%20Profiles-20-orange)]()

**One command. Full setup. Zero hassle.**

Transform your terminal into a fully-configured AI coding powerhouse — 30 specialized agents, 20 model profiles, smart routing, token tracking, and more.

[Quick Install](#-quick-install) • [Features](#-features) • [CLI Commands](#-cli-commands) • [Documentation](#-documentation)

</div>

---

## 🚀 Quick Install

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.ps1 | iex
```

> ⏱️ Takes ~1-2 minutes. Already have Git/Bun/OpenCode? They'll be detected and skipped automatically.

> 🔒 **Safe for existing setups** — merges with your current config (Superpowers, MCP servers, etc.) without overwriting anything.

---

## ✨ Features

### 🤖 30 AI Agents — Specialists for Every Task

Each agent has a **250+ word system prompt** with chain-of-thought reasoning, structured output format, anti-patterns, and context awareness.

<details>
<summary><b>View all 30 agents</b></summary>

| # | Agent | Specialization |
|---|-------|---------------|
| 1 | `debugger` | Systematic fault isolation & root cause analysis |
| 2 | `reviewer` | Code review with severity-ranked feedback |
| 3 | `security` | OWASP Top 10, vulnerability scanning, threat modeling |
| 4 | `docs-researcher` | Real-time library documentation lookup |
| 5 | `architect` | System design, trade-off analysis, YAGNI |
| 6 | `refactorer` | Incremental code improvement without behavior change |
| 7 | `tester` | TDD, behavior-focused tests, edge case coverage |
| 8 | `devops` | CI/CD, Docker, infrastructure as code |
| 9 | `frontend` | Accessible, responsive, performant UIs |
| 10 | `backend` | Robust APIs, validation, error handling |
| 11 | `database` | Schema design, query optimization, migrations |
| 12 | `performance` | Data-driven profiling & optimization |
| 13 | `mentor` | Patient teaching with analogies & examples |
| 14 | `planner` | Task breakdown & dependency mapping |
| 15 | `api-designer` | REST/GraphQL API design, OpenAPI specs |
| 16 | `cloud-architect` | AWS/GCP/Azure, Terraform, scaling |
| 17 | `mobile-dev` | iOS, Android, React Native, Flutter |
| 18 | `ml-engineer` | ML pipelines, model training, data science |
| 19 | `technical-writer` | Clear documentation, API docs, changelogs |
| 20 | `git-expert` | Complex git workflows, merge conflicts |
| 21 | `shell-scripter` | Bash/PowerShell automation |
| 22 | `regex-master` | Pattern matching & text extraction |
| 23 | `accessibility` | WCAG compliance, inclusive design |
| 24 | `i18n-expert` | Internationalization & localization |
| 25 | `data-engineer` | ETL pipelines, data modeling, warehousing |
| 26 | `code-migrator` | Framework/language migrations |
| 27 | `dependency-manager` | Package updates, vulnerability fixes |
| 28 | `error-handler` | Resilience patterns, graceful degradation |
| 29 | `ui-designer` | Design systems, wireframes, user flows |
| 30 | `optimizer` | Bundle size, caching, Core Web Vitals |

</details>

---

### 🎯 20 Model Profiles — Right Model for Every Task

Switch between providers and models instantly. From budget-friendly to maximum quality.

<details>
<summary><b>View all 20 profiles</b></summary>

| Profile | Provider | Best For |
|---------|----------|----------|
| `sonnet-4.6` | Anthropic | Balanced quality/speed ⭐ |
| `opus-latest` | Anthropic | Maximum quality output |
| `claude-haiku` | Anthropic | Lightning fast & cheap |
| `codex-5.3` | OpenAI | Full power coding |
| `gpt-4o` | OpenAI | Flagship all-rounder |
| `o3` | OpenAI | Deep reasoning & math |
| `gemini-2.5` | Google | Best reasoning, 1M context |
| `gemini-flash` | Google | Ultra fast & cheap |
| `deepseek-v3` | DeepSeek | Extremely cost-effective |
| `deepseek-coder` | DeepSeek | Coding specialist |
| `grok-3` | xAI | Real-time knowledge |
| `mistral-large` | Mistral | European, GDPR-friendly |
| `codestral` | Mistral | Code-only specialist |
| `hybrid-hemat` | Auto | Smart routing (saves 30-60%) |
| `speed` | OpenAI | Fastest available |
| `quality` | Anthropic | Best available |
| `budget` | OpenAI | Maximum savings |
| `local` | Ollama | Offline (CodeLlama 13B) |
| `llama-70b` | Ollama | Local powerhouse |
| `qwen-coder` | Ollama | Local coding specialist |

</details>

---

### 🧠 Smart Routing — Automatic Model Selection

The `hybrid-hemat` profile automatically analyzes your prompt and routes to the optimal model:

```
"what is a variable?"          → gpt-4o-mini (cheap)     💰 $0.0001
"implement auth middleware"    → claude-sonnet (balanced) 💰 $0.005
"redesign microservice arch"   → claude-opus (powerful)   💰 $0.05
```

**Result:** Save 30-60% on token costs without sacrificing quality.

---

### 🔌 5 MCP Tools — Real-Time AI Capabilities

| Tool | Capability |
|------|-----------|
| **Context7** | Search library documentation in real-time |
| **GitHub Search** | Find code across GitHub repositories |
| **Web Fetch** | Retrieve and analyze web content |
| **Filesystem** | Read and search local files |
| **Memory** | Persistent context across sessions |

---

### 📝 28 LSP Servers — Autocomplete for Every Language

Python • TypeScript/JavaScript • Rust • Go • Java • C/C++ • PHP • Ruby • Docker • SQL

---

### 💰 Built-in Cost Optimization

- **Token tracking** — Monitor usage per day/week/month
- **Cost breakdown** — By provider, agent, and model
- **Smart suggestions** — "Switch debugger to Sonnet, save ~$1.50/month"
- **Context truncation** — Automatically trim irrelevant history
- **Aggressive summarization** — In budget profiles

---

### 🛡️ Safe & Secure

- API keys stored as **environment variables** (never in config files)
- **Rate limit handler** with exponential backoff
- **Multi-provider fallback** — if one provider is down, auto-switch
- **Merge-based installer** — never overwrites your existing config

---

## 🖥️ CLI Commands

After installation, you get the `opencode-jce` management tool with **15 commands**:

```bash
# Health & Setup
opencode-jce doctor              # Full health check
opencode-jce setup               # Interactive first-time wizard
opencode-jce validate            # Validate all config files

# Model Management
opencode-jce use <profile>       # Switch active profile
opencode-jce use --list          # Show all profiles
opencode-jce route "your prompt" # See which model would be selected

# Cost & Analytics
opencode-jce tokens              # Token usage & costs
opencode-jce tokens --period week
opencode-jce optimize            # Cost optimization suggestions
opencode-jce dashboard           # Rich analytics dashboard

# Agent & Prompt Management
opencode-jce agent list          # List all 30 agents
opencode-jce agent create        # Create custom agent
opencode-jce prompts list        # View prompt templates
opencode-jce prompts apply concise debugger

# Extensions
opencode-jce plugin install <url>  # Install community plugin
opencode-jce plugin list           # List installed plugins

# Memory
opencode-jce memory set <key> <value>  # Store context
opencode-jce memory search <query>     # Search memories

# Team
opencode-jce team init <repo-url>  # Setup team sync
opencode-jce team push             # Share config
opencode-jce team pull             # Pull latest

# Maintenance
opencode-jce update              # Update to latest version
opencode-jce uninstall           # Clean removal (with backup)
```

---

## 📦 Installation Options

### Standard (Online)

```bash
# Linux/macOS
curl -fsSL https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.sh | bash

# Windows
irm https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.ps1 | iex
```

### Docker

```bash
docker build -t opencode-jce .
docker run -it opencode-jce doctor
```

### Offline (Air-gapped)

```bash
# On machine with internet:
./scripts/bundle-offline.sh

# Transfer tarball to target, then:
tar -xzf opencode-jce-offline-v1.1.0.tar.gz
cd opencode-jce-offline && ./install-offline.sh
```

---

## 📋 Requirements

| Requirement | Details |
|-------------|---------|
| Terminal | bash, zsh, or PowerShell 5.1+ |
| Internet | For installation & API calls |
| OS | Linux, macOS, or Windows |
| Permissions | sudo/admin (only for Git install on Linux) |

---

## 🏗️ Architecture

```
opencode-jce/
├── src/                    # CLI tool (TypeScript + Bun)
│   ├── index.ts            # Entry point (15 commands)
│   ├── commands/           # Command implementations
│   └── lib/                # Shared libraries
├── config/                 # Pre-configured settings
│   ├── agents.json         # 30 AI agents
│   ├── profiles/           # 20 model profiles
│   ├── mcp.json            # 5 MCP tools
│   ├── lsp.json            # 28 LSP servers
│   ├── prompts/            # 5 prompt templates
│   └── fallback.json       # Provider fallback config
├── schemas/                # JSON Schema validation
├── scripts/                # Merge & bundle scripts
├── tests/                  # Integration tests
├── .github/workflows/      # CI/CD pipeline
├── install.sh              # Linux/macOS installer
├── install.ps1             # Windows installer
└── Dockerfile              # Container support
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [JCETools-Petra](https://github.com/JCETools-Petra)

---

<div align="center">

**Built with ❤️ for the OpenCode community**

[Report Bug](https://github.com/JCETools-Petra/JCE-Opencode-Tools/issues) • [Request Feature](https://github.com/JCETools-Petra/JCE-Opencode-Tools/issues)

</div>
