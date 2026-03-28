#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MAX_ITERS="${MAX_ITERS:-12}"
MODEL="${MODEL:-}"
AUTOCOMMIT="${AUTOCOMMIT:-0}"
LOG_DIR="${ROOT_DIR}/logs/codex-nightly-$(date +%F-%H%M%S)"
SCHEMA_PATH="${ROOT_DIR}/docs/codex/nightly-output.schema.json"
DOC_PATH="${ROOT_DIR}/docs/codex/Documentation.md"
PROMPT_PATH="${ROOT_DIR}/docs/codex/Prompt.md"
PLAN_PATH="${ROOT_DIR}/docs/codex/Plan.md"
IMPLEMENT_PATH="${ROOT_DIR}/docs/codex/Implement.md"

mkdir -p "$LOG_DIR"

if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "Schema file not found: $SCHEMA_PATH" >&2
  exit 1
fi

if [[ ! -f "$PROMPT_PATH" || ! -f "$PLAN_PATH" || ! -f "$IMPLEMENT_PATH" || ! -f "$DOC_PATH" ]]; then
  echo "One or more required docs/codex files are missing." >&2
  exit 1
fi

echo "Starting overnight runner"
echo "ROOT_DIR=$ROOT_DIR"
echo "LOG_DIR=$LOG_DIR"
echo "MAX_ITERS=$MAX_ITERS"
echo "AUTOCOMMIT=$AUTOCOMMIT"

for iter in $(seq 1 "$MAX_ITERS"); do
  ts="$(date +%F-%H%M%S)"
  run_prompt_file="${LOG_DIR}/prompt-${iter}.txt"
  run_events_file="${LOG_DIR}/events-${iter}.jsonl"
  run_final_file="${LOG_DIR}/final-${iter}.json"

  cat > "$run_prompt_file" <<'EOF'
Execute the project completion loop using these files as source of truth:
- docs/codex/Prompt.md
- docs/codex/Plan.md
- docs/codex/Implement.md
- docs/codex/Documentation.md

Rules:
1) Continue from current milestone in docs/codex/Documentation.md.
2) Keep scope limited to agreed phases (skip phase 6 and 7).
3) Deliver 99% complete project with AI path in live or mock mode.
4) If live AI credentials are unavailable, implement/use mock mode and continue.
5) Update docs/codex/Documentation.md after each milestone step.
6) Run validations for the touched milestone before moving forward.
7) Stop only when done criteria in docs/codex/Prompt.md are satisfied.

Return only the schema-compliant JSON progress report.
EOF

  echo "[$ts] Iteration ${iter}/${MAX_ITERS}" | tee -a "${LOG_DIR}/runner.log"

  cmd=(
    codex
    -a never
    -s workspace-write
    exec
    -C "$ROOT_DIR"
    --json
    --output-schema "$SCHEMA_PATH"
    -o "$run_final_file"
  )
  if [[ -n "$MODEL" ]]; then
    cmd+=(-m "$MODEL")
  fi
  cmd+=(-)

  set +e
  "${cmd[@]}" < "$run_prompt_file" | tee "$run_events_file"
  rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    echo "Iteration ${iter} failed with exit code ${rc}" | tee -a "${LOG_DIR}/runner.log"
    continue
  fi

  done_flag="$(jq -r '.done' "$run_final_file" 2>/dev/null || echo "false")"
  pct="$(jq -r '.completion_percent' "$run_final_file" 2>/dev/null || echo "0")"
  milestone="$(jq -r '.current_milestone' "$run_final_file" 2>/dev/null || echo "unknown")"
  ai_mode="$(jq -r '.ai_mode' "$run_final_file" 2>/dev/null || echo "unknown")"

  echo "Result: done=${done_flag} completion=${pct}% milestone=${milestone} ai_mode=${ai_mode}" | tee -a "${LOG_DIR}/runner.log"

  git diff > "${LOG_DIR}/diff-${iter}.patch" || true

  if [[ "$AUTOCOMMIT" == "1" ]]; then
    if [[ -n "$(git status --porcelain)" ]]; then
      git add -A
      git commit -m "chore(codex-nightly): checkpoint iter ${iter} ${ts}" || true
    fi
  fi

  if [[ "$done_flag" == "true" ]]; then
    echo "Project marked done at iteration ${iter}." | tee -a "${LOG_DIR}/runner.log"
    exit 0
  fi
done

echo "Max iterations reached without done=true." | tee -a "${LOG_DIR}/runner.log"
exit 2
