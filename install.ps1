# ===================================================================
# OpenCode JCE - Windows Installer (PowerShell)
# One command to install everything you need for OpenCode CLI
# Requires: PowerShell 5.1+
# ===================================================================

$ErrorActionPreference = "Stop"
$Version = "1.0.0"
$RepoUrl = "https://github.com/JCETools-Petra/JCE-Opencode-Tools.git"
$TempDir = Join-Path $env:TEMP "opencode-jce-install"
$ConfigDir = Join-Path $env:APPDATA "opencode"

# Status tracking
$GitStatus = "skip"
$BunStatus = "skip"
$OpenCodeStatus = "skip"

# --- Helper Functions ---

function Write-Banner {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "       OpenCode JCE Installer v$Version" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "  Installing: Git, Bun, OpenCode CLI" -ForegroundColor Cyan
    Write-Host "  Configuring: Agents, Profiles, MCP, LSP" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Skip($msg) { Write-Host "[SKIP] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; exit 1 }

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

# --- Installation Steps ---

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
    Write-Info "Downloading configuration from GitHub..."
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    git clone --depth 1 $RepoUrl $TempDir 2>$null
    $ErrorActionPreference = $prevErrorAction
    if (!(Test-Path (Join-Path $TempDir "config"))) {
        Write-Err "Failed to clone config repository. Check your internet connection."
    }
    Write-Ok "Repository downloaded"

    # Ensure config directory exists
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $ConfigDir "profiles") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $ConfigDir "prompts") -Force | Out-Null

    # Deploy configuration (safe merge - only add what is missing)
    Write-Info "Merging configuration (preserving existing settings)..."
    $sourceConfig = Join-Path $TempDir "config"
    Deploy-ConfigSafe $sourceConfig $ConfigDir

    Write-Ok "Configuration deployed to: $ConfigDir"

    # Install opencode-jce CLI globally
    Write-Info "Installing opencode-jce CLI..."
    try {
        Push-Location $TempDir
        $prevErrorAction2 = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        bun install 2>$null
        $ErrorActionPreference = $prevErrorAction2
        Pop-Location

        # Create .cmd wrapper in bun bin directory
        $bunPath = Join-Path $env:USERPROFILE ".bun\bin"
        if (!(Test-Path $bunPath)) { New-Item -ItemType Directory -Path $bunPath -Force | Out-Null }

        # Remove broken files that bun install -g creates on Windows
        Remove-Item (Join-Path $bunPath "opencode-jce") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $bunPath "opencode-jce.bunx") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $bunPath "opencode-jce.exe") -Force -ErrorAction SilentlyContinue

        $installDir = Join-Path $ConfigDir "cli"
        
        # Copy CLI source to persistent location
        if (Test-Path $installDir) { Remove-Item $installDir -Recurse -Force }
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        Copy-Item (Join-Path $TempDir "src") (Join-Path $installDir "src") -Recurse
        Copy-Item (Join-Path $TempDir "schemas") (Join-Path $installDir "schemas") -Recurse
        Copy-Item (Join-Path $TempDir "package.json") $installDir
        Copy-Item (Join-Path $TempDir "tsconfig.json") $installDir
        Copy-Item (Join-Path $TempDir "node_modules") (Join-Path $installDir "node_modules") -Recurse

        # Create .cmd wrapper
        $cmdContent = "@echo off`r`nbun run `"$installDir\src\index.ts`" %*"
        Set-Content -Path (Join-Path $bunPath "opencode-jce.cmd") -Value $cmdContent -Encoding ASCII

        # Add bun bin to PATH if not already there
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        if ($userPath -notlike "*\.bun\bin*") {
            [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$bunPath", "User")
        }
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        if (Test-Command "opencode-jce") {
            Write-Ok "opencode-jce CLI installed globally"
        } else {
            Write-Warn "opencode-jce installed. Restart PowerShell to use it."
        }
    } catch {
        Write-Warn "Could not install opencode-jce CLI globally: $_"
    }

    # Cleanup
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}

function Deploy-ConfigSafe($sourceDir, $targetDir) {
    # Safe copy: only copy files that do not already exist
    $files = @("agents.json", "mcp.json", "lsp.json", "fallback.json")
    foreach ($file in $files) {
        $src = Join-Path $sourceDir $file
        $dst = Join-Path $targetDir $file
        if ((Test-Path $src) -and !(Test-Path $dst)) {
            Copy-Item $src $dst
            Write-Ok "  Created: $file"
        } elseif ((Test-Path $src) -and (Test-Path $dst)) {
            Write-Skip "  Exists, preserved: $file"
        }
    }

    # Copy profiles that do not exist
    $srcProfiles = Join-Path $sourceDir "profiles"
    $dstProfiles = Join-Path $targetDir "profiles"
    if (Test-Path $srcProfiles) {
        $added = 0
        Get-ChildItem $srcProfiles -Filter "*.json" | ForEach-Object {
            $dst = Join-Path $dstProfiles $_.Name
            if (!(Test-Path $dst)) {
                Copy-Item $_.FullName $dst
                $added++
            }
        }
        Write-Ok "  Profiles: $added new added"
    }

    # Copy prompts that do not exist
    $srcPrompts = Join-Path $sourceDir "prompts"
    $dstPrompts = Join-Path $targetDir "prompts"
    if (Test-Path $srcPrompts) {
        Get-ChildItem $srcPrompts | ForEach-Object {
            $dst = Join-Path $dstPrompts $_.Name
            if (!(Test-Path $dst)) {
                Copy-Item $_.FullName $dst
            }
        }
        Write-Ok "  Prompts copied"
    }
}

function Setup-ApiKeys {
    Write-Host ""
    Write-Info "API Key Setup"
    Write-Host "OpenCode needs API keys to connect to AI models." -ForegroundColor Cyan
    Write-Host ""

    $setupKeys = Read-Host "Configure API keys now? (y/N)"
    if ($setupKeys -ne "y" -and $setupKeys -ne "Y") {
        Write-Warn "Skipping API key setup."
        Write-Host '  Set these environment variables later:'
        Write-Host '    [System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-...", "User")'
        Write-Host '    [System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-...", "User")'
        return
    }

    # OpenAI Key
    if ($env:OPENAI_API_KEY) {
        Write-Skip "OPENAI_API_KEY already set"
    } else {
        $openaiKey = Read-Host "Enter OpenAI API Key (or press Enter to skip)"
        if ($openaiKey) {
            [System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", $openaiKey, "User")
            $env:OPENAI_API_KEY = $openaiKey
            Write-Ok "OpenAI API key saved to user environment"
        }
    }

    # Anthropic Key
    if ($env:ANTHROPIC_API_KEY) {
        Write-Skip "ANTHROPIC_API_KEY already set"
    } else {
        $anthropicKey = Read-Host "Enter Anthropic API Key (or press Enter to skip)"
        if ($anthropicKey) {
            [System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $anthropicKey, "User")
            $env:ANTHROPIC_API_KEY = $anthropicKey
            Write-Ok "Anthropic API key saved to user environment"
        }
    }
}

function Write-Summary {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "       OpenCode JCE - Installed!" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green

    if ($GitStatus -eq "installed") {
        Write-Host "  [OK] Git            - installed" -ForegroundColor Green
    } else {
        Write-Host "  [OK] Git            - already present" -ForegroundColor Green
    }

    if ($BunStatus -eq "installed") {
        Write-Host "  [OK] Bun            - installed" -ForegroundColor Green
    } else {
        Write-Host "  [OK] Bun            - already present" -ForegroundColor Green
    }

    if ($OpenCodeStatus -eq "installed") {
        Write-Host "  [OK] OpenCode CLI   - installed" -ForegroundColor Green
    } else {
        Write-Host "  [OK] OpenCode CLI   - already present" -ForegroundColor Green
    }

    Write-Host "  [OK] 30 AI Agents   - configured" -ForegroundColor Green
    Write-Host "  [OK] 20 Profiles    - ready" -ForegroundColor Green
    Write-Host "  [OK] 6 MCP Tools    - configured" -ForegroundColor Green
    Write-Host "  [OK] 10 LSP Servers - configured" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Get started:  opencode" -ForegroundColor White
    Write-Host "  Manage:       opencode-jce --help" -ForegroundColor White
    Write-Host ""

    if ($BunStatus -eq "installed" -or $OpenCodeStatus -eq "installed") {
        Write-Warn "You may need to restart PowerShell for PATH changes to take effect."
    }
}

# --- Main ---

Write-Banner
Install-Git
Install-Bun
Install-OpenCode
Write-Host ""
Deploy-Config
Setup-ApiKeys
Write-Summary
