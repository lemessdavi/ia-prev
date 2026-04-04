---
name: refactor-continuous
description: Use after green tests to keep codebase healthy through small and frequent refactors instead of large rescue rewrites.
---

# Continuous Refactoring

## Goal

Prevent large emergency rewrites by keeping structure clean every cycle.

## Triggers

- Duplication in more than one place.
- Function/component too long to scan quickly.
- Mixed responsibilities in same module.
- Names that hide business intent.

## Refactor Loop

1. Ensure tests are green.
2. Apply one structural improvement at a time.
3. Re-run impacted tests immediately.
4. Stop when readability and intent are clear.

## Guardrails

- No behavior change during pure refactor commits.
- Prefer extract/rename/move over big rewrites.
- Keep each refactor commit small and reversible.

