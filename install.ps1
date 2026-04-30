#Requires -Version 5.1
# ═══════════════════════════════════════════════════════════════
# OpenCode Suite — Windows Installer (PowerShell)
# One command to install everything you need for OpenCode CLI
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$Version = "1.0.0"
$RepoUrl = "https://github.com/USERNAME/opencode-suite.git"
$TempDir = Join-Path $env:TEMP "opencode-suite-install"
$ConfigDir = Join-Path $env:APPDATA "opencode"

# Status tracking
$GitStatus = "skip"
$BunStatus = "skip"
$OpenCodeStatus = "skip"

# ─── Helper Functions ─────────────────────────────────────────

function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║       OpenCode Suite Installer v$Version     ║" -ForegroundColor Cyan
    Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "║  Installing: Git, Bun, OpenCode CLI     ║" -ForegroundColor Cyan
    Write-Host "║  Configuring: Agents, Profiles, MCP,LSP ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-Ok($msg) { Write-Host "[✓] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Skip($msg) { Write-Host "[SKIP] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[✗] $msg" -ForegroundColor Red; exit 1 }

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

# ─── Installation Steps ──────────────────────────────────────

function Install-Git {
    Write-Info "Checking Git..."
    if (Test-Command "git") {
        $ver = (git --version) -replace "git version ", ""
        Write-Skip "Git v$ver already installed"
        $script:GitStatus = "skip"
        return
    }

    Write-Info "Installing Git via winget..."
    try {
        winget install Git.Git --accept-package-agreements --accept-source-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        if (Test-Command "git") {
            Write-Ok "Git installed"
            $script:GitStatus = "installed"
        } else {
            Write-Err "Git installation failed. Please install manually from https://git-scm.com"
        }
    } catch {
        Write-Err "Failed to install Git. Please install manually from https://git-scm.com"
    }
}

function Install-Bun {
    Write-Info "Checking Bun..."
    if (Test-Command "bun") {
        $ver = bun --version
        Write-Skip "Bun v$ver already installed"
        $script:BunStatus = "skip"
        return
    }

    Write-Info "Installing Bun..."
    try {
        irm bun.sh/install.ps1 | iex
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        $bunPath = Join-Path $env:USERPROFILE ".bun\bin"
        if (Test-Path $bunPath) { $env:Path += ";$bunPath" }

        if (Test-Command "bun") {
            Write-Ok "Bun installed: v$(bun --version)"
            $script:BunStatus = "installed"
        } else {
            Write-Err "Bun installation failed. Please restart PowerShell and re-run."
        }
    } catch {
        Write-Err "Failed to install Bun: $_"
    }
}

function Install-OpenCode {
    Write-Info "Checking OpenCode CLI..."
    if (Test-Command "opencode") {
        Write-Skip "OpenCode CLI already installed"
        $script:OpenCodeStatus = "skip"
        return
    }

    Write-Info "Installing OpenCode CLI..."
    try {
        bun install -g opencode
        # Refresh PATH
        $bunPath = Join-Path $env:USERPROFILE ".bun\bin"
        if (Test-Path $bunPath) { $env:Path += ";$bunPath" }

        if (Test-Command "opencode") {
            Write-Ok "OpenCode CLI installed"
            $script:OpenCodeStatus = "installed"
        } else {
            Write-Err "OpenCode CLI installation failed"
        }
    } catch {
        Write-Err "Failed to install OpenCode CLI: $_"
    }
}

