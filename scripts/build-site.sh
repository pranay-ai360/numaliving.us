#!/usr/bin/env bash
# Builds the site into _site/ with the image GitHub Pages itself uses, so a local build matches the
# published one (github-pages 232, Jekyll 3.10). Needs Docker running. Nothing is installed on this machine.
set -euo pipefail

IMAGE="ghcr.io/actions/jekyll-build-pages:v1.0.13"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

cd "$(dirname "$0")/.."
rm -rf _site

if ! docker run --rm --platform linux/amd64 \
  -e GITHUB_WORKSPACE=/github/workspace \
  -e INPUT_SOURCE=. \
  -e INPUT_DESTINATION=_site \
  -e INPUT_VERBOSE=false \
  -e INPUT_FUTURE=false \
  -e INPUT_TOKEN= \
  -e INPUT_BUILD_REVISION=local \
  -e GITHUB_REPOSITORY=pranay-ai360/numaliving.us \
  -e GITHUB_API_URL=https://api.github.com \
  -e GITHUB_OUTPUT=/tmp/github_output \
  -v "$PWD":/github/workspace \
  "$IMAGE" >"$LOG" 2>&1; then
  cat "$LOG" >&2
  echo "build-site: the Jekyll build failed." >&2
  exit 1
fi

if [ ! -f _site/index.html ]; then
  cat "$LOG" >&2
  echo "build-site: the build finished without _site/index.html." >&2
  exit 1
fi

grep -E 'done in' "$LOG" || true
