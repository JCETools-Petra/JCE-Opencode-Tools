#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# OpenCode JCE — Installer
# One command to install everything you need for OpenCode CLI
# ═══════════════════════════════════════════════════════════════

VERSION="1.1.0"
REPO_URL="https://github.com/JCETools-Petra/JCE-Opencode-Tools.git"
TEMP_DIR="/tmp/opencode-jce-install"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Status tracking
GIT_STATUS="skip"
BUN_STATUS="skip"
OPENCODE_STATUS="skip"
LSP_INSTALLED=0

# ─── Helper Functions ─────────────────────────────────────────

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════╗"
    echo "║       OpenCode JCE Installer v${VERSION}       ║"
    echo "╠══════════════════════════════════════════╣"
    echo "║  Installing: Git, Bun, OpenCode CLI     ║"
    echo "║  Configuring: Agents, Profiles, MCP,LSP ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; }

detect_os() {
    case "$(uname -s)" in
        Linux*)  OS="linux";;
        Darwin*) OS="macos";;
        MINGW*|MSYS*|CYGWIN*) 
            echo -e "${YELLOW}Detected Windows via Git Bash/MSYS.${NC}"
            echo "Please use PowerShell instead:"
            echo -e "${CYAN}  irm https://raw.githubusercontent.com/JCETools-Petra/JCE-Opencode-Tools/main/install.ps1 | iex${NC}"
            exit 0
            ;;
        *) error "Unsupported OS: $(uname -s)";;
    esac

    ARCH="$(uname -m)"
    case "$ARCH" in
        x86_64|amd64) ARCH="x64";;
        aarch64|arm64) ARCH="arm64";;
        *) error "Unsupported architecture: $ARCH";;
    esac

    info "Detected: ${OS} (${ARCH})"
}

detect_package_manager() {
    if [ "$OS" = "macos" ]; then
        if command -v brew &>/dev/null; then
            PKG_MGR="brew"
        else
            PKG_MGR="none"
        fi
    elif [ "$OS" = "linux" ]; then
        if command -v apt-get &>/dev/null; then
            PKG_MGR="apt"
        elif command -v dnf &>/dev/null; then
            PKG_MGR="dnf"
        elif command -v pacman &>/dev/null; then
            PKG_MGR="pacman"
        else
            PKG_MGR="none"
        fi
    fi
    info "Package manager: ${PKG_MGR}"
}

# ─── Installation Steps ──────────────────────────────────────

install_git() {
    info "Checking Git..."
    if command -v git &>/dev/null; then
        local ver=$(git --version | awk '{print $3}')
        skip "Git v${ver} already installed"
        GIT_STATUS="skip"
        return
    fi

    info "Installing Git..."
    case "$PKG_MGR" in
        brew)   brew install git;;
        apt)    sudo apt-get update && sudo apt-get install -y git;;
        dnf)    sudo dnf install -y git;;
        pacman) sudo pacman -S --noconfirm git;;
        none)
            if [ "$OS" = "macos" ]; then
                info "Installing Xcode Command Line Tools (includes Git)..."
                xcode-select --install 2>/dev/null || true
                warn "Please complete the Xcode CLT installation popup, then re-run this script."
                exit 0
            else
                error "No package manager found. Please install Git manually."
            fi
            ;;
    esac

    if command -v git &>/dev/null; then
        success "Git installed: $(git --version | awk '{print $3}')"
        GIT_STATUS="installed"
    else
        error "Git installation failed"
    fi
}

install_bun() {
    info "Checking Bun..."
    if command -v bun &>/dev/null; then
        local ver=$(bun --version)
        skip "Bun v${ver} already installed"
        BUN_STATUS="skip"
        return
    fi

    info "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash

    # Source the updated profile to get bun in PATH
    export BUN_INSTALL="${HOME}/.bun"
    export PATH="${BUN_INSTALL}/bin:${PATH}"

    if command -v bun &>/dev/null; then
        success "Bun installed: v$(bun --version)"
        BUN_STATUS="installed"
    else
        error "Bun installation failed. Please restart your terminal and re-run."
    fi
}