function Deploy-Config {
    Write-Info "Deploying configuration..."

    # Clone config repo
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
    try {
        git clone --depth 1 $RepoUrl $TempDir 2>$null
    } catch {
        Write-Err "Failed to clone config repository. Check your internet connection."
    }

    # Backup existing config
    if (Test-Path $ConfigDir) {
        $items = Get-ChildItem $ConfigDir -ErrorAction SilentlyContinue
        if ($items.Count -gt 0) {
            $timestamp = Get-Date -Format "yyyyMMddHHmmss"
            $backup = "${ConfigDir}.bak.${timestamp}"
            Write-Warn "Existing config found. Backing up to: $backup"
            Move-Item $ConfigDir $backup
        }
    }

    # Create config directory
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $ConfigDir "profiles") -Force | Out-Null

    # Copy config files
    Copy-Item (Join-Path $TempDir "config\agents.json") $ConfigDir
    Copy-Item (Join-Path $TempDir "config\mcp.json") $ConfigDir
    Copy-Item (Join-Path $TempDir "config\lsp.json") $ConfigDir
    Copy-Item (Join-Path $TempDir "config\profiles\*") (Join-Path $ConfigDir "profiles")

    Write-Ok "Configuration deployed to: $ConfigDir"

    # Cleanup
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}

function Setup-ApiKeys {
    Write-Host ""
    Write-Info "API Key Setup"
    Write-Host "OpenCode needs API keys to connect to AI models." -ForegroundColor Cyan
    Write-Host ""

    $setupKeys = Read-Host "Configure API keys now? (y/N)"
    if ($setupKeys -ne "y" -and $setupKeys -ne "Y") {
        Write-Warn "Skipping API key setup."
        Write-Host "  Set these environment variables later:"
        Write-Host '    $env:OPENAI_API_KEY = "sk-..."'
        Write-Host '    $env:ANTHROPIC_API_KEY = "sk-ant-..."'
        return
    }

    # OpenAI Key
    if ($env:OPENAI_API_KEY) {
        Write-Skip "OPENAI_API_KEY already set"
    } else {
        $openaiKey = Read-Host "Enter OpenAI API Key (or press Enter to skip)" -AsSecureString
        $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($openaiKey))
        if ($plainKey) {
            [System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", $plainKey, "User")
            $env:OPENAI_API_KEY = $plainKey
            Write-Ok "OpenAI API key saved to user environment"
        }
    }

    # Anthropic Key
    if ($env:ANTHROPIC_API_KEY) {
        Write-Skip "ANTHROPIC_API_KEY already set"
    } else {
        $anthropicKey = Read-Host "Enter Anthropic API Key (or press Enter to skip)" -AsSecureString
        $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($anthropicKey))
        if ($plainKey) {
            [System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $plainKey, "User")
            $env:ANTHROPIC_API_KEY = $plainKey
            Write-Ok "Anthropic API key saved to user environment"
        }
    }
}

function Write-Summary {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║     OpenCode Suite — Installed! 🎉      ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Green

    if ($GitStatus -eq "installed") {
        Write-Host "║ ✅ Git            — installed            ║" -ForegroundColor Green
    } else {
        Write-Host "║ ✅ Git            — already present      ║" -ForegroundColor Green
    }

    if ($BunStatus -eq "installed") {
        Write-Host "║ ✅ Bun            — installed            ║" -ForegroundColor Green
    } else {
        Write-Host "║ ✅ Bun            — already present      ║" -ForegroundColor Green
    }

    if ($OpenCodeStatus -eq "installed") {
        Write-Host "║ ✅ OpenCode CLI   — installed            ║" -ForegroundColor Green
    } else {
        Write-Host "║ ✅ OpenCode CLI   — already present      ║" -ForegroundColor Green
    }

    Write-Host "║ ✅ 14 AI Agents   — configured           ║" -ForegroundColor Green
    Write-Host "║ ✅ 8 Profiles     — ready                ║" -ForegroundColor Green
    Write-Host "║ ✅ MCP Tools      — configured           ║" -ForegroundColor Green
    Write-Host "║ ✅ LSP Settings   — configured           ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║                                          ║" -ForegroundColor Green
    Write-Host "║  Get started:  opencode                  ║" -ForegroundColor Green
    Write-Host "║                                          ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""

    if ($BunStatus -eq "installed" -or $OpenCodeStatus -eq "installed") {
        Write-Warn "You may need to restart PowerShell for PATH changes to take effect."
    }
}

# ─── Main ─────────────────────────────────────────────────────

Write-Banner
Install-Git
Install-Bun
Install-OpenCode
Write-Host ""
Deploy-Config
Setup-ApiKeys
Write-Summary
