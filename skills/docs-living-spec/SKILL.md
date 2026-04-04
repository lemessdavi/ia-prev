---
name: docs-living-spec
description: Keep CLAUDE.md and AGENTS.md aligned with reality. Use when new decisions, hurdles, or patterns emerge during implementation.
---

# Docs as Living Spec

## Goal

Make project docs reflect current behavior and decisions so future agent sessions start with correct context.

## When to Update

- New architectural decision.
- New recurring operational hurdle.
- New workflow or quality gate.
- Change in folder conventions or integration contracts.

## What to Update

- `CLAUDE.md`: project-level context and rules.
- `AGENTS.md`: execution contract for agents.
- Optional feature docs near changed modules.

## Update Style

- Prefer short, explicit bullets.
- Record concrete commands/paths.
- Remove stale guidance quickly.