install_opencode() {
    info "Checking OpenCode CLI..."
    if command -v opencode &>/dev/null; then
        skip "OpenCode CLI already installed"
        OPENCODE_STATUS="skip"
        return
    fi

    info "Installing OpenCode CLI..."
    bun install -g opencode

    if command -v opencode &>/dev/null; then
        success "OpenCode CLI installed"
        OPENCODE_STATUS="installed"
    else
        # Try adding bun global bin to PATH
        export PATH="${HOME}/.bun/bin:${PATH}"
        if command -v opencode &>/dev/null; then
            success "OpenCode CLI installed"
            OPENCODE_STATUS="installed"
        else
            error "OpenCode CLI installation failed"
        fi
    fi
}

deploy_config() {
    info "Deploying configuration..."

    # Clone config repo
    rm -rf "$TEMP_DIR"
    git clone --depth 1 "$REPO_URL" "$TEMP_DIR" 2>/dev/null || \
        error "Failed to clone config repository. Check your internet connection."

    # Ensure config directory exists
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$CONFIG_DIR/profiles"

    # Merge configuration (preserves existing settings)
    info "Merging configuration (preserving existing settings)..."
    bun run "$TEMP_DIR/scripts/merge-config.ts" "$TEMP_DIR/config" "$CONFIG_DIR"

    # Deploy AGENTS.md (only if not already present)
    if [ ! -f "$CONFIG_DIR/AGENTS.md" ]; then
        cp "$TEMP_DIR/config/AGENTS.md" "$CONFIG_DIR/AGENTS.md"
        success "AGENTS.md deployed"
    else
        skip "AGENTS.md already exists (preserved)"
    fi

    # Deploy skills (modular on-demand instructions)
    SKILLS_SRC="$TEMP_DIR/config/skills"
    SKILLS_DST="$CONFIG_DIR/skills"
    if [ -d "$SKILLS_SRC" ]; then
        mkdir -p "$SKILLS_DST"
        for f in "$SKILLS_SRC"/*.md; do
            fname=$(basename "$f")
            if [ ! -f "$SKILLS_DST/$fname" ]; then
                cp "$f" "$SKILLS_DST/$fname"
            fi
        done
        success "Skills deployed ($(ls "$SKILLS_DST"/*.md 2>/dev/null | wc -l) files)"
    fi

    success "Configuration deployed to: ${CONFIG_DIR}"

    # Install opencode-jce CLI globally
    info "Installing opencode-jce CLI..."
    (cd "$TEMP_DIR" && bun install && bun install -g .)
    if command -v opencode-jce &>/dev/null; then
        success "opencode-jce CLI installed globally"
    else
        warn "opencode-jce CLI installed but may not be in PATH. Restart your terminal."
    fi

    # Cleanup
    rm -rf "$TEMP_DIR"
}

# API keys are managed by OpenCode CLI directly - no setup needed here

precache_mcp_packages() {
    echo ""
    info "Pre-downloading MCP server packages..."
    info "This ensures MCP servers start instantly in OpenCode."
    echo ""

    # List of MCP packages to pre-cache (npm package names)
    local -a MCP_PACKAGES=(
        "@upstash/context7-mcp@latest"
        "@modelcontextprotocol/server-github"
        "@modelcontextprotocol/server-fetch"
        "@modelcontextprotocol/server-filesystem"
        "@modelcontextprotocol/server-memory"
    )

    local cached_count=0
    local failed_count=0

    for pkg in "${MCP_PACKAGES[@]}"; do
        local short_name="${pkg##*/}"
        echo -n "  Caching ${short_name}... "

        # Use npm cache add to download without executing
        if npm cache add "$pkg" &>/dev/null 2>&1; then
            echo -e "${GREEN}✅${NC}"
            ((cached_count++))
        else
            echo -e "${YELLOW}⚠️${NC}"
            ((failed_count++))
        fi
    done

    echo ""
    if [ "$cached_count" -gt 0 ]; then
        success "$cached_count MCP package(s) pre-cached."
    fi
    if [ "$failed_count" -gt 0 ]; then
        warn "$failed_count package(s) could not be cached. They will download on first use."
    fi
}

