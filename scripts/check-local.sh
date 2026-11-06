#!/usr/bin/env bash
# The local gate: run this before every push, so GitHub Actions does not clog up with a run for each
# change. Everything CI checks, plus the visual and functional comparison with the Reference Site.
set -euo pipefail

cd "$(dirname "$0")/.."
REFERENCE_URL="http://localhost:3000/"

step() { printf '\n=== %s\n' "$1"; }

step "Lint"
npm run --silent lint -- --max-warnings=0

step "Types"
npm run --silent typecheck

step "Unit tests and coverage"
npm run --silent test:coverage

step "Committed CSS is up to date"
npm run --silent css:check

step "Jekyll build with GitHub's image"
npm run --silent build:site

if curl -sf -o /dev/null --max-time 20 "$REFERENCE_URL"; then
  step "The behaviour specs describe the Reference Site"
  E2E_BASE_URL="$REFERENCE_URL" npx playwright test e2e/navigation.spec.ts e2e/portal.spec.ts

  if [ ! -d .parity ]; then
    step "Saving the Reference Site's screenshots and text to .parity/"
    E2E_BASE_URL="$REFERENCE_URL" npx playwright test e2e/parity.spec.ts
  fi
else
  # Comparing against the Reference Site is the point of this gate, so its absence is not skipped quietly.
  echo "check-local: nothing answers at $REFERENCE_URL. Start it with 'npm run dev' in reference-site/." >&2
  exit 1
fi

step "Every spec against the Jekyll build, including the visual comparison"
npx playwright test

printf '\ncheck-local: everything passed. Safe to push.\n'
