#!/usr/bin/env bash
set -euo pipefail

# Creates an offline bundle with all dependencies
BUNDLE_DIR="opencode-jce-offline"
VERSION=$(bun -e "console.log(require('./package.json').version)")

echo "Creating offline bundle v${VERSION}..."

rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

# Copy project files
cp -r config/ "$BUNDLE_DIR/"
cp -r src/ "$BUNDLE_DIR/"
cp -r schemas/ "$BUNDLE_DIR/"
cp -r scripts/ "$BUNDLE_DIR/"
cp package.json bun.lock tsconfig.json "$BUNDLE_DIR/"
cp install.sh install.ps1 "$BUNDLE_DIR/"

# Bundle node_modules
cp -r node_modules/ "$BUNDLE_DIR/node_modules/"

# Create offline installer
cat > "$BUNDLE_DIR/install-offline.sh" << 'INSTALLER'
#!/usr/bin/env bash
set -euo pipefail
echo "Installing OpenCode JCE (offline)..."

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
mkdir -p "$CONFIG_DIR/profiles"

# Deploy config safely (never overwrite existing files)
if command -v bun &>/dev/null && [ -f "scripts/merge-config.ts" ]; then
    bun run scripts/merge-config.ts config "$CONFIG_DIR"
else
    [ ! -f "$CONFIG_DIR/agents.json" ] && cp config/agents.json "$CONFIG_DIR/"
    [ ! -f "$CONFIG_DIR/mcp.json" ] && cp config/mcp.json "$CONFIG_DIR/"
    [ ! -f "$CONFIG_DIR/lsp.json" ] && cp config/lsp.json "$CONFIG_DIR/"
    for f in config/profiles/*.json; do
        fname=$(basename "$f")
        [ ! -f "$CONFIG_DIR/profiles/$fname" ] && cp "$f" "$CONFIG_DIR/profiles/"
    done
fi

# Install CLI through a stable shim that points at the persistent config copy.
if command -v bun &>/dev/null; then
    INSTALL_DIR="$CONFIG_DIR/cli"
    STAGING_DIR="$CONFIG_DIR/.cli-install-new"
    BACKUP_DIR="$CONFIG_DIR/.cli-install-backup"
    rm -rf "$STAGING_DIR" "$BACKUP_DIR"
    mkdir -p "$STAGING_DIR"
    cp -r src schemas scripts package.json tsconfig.json node_modules "$STAGING_DIR/"
    if [ -d "$INSTALL_DIR" ]; then mv "$INSTALL_DIR" "$BACKUP_DIR"; fi
    mv "$STAGING_DIR" "$INSTALL_DIR"
    rm -rf "$BACKUP_DIR"
    BUN_BIN="$HOME/.bun/bin"
    mkdir -p "$BUN_BIN"
    cat > "$BUN_BIN/opencode-jce" <<EOF
#!/usr/bin/env sh
exec bun run "$INSTALL_DIR/src/index.ts" "\$@"
EOF
    chmod 755 "$BUN_BIN/opencode-jce"
    echo "✅ OpenCode JCE installed!"
else
    echo "⚠️  Bun not found. Install Bun first, then rerun ./install-offline.sh"
fi
INSTALLER
chmod +x "$BUNDLE_DIR/install-offline.sh"

# Create tarball
tar -czf "opencode-jce-offline-v${VERSION}.tar.gz" "$BUNDLE_DIR"
rm -rf "$BUNDLE_DIR"

echo "✅ Bundle created: opencode-jce-offline-v${VERSION}.tar.gz"
echo "   Transfer to target machine and run:"
echo "   tar -xzf opencode-jce-offline-v${VERSION}.tar.gz"
echo "   cd opencode-jce-offline && ./install-offline.sh"
