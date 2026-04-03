---
name: ddd-lite-monorepo
description: Lightweight DDD guidance for apps in this monorepo. Use for naming, boundaries, and domain-first modeling without heavy ceremony.
---

# DDD Lite for Monorepo

## Goal

Keep business logic explicit and isolated from framework details.

## Boundaries

- `domain`: business rules, entities, value objects, pure logic.
- `application`: use cases, orchestration, transaction flow.
- `infrastructure`: API clients, persistence, adapters.
- `ui`: presentation and interaction only.

## Rules

- Domain code does not import UI/framework modules.
- Use explicit names from business language.
- Keep use-cases small and intention-revealing.
- Prefer composition over inheritance.

## Suggested Layout

- `apps/*/src/domain/*`
- `apps/*/src/application/*`
- `apps/*/src/infrastructure/*`
- `packages/ui/*` only for reusable presentation.

## Heuristics

- If a module mixes API calls and rules, split it.
- If naming uses transport terms (`dto`, `response`) in domain, move/rename.
- If two flows share business rules, extract domain service.

