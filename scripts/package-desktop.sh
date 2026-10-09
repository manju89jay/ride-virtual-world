#!/usr/bin/env bash
# Builds Hedgerow desktop apps (Windows, macOS, Linux) into ./electron-release.
# Electron tooling is installed in a temp folder so it never touches the web app's dependencies.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$(mktemp -d)"; STAGE="$(mktemp -d)"; OUT="$ROOT/electron-release"
VERSION="${VERSION:-0.2.0}"

(cd "$TOOLS" && npm init -y >/dev/null && npm install --no-audit --no-fund electron @electron/packager >/dev/null)
EV=$(node -p "require('$TOOLS/node_modules/electron/package.json').version")

(cd "$ROOT" && npx vite build)
cp -r "$ROOT/dist" "$ROOT/electron" "$STAGE/"
cat > "$STAGE/package.json" <<EOF
{ "name": "hedgerow", "productName": "Hedgerow", "version": "$VERSION", "author": "Hedgerow",
  "description": "Personal virtual cycling", "main": "electron/main.cjs", "type": "commonjs" }
EOF
cat > "$STAGE/bt.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>NSBluetoothAlwaysUsageDescription</key><string>Hedgerow connects to your smart trainer, heart rate strap and Zwift controllers.</string></dict></plist>
EOF

for target in "win32 x64" "darwin arm64" "darwin x64" "linux x64"; do
  set -- $target
  "$TOOLS/node_modules/.bin/electron-packager" "$STAGE" Hedgerow --platform="$1" --arch="$2" \
    --electron-version="$EV" --app-version="$VERSION" --out="$OUT" --overwrite \
    --ignore='^/bt\.plist$' $( [ "$1" = darwin ] && echo --extend-info="$STAGE/bt.plist" )
done
echo "Desktop builds written to $OUT"
