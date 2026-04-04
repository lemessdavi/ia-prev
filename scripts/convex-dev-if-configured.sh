#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/packages/convex-backend"

load_env_file_if_present() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip blank lines and comments
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "${line#\#}" != "$line" ]] && continue

    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"

      # Remove inline comments from unquoted values.
      if [[ "$value" != \"*\" && "$value" != \'*\' ]]; then
        value="${value%%#*}"
      fi

      # Trim trailing spaces
      value="$(printf '%s' "$value" | sed 's/[[:space:]]*$//')"

      # Keep explicitly exported shell vars as precedence.
      if [[ -z "${!key:-}" ]]; then
        export "${key}=${value}"
      fi
    fi
  done < "$file"
}

# Load local env files so `pnpm dev` works without manual `export`.
load_env_file_if_present "${BACKEND_DIR}/.env.local"
load_env_file_if_present "${REPO_ROOT}/.env.local"
load_env_file_if_present "${BACKEND_DIR}/.env"
load_env_file_if_present "${REPO_ROOT}/.env"

if [[ -z "${CONVEX_DEPLOYMENT:-}" ]]; then
  echo "Skipping Convex dev: CONVEX_DEPLOYMENT is not set."
  echo "Run apps only with: pnpm dev:apps"
  echo "Set CONVEX_DEPLOYMENT in packages/convex-backend/.env.local (or root .env.local)."
  exit 0
fi

pnpm --filter @repo/convex-backend dev
