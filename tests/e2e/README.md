# Playwright E2E - IAP-21

Suite E2E baseada no documento:
- `docs/plans/2026-03-25-iap21-tenant-aware-integration-plan.md`

Cobertura:
- Login + sessao
- Inbox (busca/filtro)
- Thread + envio de mensagem
- Handoff
- Fechamento com motivo
- Export de dossie
- Isolamento tenant-aware
- Webhook WABA (fail-closed + idempotencia)
- Fluxo no layout mobile (web responsivo)

## Pre-requisitos

1. Convex rodando.
2. `NEXT_PUBLIC_CONVEX_URL` configurada.
3. Seed de dados carregada com o dataset demo.

Exemplo:

```bash
pnpm convex:dev
pnpm convex:seed
pnpm --filter web dev:e2e
```

## Variaveis opcionais para E2E

- `E2E_BASE_URL` (default `http://127.0.0.1:3100`)
- `E2E_CONVEX_URL` (se omitida, usa `NEXT_PUBLIC_CONVEX_URL`; aceita `.convex.cloud` e converte para `.convex.site` no webhook)

## Execucao

```bash
E2E_BASE_URL=http://127.0.0.1:3100 pnpm test:e2e
```

Para ver o Chromium abrindo (modo visual):

```bash
E2E_BASE_URL=http://127.0.0.1:3100 pnpm test:e2e:headed
```

Modo debug interativo (pausa/inspector):

```bash
E2E_BASE_URL=http://127.0.0.1:3100 pnpm test:e2e:debug
```

Projeto mobile layout:
- roda no projeto `chromium-mobile` (viewport mobile no web app).
