# IA Prev Monorepo (Convex-first)

Monorepo com frontend web/mobile consumindo backend oficial via Convex (`queries`, `mutations`, `actions`, `internal*`, `http actions`).

## Stack

- Web: Next.js 16 (`apps/web`)
- Mobile: Expo SDK 54 (`apps/mobile`)
- Backend: Convex (`packages/convex-backend/convex`)
- Tipos compartilhados da API Convex: `@repo/convex-backend`

## Estrutura Canônica Convex

```txt
packages/
  convex-backend/
    convex/
      schema.ts
      http.ts
      auth.ts
      authNode.ts
      tenants.ts
      users.ts
      usersNode.ts
      aiProfiles.ts
      adminWaba.ts
      chatDomain.ts
      wabaWebhook.ts
      seed.ts
      seedNode.ts
    src/
      api.ts        # referências tipadas para consumidores
      index.ts
```

## Pré-requisitos

- Node.js 20+
- pnpm 10+
- Conta/projeto Convex configurado no ambiente local

## Configuração

1. Instalar dependências:

```bash
pnpm install
```

2. Inicializar/associar deployment Convex (primeira vez):

```bash
pnpm convex:dev
```

3. Copiar URLs do Convex para os apps:

- `apps/web/.env.local`
  - `NEXT_PUBLIC_CONVEX_URL=...`
- `apps/mobile/.env`
  - `EXPO_PUBLIC_CONVEX_URL=...`
  - opcional:
    - `EXPO_PUBLIC_DEMO_USERNAME=ana.lima`
    - `EXPO_PUBLIC_DEMO_PASSWORD=Ana@123456`

4. Popular dados de demo:

```bash
pnpm convex:seed
```

## Subir stack completa (web + mobile + Convex)

Opção única:

```bash
pnpm dev
```

Ou em terminais separados:

```bash
pnpm convex:dev
pnpm dev:web
pnpm dev:mobile
```

## Geração de API tipada Convex

```bash
pnpm convex:codegen
```

Consumidores importam referências tipadas de:

```ts
import { api } from "@repo/convex-backend";
```

## Scripts principais

- `pnpm dev`: Convex + web + mobile
- `pnpm convex:dev`: backend Convex local
- `pnpm convex:seed`: seed de dados demo
- `pnpm convex:codegen`: gerar tipos Convex
- `pnpm build`: codegen + build monorepo
- `pnpm typecheck`: codegen + typecheck
- `pnpm test`: testes Convex backend + testes web

## Notas de arquitetura

- Caminho de produção do frontend não usa backend em memória nem rotas `/api/*` intermediárias para lógica de negócio.
- Web/mobile consomem Convex pelo cliente oficial (`convex/react`).
- O pacote `packages/backend` permanece apenas como legado de referência/testes históricos, fora do caminho oficial de produção.
