#!/usr/bin/env bash
# Builds the web version into dist-preview/ with relative paths,
# so it can be hosted from any folder (e.g. as a shareable preview link).
# Accounts run in preview mode here: sandboxed preview hosts can't reach Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist dist-preview
EXPO_PUBLIC_ACCOUNTS=preview npx expo export -p web
mkdir -p dist-preview
cp -r dist/assets dist-preview/
SRC=$(ls dist/_expo/static/js/web/*.js)
JS="js/$(basename "$SRC")"
mkdir -p dist-preview/js
cp "$SRC" "dist-preview/$JS"
# absolute asset paths -> relative
sed -i 's#"/assets/#"./assets/#g' "dist-preview/$JS"
cat > dist-preview/index.html <<HTML
<title>SadBarz</title>
<meta name="theme-color" content="#0B0B0D">
<style>
  :root { color-scheme: dark; --bg: #0B0B0D; --fg: #F5F5F7; }
  html, body { height: 100%; background: var(--bg); color: var(--fg); }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script src="./$JS" defer></script>
HTML
echo "Built dist-preview/ ($JS)"
