---
name: ci-quality-gates
description: Use before every commit or PR. Runs mandatory quality gates for this template and blocks delivery on failures.
---

# CI Quality Gates

## Mandatory Gates

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`

Run additional app/package-scoped checks when touching specific areas.

## Workflow

1. Execute targeted tests while implementing.
2. Execute full gates before commit.
3. Fix failures first; do not bypass.

## Failure Handling

- Lint failure: fix style or unsafe pattern.
- Type failure: fix contract mismatch.
- Test failure: classify regression vs outdated expectation, then fix.

## Delivery Rule

No green gates, no commit.

