# IAP-20 - WABA Routing Convex-only (Design + Entregaveis)

Date: 2026-03-23  
Status: Implementado em Convex

## 1) Escopo confirmado

Card alvo: `IAP-20`  
Objetivo: ingestao de webhook WhatsApp no backend Convex com roteamento tenant-aware por `phone_number_id`, fail-closed auditavel, idempotencia sem colisao e persistencia correta de mensagem/anexo por tenant.

## 2) Arquitetura escolhida

1. Entrada HTTP em `packages/convex-backend/convex/http.ts` via `httpAction` (rota `POST /webhooks/waba`).
2. Processamento transacional em `packages/convex-backend/convex/wabaWebhook.ts` (`processIncomingWebhook`).
3. Persistencia em tabelas Convex (`wabaConversations`, `wabaMessages`, `wabaAttachments`, `wabaWebhookDeliveries`, `wabaAuditLogs`).

Decisao: manter toda a cadeia no Convex para eliminar dependencia de `packages/backend/**` neste card.

## 3) Fluxo implementado

1. `httpAction` recebe o payload bruto e invoca mutation interna de processamento.
2. Payload e normalizado para mensagens inbound.
3. Tenant e resolvido por `phone_number_id` via indice `wabaTenantMappings.by_phone_number_id`.
4. Sem mapeamento ativo: bloqueia (fail-closed), audita e nao persiste mensagem/anexo.
5. Com mapeamento: aplica idempotencia, upsert de conversa e persistencia tenant-aware de mensagem/anexo.
6. Auditoria registra eventos de processamento, duplicata e bloqueio.

## 4) Requisitos-chave do card

### 4.1 Webhook entrypoint via HTTP action

- `packages/convex-backend/convex/http.ts`
- `POST /webhooks/waba` chama `processIncomingWebhook`.
- Retorno `404` em bloqueio total (fail-closed) e `200` nos demais cenarios.

### 4.2 Roteamento por `phone_number_id` com indice

- Tabela `wabaTenantMappings` em `schema.ts` com indice `by_phone_number_id`.
- Resolucao de tenant usando consulta indexada (`unique()`).

### 4.3 Fail-closed + auditoria

Eventos bloqueados auditados em `wabaAuditLogs`:
- `unknown_phone_number_id`
- `missing_phone_number_id`
- `invalid_json`

Em bloqueio total do lote, a rota HTTP retorna `404`.

### 4.4 Idempotencia sem colisao

- Chave: `JSON.stringify(["waba_inbound_v1", tenantId, phoneNumberId, externalMessageId])`.
- Dedupe por indice `wabaWebhookDeliveries.by_idempotency_key`.
- Cobertura de teste para ids com caracteres especiais garante ausencia de colisao por concatenacao ambigua.

### 4.5 Persistencia tenant-aware de mensagem/anexo

- `wabaMessages` grava `tenantId`, `phoneNumberId`, `conversationId` e payload bruto.
- `wabaAttachments` grava `tenantId`, `conversationId`, `messageId` e metadados de midia.
- Testes asseguram isolamento entre tenants distintos.

## 5) Evidencias de validacao

Comandos de validacao do pacote Convex:

```bash
pnpm --filter @repo/convex-backend typecheck
pnpm --filter @repo/convex-backend test
```

Cobertura principal do IAP-20 em `packages/convex-backend/test/wabaWebhook.test.ts`:
- isolamento tenant A/B e persistencia correta de anexos
- fail-closed para `phone_number_id` desconhecido
- fail-closed para payload sem `phone_number_id`
- fail-closed para JSON invalido
- idempotencia para webhook duplicado
- dedupe sem colisao com caracteres especiais na chave

## 6) Declaracao de escopo deste PR

- IAP-20 migrado para fluxo Convex-only.
- `packages/backend/**` removido do diff alvo deste PR.
