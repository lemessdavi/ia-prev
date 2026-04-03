---
name: xp-delivery-loop
description: Use for every implementation task in this template. Enforces pair-programming with AI, small releases, and continuous integration discipline.
---

# XP Delivery Loop

## Goal

Ship production-safe increments quickly with an AI pair.

## Rules

- Human owns `what` and `why`; agent proposes `how`.
- Keep commits small and always releasable.
- Never merge red tests.
- Prefer simple solutions before abstractions.

## Execution Loop

1. Confirm task goal and acceptance criteria.
2. Align with context from `CLAUDE.md`, `AGENTS.md`, and `.project-context/linear.md`.
3. Run TDD cycle (`skills/test-driven-development/SKILL.md`).
4. Run quality gates (`skills/ci-quality-gates/SKILL.md`).
5. Refactor incrementally (`skills/refactor-continuous/SKILL.md`).
6. Sync progress in Linear (`skills/linear-delivery-sync/SKILL.md`).
7. Update living docs (`skills/docs-living-spec/SKILL.md`).

## Commit Bar

- One coherent change per commit.
- Commit message: imperative and specific.
- Include tests in same commit as behavior change.

