#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CONVEX_DEPLOYMENT:-}" ]]; then
  echo "Skipping Convex codegen: CONVEX_DEPLOYMENT is not set."
  exit 0
fi

pnpm convex:codegen
