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

[Quick Install](#-quick-install) • [Features](#-features) • [Installation Tutorial](#-installation-tutorial) • [CLI Commands](#-cli-commands)

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

<details>
<summary><b>View all 28 LSP servers</b></summary>

| # | Language | Server |
|---|---------|--------|
| 1 | Python | pyright |
| 2 | TypeScript/JS | typescript-language-server |
| 3 | Rust | rust-analyzer |
| 4 | Go | gopls |
| 5 | Docker | dockerfile-language-server |
| 6 | SQL | sql-language-server |
| 7 | Java | jdtls |
| 8 | C/C++ | clangd |
| 9 | PHP | intelephense |
| 10 | Ruby | solargraph |
| 11 | C# | csharp-ls |
| 12 | Bash/Shell | bash-language-server |
| 13 | YAML | yaml-language-server |
| 14 | HTML | vscode-html-language-server |
| 15 | CSS/SCSS/Less | vscode-css-language-server |
| 16 | Kotlin | kotlin-language-server |
| 17 | Dart/Flutter | dart language-server |
| 18 | Lua | lua-language-server |
| 19 | Svelte | svelte-language-server |
| 20 | Vue | vue-language-server |
| 21 | Terraform/HCL | terraform-ls |
| 22 | Tailwind CSS | tailwindcss-language-server |
| 23 | Zig | zls |
| 24 | Markdown | marksman |
| 25 | TOML | taplo |
| 26 | GraphQL | graphql-lsp |
| 27 | Elixir | elixir-ls |
| 28 | Scala | metals |

</details>

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

### 🧠 Global AI Instructions — AGENTS.md

Every OpenCode session automatically loads a comprehensive set of engineering best practices:

- **Software Engineering** — TDD, debugging methodology, code review, refactoring
- **Security** — OWASP Top 10, input validation, secrets management
- **Architecture** — API design, database patterns, error handling
- **UI/UX** — Accessibility (WCAG), responsive design, Core Web Vitals
- **DevOps** — Docker, CI/CD, monitoring, infrastructure as code
- **Language Patterns** — TypeScript, Python, Rust, Go best practices
- **AI Optimization** — Token efficiency, model selection, context management

> 📝 Fully customizable — edit `~/.config/opencode/AGENTS.md` to add your own rules. The installer will never overwrite your changes.

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

## 📖 Installation Tutorial

<details>
<summary><b>🪟 Windows — Step-by-Step Guide</b></summary>

### Prerequisites

- Windows 10/11
- PowerShell 5.1+ (pre-installed on Windows 10+)
- Internet connection

### Step 1: Open PowerShell as Administrator

Press `Win + X` → select **Windows Terminal (Admin)** or **PowerShell (Admin)**.

### Step 2: Run the Installer

```powershell
irm https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.ps1 | iex
```

The installer will automatically:
1. ✅ Install **Git** (via winget, if not present)
2. ✅ Install **Bun** runtime (if not present)
3. ✅ Install **OpenCode CLI** (if not present)
4. ✅ Deploy 30 AI Agents, 20 Profiles, MCP Tools, Skills
5. ✅ Pre-cache MCP server packages

### Step 3: Select LSP Servers

After the main installation, you'll see an interactive menu:

```
╔══════════════════════════════════════════╗
║       LSP Server Installation            ║
╠══════════════════════════════════════════╣
  [OK]  1. Python       (already installed)
  [ ]   2. TypeScript
  [ ]   3. Rust
  [ ]   4. Go
  ...
  a = Install all    s = Skip all
  Or enter numbers:  1,2,4
╚══════════════════════════════════════════╝

  Your choice: _
```

- Type `a` to install all LSP servers
- Type `s` to skip (you can install later)
- Type specific numbers like `1,2,12` to install Python, TypeScript, and Bash

> LSP servers provide autocomplete, diagnostics, and go-to-definition inside OpenCode.

### Step 4: Verify Installation

Open a **new** PowerShell window, then:

```powershell
opencode-jce doctor
```

This checks that everything is configured correctly.

### Step 5: Start Using OpenCode

```powershell
cd your-project-folder
opencode
```

### Configuration Location

All config files are stored in:
```
%APPDATA%\opencode\
├── opencode.json       # Main config (LSP, MCP, providers)
├── agents.json         # 30 AI agents
├── profiles\           # 20 model profiles
├── mcp.json            # MCP server config
├── lsp.json            # LSP server definitions
├── skills\             # 35 on-demand skill files
└── AGENTS.md           # Global AI instructions
```

### Troubleshooting (Windows)

| Problem | Solution |
|---------|----------|
| `opencode` not found | Restart PowerShell or run `refreshenv` |
| `bun` not found | Close and reopen PowerShell |
| LSP not working | Run `opencode-jce setup --merge-lsp` |
| Permission denied | Run PowerShell as Administrator |

</details>

---

<details>
<summary><b>🐧 Ubuntu / Linux — Step-by-Step Guide</b></summary>

### Prerequisites

- Ubuntu 20.04+ / Debian 11+ / Fedora 36+ / Arch Linux
- Terminal access (bash or zsh)
- Internet connection
- `curl` installed (`sudo apt install curl` if missing)

### Step 1: Download and Run the Installer

> **Important:** For the full interactive experience (including LSP selection), download the script first instead of piping directly.

```bash
# Download the installer
curl -fsSL https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.sh -o install.sh

# Make it executable
chmod +x install.sh

# Run it
./install.sh
```

> **Why not `curl | bash`?** Piping directly works for the main installation, but the LSP selection menu requires interactive input. If you pipe, LSP selection will be skipped (but any already-installed LSPs will still be auto-detected and configured).

The installer will automatically:
1. ✅ Detect your OS and package manager (apt/dnf/pacman/brew)
2. ✅ Install **Git** (if not present)
3. ✅ Install **Bun** runtime (if not present)
4. ✅ Install **OpenCode CLI** (if not present)
5. ✅ Deploy 30 AI Agents, 20 Profiles, MCP Tools, Skills
6. ✅ Pre-cache MCP server packages

### Step 2: Select LSP Servers

After the main installation, you'll see an interactive menu:

```
╔══════════════════════════════════════════╗
║       LSP Server Installation            ║
╠══════════════════════════════════════════╣
  [✓]  1. Python       (already installed)
  [ ]  2. TypeScript
  [ ]  3. Rust
  [ ]  4. Go
  ...
  a = Install all    s = Skip all
  Or enter numbers: 1,2,4
╚══════════════════════════════════════════╝

  Your choice: _
```

- Type `a` to install all LSP servers
- Type `s` to skip (you can install later)
- Type specific numbers like `1,2,12` to install Python, TypeScript, and Bash

### Step 3: Verify Installation

```bash
# Reload your shell
source ~/.bashrc   # or: source ~/.zshrc

# Run health check
opencode-jce doctor
```

### Step 4: Start Using OpenCode

```bash
cd your-project-folder
opencode
```

### Configuration Location

All config files are stored in:
```
~/.config/opencode/
├── opencode.json       # Main config (LSP, MCP, providers)
├── agents.json         # 30 AI agents
├── profiles/           # 20 model profiles
├── mcp.json            # MCP server config
├── lsp.json            # LSP server definitions
├── skills/             # 35 on-demand skill files
└── AGENTS.md           # Global AI instructions
```

### Installing LSP Servers Manually (VPS / Post-Install)

If you skipped LSP during installation or need to add more later:

```bash
# Option 1: Interactive setup wizard
opencode-jce setup

# Option 2: Auto-detect installed LSPs and merge to opencode.json
opencode-jce setup --merge-lsp

# Option 3: Install specific LSPs manually, then merge
npm install -g typescript-language-server typescript
npm install -g pyright
npm install -g bash-language-server
npm install -g yaml-language-server
npm install -g vscode-langservers-extracted   # HTML + CSS + JSON

# After installing, merge into opencode.json:
opencode-jce setup --merge-lsp
```

### Common LSP Install Commands (Ubuntu/Debian)

```bash
# --- npm-based (requires Node.js) ---
npm install -g pyright                          # Python
npm install -g typescript-language-server typescript  # TypeScript/JS
npm install -g bash-language-server             # Bash/Shell
npm install -g yaml-language-server             # YAML
npm install -g vscode-langservers-extracted     # HTML + CSS + JSON
npm install -g dockerfile-language-server-nodejs # Docker
npm install -g sql-language-server              # SQL
npm install -g intelephense                     # PHP
npm install -g svelte-language-server           # Svelte
npm install -g @vue/language-server             # Vue
npm install -g @tailwindcss/language-server     # Tailwind CSS
npm install -g graphql-language-service-cli     # GraphQL

# --- apt-based ---
sudo apt-get install -y clangd                  # C/C++

# --- Language-specific ---
go install golang.org/x/tools/gopls@latest      # Go
rustup component add rust-analyzer              # Rust
gem install solargraph                          # Ruby
dotnet tool install -g csharp-ls                # C#
```

### Verifying LSP is Configured

After installation, check your `opencode.json`:

```bash
cat ~/.config/opencode/opencode.json | grep -A 5 '"lsp"'
```

You should see entries like:
```json
{
  "lsp": {
    "typescript": {
      "command": ["typescript-language-server", "--stdio"],
      "extensions": [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
    },
    "python": {
      "command": ["pyright-langserver", "--stdio"],
      "extensions": [".py", ".pyi"]
    }
  }
}
```

If the `"lsp"` section is missing or empty, run:
```bash
opencode-jce setup --merge-lsp
```

### Troubleshooting (Linux)

| Problem | Solution |
|---------|----------|
| `opencode` not found | Run `source ~/.bashrc` or restart terminal |
| `bun` not found | Run `source ~/.bashrc` or check `~/.bun/bin` is in PATH |
| LSP menu didn't appear | You likely piped the install. Run `opencode-jce setup` |
| LSP not in opencode.json | Run `opencode-jce setup --merge-lsp` |
| `npm` not found | Install Node.js: `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt install -y nodejs` |
| Permission denied | Use `sudo` for apt commands, or fix npm permissions: `npm config set prefix ~/.npm-global` |
| Script failed mid-way | Run with debug: `bash -x install.sh 2>&1 \| tee install-log.txt` |

### VPS / Server Quick Setup

For headless VPS where you want a minimal setup without interactive prompts:

```bash
# 1. Install via pipe (skips LSP selection automatically)
curl -fsSL https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.sh | bash

# 2. Reload shell
source ~/.bashrc

# 3. Install the LSPs you need
npm install -g typescript-language-server typescript pyright bash-language-server

# 4. Auto-merge installed LSPs into opencode.json
opencode-jce setup --merge-lsp

# 5. Verify
opencode-jce doctor
```

</details>

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
│   ├── AGENTS.md           # Global AI instructions
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
