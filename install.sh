#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# OpenCode Suite — Installer
# One command to install everything you need for OpenCode CLI
# ═══════════════════════════════════════════════════════════════

VERSION="1.0.0"
REPO_URL="https://github.com/USERNAME/opencode-suite.git"
TEMP_DIR="/tmp/opencode-suite-install"
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

# ─── Helper Functions ─────────────────────────────────────────

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════╗"
    echo "║       OpenCode Suite Installer v${VERSION}     ║"
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
            echo -e "${CYAN}  irm https://raw.githubusercontent.com/USERNAME/opencode-suite/main/install.ps1 | iex${NC}"
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

    # Backup existing config
    if [ -d "$CONFIG_DIR" ] && [ "$(ls -A "$CONFIG_DIR" 2>/dev/null)" ]; then
        local backup="${CONFIG_DIR}.bak.$(date +%Y%m%d%H%M%S)"
        warn "Existing config found. Backing up to: ${backup}"
        mv "$CONFIG_DIR" "$backup"
    fi

    # Create config directory
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$CONFIG_DIR/profiles"

    # Copy config files
    cp "$TEMP_DIR/config/agents.json" "$CONFIG_DIR/"
    cp "$TEMP_DIR/config/mcp.json" "$CONFIG_DIR/"
    cp "$TEMP_DIR/config/lsp.json" "$CONFIG_DIR/"
    cp "$TEMP_DIR/config/profiles/"*.json "$CONFIG_DIR/profiles/"

    success "Configuration deployed to: ${CONFIG_DIR}"

    # Install opencode-suite CLI globally
    info "Installing opencode-suite CLI..."
    (cd "$TEMP_DIR" && bun install && bun install -g .)
    if command -v opencode-suite &>/dev/null; then
        success "opencode-suite CLI installed globally"
    else
        warn "opencode-suite CLI installed but may not be in PATH. Restart your terminal."
    fi

    # Cleanup
    rm -rf "$TEMP_DIR"
}

setup_api_keys() {
    echo ""
    info "API Key Setup"
    echo -e "${CYAN}OpenCode needs API keys to connect to AI models.${NC}"
    echo ""

    read -p "Configure API keys now? (y/N): " setup_keys
    if [[ ! "$setup_keys" =~ ^[Yy]$ ]]; then
        warn "Skipping API key setup."
        echo "  Set these environment variables later:"
        echo "    export OPENAI_API_KEY=sk-..."
        echo "    export ANTHROPIC_API_KEY=sk-ant-..."
        return
    fi

    # Determine shell profile
    local shell_profile=""
    if [ -f "$HOME/.zshrc" ]; then
        shell_profile="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        shell_profile="$HOME/.bashrc"
    elif [ -f "$HOME/.profile" ]; then
        shell_profile="$HOME/.profile"
    else
        shell_profile="$HOME/.bashrc"
    fi

    # OpenAI Key
    if [ -n "${OPENAI_API_KEY:-}" ]; then
        skip "OPENAI_API_KEY already set"
    else
        read -sp "Enter OpenAI API Key (or press Enter to skip): " openai_key
        echo ""
        if [ -n "$openai_key" ]; then
            echo "export OPENAI_API_KEY=\"${openai_key}\"" >> "$shell_profile"
            export OPENAI_API_KEY="$openai_key"
            success "OpenAI API key saved to ${shell_profile}"
        fi
    fi

    # Anthropic Key
    if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
        skip "ANTHROPIC_API_KEY already set"
    else
        read -sp "Enter Anthropic API Key (or press Enter to skip): " anthropic_key
        echo ""
        if [ -n "$anthropic_key" ]; then
            echo "export ANTHROPIC_API_KEY=\"${anthropic_key}\"" >> "$shell_profile"
            export ANTHROPIC_API_KEY="$anthropic_key"
            success "Anthropic API key saved to ${shell_profile}"
        fi
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════╗"
    echo "║     OpenCode Suite — Installed! 🎉      ║"
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

    echo "║ ✅ 14 AI Agents   — configured           ║"
    echo "║ ✅ 8 Profiles     — ready                ║"
    echo "║ ✅ MCP Tools      — configured           ║"
    echo "║ ✅ LSP Settings   — configured           ║"
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
    setup_api_keys
    print_summary
}

main "$@"
