# Playwright E2E Design - IAP-21

Date: 2026-03-25  
Status: implementado na branch `convex-migration`

## Contexto

Objetivo: validar os fluxos funcionais da integração tenant-aware em runtime Convex, sem depender do backend legado em memória, cobrindo:
- login/sessão
- inbox/thread/envio
- handoff
- fechamento com motivo
- export de dossiê
- tenant isolation
- webhook WABA com fail-closed e idempotência

Documento base:
- `docs/plans/2026-03-25-iap21-tenant-aware-integration-plan.md`

## Abordagens consideradas

1. **Somente testes de API/Convex**
- Prós: execução rápida.
- Contras: não valida comportamento de UI e regressões de interação.

2. **Playwright só no fluxo desktop**
- Prós: cobre UI crítica com baixa complexidade.
- Contras: deixa sem cobertura explícita do layout mobile no web.

3. **Playwright desktop + mobile viewport + webhook HTTP**
- Prós: cobre contrato funcional completo do documento e cenário responsivo.
- Contras: maior esforço de seleção estável e setup.

## Decisão

Escolhida a abordagem 3.

## Arquitetura de testes

- `playwright.config.ts` no root, com projetos:
  - `chromium-desktop`
  - `chromium-mobile`
- Specs:
  - `tests/e2e/operator-core-flows.spec.ts`
  - `tests/e2e/tenant-and-webhook.spec.ts`
  - `tests/e2e/mobile-layout-flows.spec.ts`
- Helpers:
  - `tests/e2e/helpers/operatorConsole.ts`
  - `tests/e2e/helpers/wabaWebhook.ts`

## Estratégia de estabilidade

- Uso de `data-testid` em `apps/web/src/app/page.tsx` para reduzir flakiness.
- Fluxos críticos executados em `chromium-desktop` e fluxo de layout em `chromium-mobile`.
- Webhook validado via HTTP action (`/webhooks/waba`) com asserts de status/body.

## Riscos conhecidos

- Suite assume ambiente com seed demo disponível.
- Como as operações mudam estado (handoff/fechamento), recomenda-se manter seed consistente antes da execução.
