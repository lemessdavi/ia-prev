---
name: convex-functions
description: Guidelines for Convex queries, mutations, and actions with clear validation and minimal side effects.
---

# Convex Functions

## Function Types

- `query`: read-only data access.
- `mutation`: state changes.
- `action`: external I/O or long-running work.

## Rules

- Validate inputs explicitly.
- Keep functions single-purpose.
- Separate domain rules from transport-specific code.
- Return predictable shapes for client usage.

## Reliability

- Use idempotent patterns for retryable flows.
- Handle expected external failures explicitly in actions.
- Add tests for critical business branches.

