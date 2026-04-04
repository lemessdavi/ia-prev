# AGENTS.md

## Contexto Atual do Repositório

- Stack principal: monorepo com `apps/*`, `packages/*` e backend Convex em `packages/convex-backend/convex`.
- Toda mudanca deve gerar um commit
- Todo commit deve ser production-ready.
- Toda mudança deve usar sua SKILL de TDD.
- Sempre siga o ciclo de TDD e commite logo em seguida.
- Rode toda teste suite após cada commit.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