select_and_install_lsp() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║       LSP Server Installation            ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║                                          ║${NC}"
    echo -e "${CYAN}║  Select LSP servers to install:          ║${NC}"
    echo -e "${CYAN}║                                          ║${NC}"

    # Define LSP servers
    local -a LSP_NAMES=("Python" "TypeScript" "Rust" "Go" "Docker" "SQL" "Java" "C/C++" "PHP" "Ruby" "C#" "Bash" "YAML" "HTML" "CSS" "Kotlin" "Dart" "Lua" "Svelte" "Vue" "Terraform" "Tailwind CSS" "Zig" "Markdown" "TOML" "GraphQL" "Elixir" "Scala")
    local -a LSP_CMDS=("pyright-langserver" "typescript-language-server" "rust-analyzer" "gopls" "docker-langserver" "sql-language-server" "jdtls" "clangd" "intelephense" "solargraph" "OmniSharp" "bash-language-server" "yaml-language-server" "vscode-html-language-server" "vscode-css-language-server" "kotlin-language-server" "dart" "lua-language-server" "svelteserver" "vue-language-server" "terraform-ls" "tailwindcss-language-server" "zls" "marksman" "taplo" "graphql-lsp" "elixir-ls" "metals")
    local -a LSP_INSTALL=(
        "npm install -g pyright"
        "npm install -g typescript-language-server typescript"
        "rustup component add rust-analyzer"
        "go install golang.org/x/tools/gopls@latest"
        "npm install -g dockerfile-language-server-nodejs"
        "npm install -g sql-language-server"
        "brew install jdtls"
        "apt install clangd || brew install llvm"
        "npm install -g intelephense"
        "gem install solargraph"
        "dotnet tool install -g omnisharp"
        "npm install -g bash-language-server"
        "npm install -g yaml-language-server"
        "npm install -g vscode-langservers-extracted"
        "npm install -g vscode-langservers-extracted"
        "brew install kotlin-language-server || sdk install kotlin"
        "brew install dart || choco install dart-sdk"
        "brew install lua-language-server || cargo install lua-language-server"
        "npm install -g svelte-language-server"
        "npm install -g @vue/language-server"
        "brew install hashicorp/tap/terraform-ls || choco install terraform-ls"
        "npm install -g @tailwindcss/language-server"
        "brew install zls || snap install zls"
        "brew install marksman || cargo install marksman"
        "cargo install taplo-cli --features lsp"
        "npm install -g graphql-language-service-cli"
        "brew install elixir-ls || mix archive.install hex elixir_ls"
        "brew install metals || cs install metals"
    )

    # Show list with status
    local -a ALREADY_INSTALLED=()
    for i in "${!LSP_NAMES[@]}"; do
        local num=$((i + 1))
        local name="${LSP_NAMES[$i]}"
        local cmd="${LSP_CMDS[$i]}"
        if command -v "$cmd" &>/dev/null; then
            echo -e "${CYAN}║${NC}  ${GREEN}[✓]${NC} ${num}. ${name}  ${BOLD}(already installed)${NC}"
            ALREADY_INSTALLED+=("$i")
        else
            echo -e "${CYAN}║${NC}  [ ] ${num}. ${name}"
        fi
    done

    echo -e "${CYAN}║                                          ║${NC}"
    echo -e "${CYAN}║  ${BOLD}a${NC}${CYAN} = Install all    ${BOLD}s${NC}${CYAN} = Skip all          ║${NC}"
    echo -e "${CYAN}║  Or enter numbers: ${BOLD}1,2,4${NC}${CYAN}                 ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""

    read -rp "  Your choice: " lsp_choice

    # Parse choice
    local -a selected=()

    case "$lsp_choice" in
        [aA])
            # Select all that are not already installed
            for i in "${!LSP_NAMES[@]}"; do
                local is_installed=false
                for j in "${ALREADY_INSTALLED[@]:-}"; do
                    if [ "$i" = "$j" ]; then
                        is_installed=true
                        break
                    fi
                done
                if [ "$is_installed" = false ]; then
                    selected+=("$i")
                fi
            done
            ;;
        [sS]|"")
            info "Skipping LSP installation."
            return
            ;;
        *)
            # Parse comma-separated numbers
            IFS=',' read -ra nums <<< "$lsp_choice"
            for num in "${nums[@]}"; do
                num=$(echo "$num" | tr -d ' ')
                if [[ "$num" =~ ^[0-9]+$ ]] && [ "$num" -ge 1 ] && [ "$num" -le "${#LSP_NAMES[@]}" ]; then
                    local idx=$((num - 1))
                    # Skip if already installed
                    local is_installed=false
                    for j in "${ALREADY_INSTALLED[@]:-}"; do
                        if [ "$idx" = "$j" ]; then
                            is_installed=true
                            break
                        fi
                    done
                    if [ "$is_installed" = false ]; then
                        selected+=("$idx")
                    else
                        skip "${LSP_NAMES[$idx]} already installed, skipping."
                    fi
                else
                    warn "Invalid selection: $num (skipped)"
                fi
            done
            ;;
    esac

    if [ ${#selected[@]} -eq 0 ]; then
        info "No new LSP servers to install."
        return
    fi

    echo ""
    info "Installing ${#selected[@]} LSP server(s)..."
    echo ""

    local installed_count=0
    local failed_count=0

    for idx in "${selected[@]}"; do
        local name="${LSP_NAMES[$idx]}"
        local install_cmd="${LSP_INSTALL[$idx]}"

        echo -n "  Installing ${name}... "

        # Run install command
        if eval "$install_cmd" &>/dev/null 2>&1; then
            echo -e "${GREEN}✅${NC}"
            ((installed_count++))
        else
            echo -e "${YELLOW}⚠️  Failed${NC}"
            warn "  Command: $install_cmd"
            ((failed_count++))
        fi
    done

    LSP_INSTALLED=$installed_count

    echo ""
    if [ "$installed_count" -gt 0 ]; then
        success "$installed_count LSP server(s) installed successfully."
    fi
    if [ "$failed_count" -gt 0 ]; then
        warn "$failed_count LSP server(s) failed to install. You can install them manually later."
    fi

    # Merge installed LSP servers into opencode.json
    merge_lsp_to_opencode_config
}

merge_lsp_to_opencode_config() {
    info "Merging LSP config into opencode.json..."

    if command -v opencode-jce &>/dev/null; then
        if opencode-jce setup --merge-lsp &>/dev/null 2>&1; then
            success "LSP servers merged into opencode.json"
        else
            warn "Could not merge LSP config. Run 'opencode-jce setup --merge-lsp' manually."
        fi
    else
        warn "opencode-jce not in PATH yet. Run 'opencode-jce setup --merge-lsp' after restarting terminal."
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════╗"
    echo "║     OpenCode JCE — Installed! 🎉        ║"
    echo "╠══════════════════════════════════════════╣"

    if [ "$GIT_STATUS" = "installed" ]; then
        echo "║ ✅ Git            — installed            ║"
    else
        echo "║ ✅ Git            — already present      ║"
    fi

    if [ "$BUN_STATUS" = "installed" ]; then
        echo "║ ✅ Bun            — installed            ║"
    else
        echo "║ ✅ Bun            — already present      ║"
    fi

    if [ "$OPENCODE_STATUS" = "installed" ]; then
        echo "║ ✅ OpenCode CLI   — installed            ║"
    else
        echo "║ ✅ OpenCode CLI   — already present      ║"
    fi

    echo "║ ✅ 30 AI Agents   — configured           ║"
    echo "║ ✅ AGENTS.md      — global AI instructions ║"
    echo "║ ✅ 35 Skills      — on-demand workflows  ║"
    echo "║ ✅ 20 Profiles    — ready                ║"
    echo "║ ✅ 5 MCP Servers  — cached & ready        ║"
    if [ "$LSP_INSTALLED" -gt 0 ]; then
        echo "║ ✅ LSP Servers    — ${LSP_INSTALLED} installed             ║"
    else
        echo "║ ✅ LSP Settings   — configured           ║"
    fi
    echo "╠══════════════════════════════════════════╣"
    echo "║                                          ║"
    echo "║  Get started:  opencode                  ║"
    echo "║                                          ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"

    if [ "$BUN_STATUS" = "installed" ] || [ "$OPENCODE_STATUS" = "installed" ]; then
        warn "You may need to restart your terminal or run:"
        echo "  source ~/.bashrc  (or ~/.zshrc)"
    fi
}

# ─── Main ─────────────────────────────────────────────────────

main() {
    print_banner
    detect_os
    detect_package_manager
    echo ""

    install_git
    install_bun
    install_opencode
    echo ""

    deploy_config
    precache_mcp_packages
    select_and_install_lsp
    print_summary
}

main "$@"
