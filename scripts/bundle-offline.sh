#!/usr/bin/env bash
set -euo pipefail

# Creates an offline bundle with all dependencies
BUNDLE_DIR="opencode-suite-offline"
VERSION=$(bun -e "console.log(require('./package.json').version)")

echo "Creating offline bundle v${VERSION}..."

rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

# Copy project files
cp -r config/ "$BUNDLE_DIR/"
cp -r src/ "$BUNDLE_DIR/"
cp -r schemas/ "$BUNDLE_DIR/"
cp package.json bun.lock tsconfig.json "$BUNDLE_DIR/"
cp install.sh install.ps1 "$BUNDLE_DIR/"

# Bundle node_modules
cp -r node_modules/ "$BUNDLE_DIR/node_modules/"

# Create offline installer
cat > "$BUNDLE_DIR/install-offline.sh" << 'INSTALLER'
#!/usr/bin/env bash
set -euo pipefail
echo "Installing OpenCode Suite (offline)..."

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
mkdir -p "$CONFIG_DIR/profiles"

cp config/agents.json "$CONFIG_DIR/"
cp config/mcp.json "$CONFIG_DIR/"
cp config/lsp.json "$CONFIG_DIR/"
cp config/profiles/*.json "$CONFIG_DIR/profiles/"

# Install CLI globally (requires bun)
if command -v bun &>/dev/null; then
    bun install -g .
    echo "✅ OpenCode Suite installed!"
else
    echo "⚠️  Bun not found. Install Bun first, then run: bun install -g ."
fi
INSTALLER
chmod +x "$BUNDLE_DIR/install-offline.sh"

# Create tarball
tar -czf "opencode-suite-offline-v${VERSION}.tar.gz" "$BUNDLE_DIR"
rm -rf "$BUNDLE_DIR"

echo "✅ Bundle created: opencode-suite-offline-v${VERSION}.tar.gz"
echo "   Transfer to target machine and run:"
echo "   tar -xzf opencode-suite-offline-v${VERSION}.tar.gz"
echo "   cd opencode-suite-offline && ./install-offline.sh"
