#!/usr/bin/env bash
# Fails when assets/css/site.css is not what `npm run css` produces. The file is committed because
# GitHub's Jekyll build cannot run Node, so a stale copy would go live.
set -euo pipefail

cd "$(dirname "$0")/.."
FRESH="$(mktemp)"
trap 'rm -f "$FRESH"' EXIT

npx tailwindcss -i _tailwind/site.css -o "$FRESH" --minify >/dev/null 2>&1

if ! cmp -s "$FRESH" assets/css/site.css; then
  echo "check-css: assets/css/site.css is out of date. Run: npm run css" >&2
  exit 1
fi
echo "check-css: assets/css/site.css is up to date."
