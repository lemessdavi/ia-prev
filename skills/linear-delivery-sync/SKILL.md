---
name: linear-delivery-sync
description: Use the Linear MCP from the scaffolded Linear link to align implementation with issues/projects, suggest card updates, and keep Linear documentation in sync.
---

# Linear Delivery Sync

## Goal

Use Linear as the operational source of truth while coding.

## Inputs

- Canonical Linear URL in `.project-context/linear.md`.
- Current task scope from code changes and tests.

## Workflow

1. Read `.project-context/linear.md`.
2. Parse URL type:
- `.../issue/<KEY>` -> fetch issue details and comments.
- `.../project/...` -> fetch project and relevant open issues.
3. Align current implementation scope with Linear item status.
4. Suggest concise progress messages for the active card.
5. Suggest documentation updates in Linear when architecture/workflow changed.

## MCP Usage Guidelines

- Prefer issue-specific APIs for issue links.
- Prefer project + issue listing APIs for project links.
- Keep updates factual: what changed, tests run, risks/next steps.
- Do not change state/assignee unless explicitly requested.

## Suggested Card Message Template

```md
Implemented:
- <what changed>

Validation:
- <tests and gates run>

Notes:
- <risk, follow-up, docs touched>
```

