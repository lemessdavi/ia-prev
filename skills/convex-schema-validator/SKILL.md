---
name: convex-schema-validator
description: Guidance for evolving Convex schema safely with typed validators, indexes, and migration-aware changes.
---

# Convex Schema Validator

## Goal

Model data with explicit validators and safe schema evolution.

## Rules

- Define validators for all persisted fields.
- Add indexes for recurring query paths.
- Prefer additive changes to preserve compatibility.
- Plan migration/backfill when changing required shapes.

## Checklist

1. Update `convex/schema.ts`.
2. Regenerate types/codegen if required.
3. Update affected queries/mutations/actions.
4. Add tests for changed data contracts.

