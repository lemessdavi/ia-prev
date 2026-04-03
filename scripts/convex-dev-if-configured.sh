#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CONVEX_DEPLOYMENT:-}" ]]; then
  echo "Skipping Convex dev: CONVEX_DEPLOYMENT is not set."
  echo "Run apps only with: pnpm dev:apps"
  echo "To run Convex in non-interactive mode, set CONVEX_DEPLOYMENT (and usually CONVEX_DEPLOY_KEY)."
  exit 0
fi

# When launched under process managers (e.g. concurrently/turbo), Convex CLI
# cannot ask interactive setup questions. Require explicit credentials there.
if [[ ! -t 0 && -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "Skipping Convex dev: non-interactive shell without CONVEX_DEPLOY_KEY."
  echo "Set CONVEX_DEPLOY_KEY to enable 'pnpm dev' with Convex."
  echo "Alternatively run Convex manually in an interactive terminal: pnpm convex:dev:force"
  exit 0
fi

pnpm --filter @repo/convex-backend dev
