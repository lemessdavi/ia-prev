---
name: test-driven-development
description: Use before any feature, bugfix, or behavior change. Write failing tests first, then implement minimum code.
---

# Test-Driven Development

## Iron Rule

No production code without a failing test first.

## Cycle

1. Red: write one failing test for one behavior.
2. Verify Red: run the test and confirm expected failure.
3. Green: implement minimal code to pass.
4. Verify Green: run targeted and related tests.
5. Refactor: clean structure without changing behavior.

## Constraints

- Do not bundle multiple behaviors in one test.
- Do not refactor while still red.
- Do not skip failure verification.

## Done Criteria

- New/changed behavior is covered by tests.
- Regression risk is guarded by automated tests.

