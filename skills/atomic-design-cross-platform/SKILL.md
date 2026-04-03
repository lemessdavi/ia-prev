---
name: atomic-design-cross-platform
description: Use when creating or refactoring UI in packages/ui. Enforces atomic design levels and cross-platform consistency for web and mobile.
---

# Atomic Design Cross-Platform

## Goal

Build once in `packages/ui`, reuse across web and mobile with consistent behavior.

## Levels

- `quarks`: tokens and scales.
- `atoms`: minimal UI primitives.
- `molecules`: small compositions with one responsibility.
- `organisms`: feature-level blocks.
- `templates`: layout shells without product-specific content.

## Placement Rules

- New visual primitive -> `atoms`.
- Repeated combination of atoms -> `molecules`.
- Section-level composite -> `organisms`.
- App-specific screen logic stays in `apps/*`, not `packages/ui`.

## Cross-Platform Rules

- Avoid hardcoded spacing/colors in app screens.
- Use design tokens from shared layer.
- Validate keyboard, focus, and touch behavior on both platforms.

## Required References

- `packages/ui/docs/design-system.md`
- `packages/ui/docs/components-usage.md`

