# IAP-22 - WhatsApp n8n Convex Real Flow (Plan + Implementacao)

Date: 2026-03-27
Status: Implementado nesta branch

## Objetivo

Fechar fluxo ponta a ponta real:

1. WhatsApp inbound chega no n8n.
2. n8n persiste inbound no Convex em `conversations/messages/attachments`.
3. n8n chama OpenAI e gera resposta.
4. n8n envia resposta no WhatsApp.
5. n8n persiste outbound no mesmo `conversationId` no Convex.

## Gap encontrado

- O webhook nativo `/webhooks/waba` persistia em tabelas `waba*`.
- Web/mobile leem `conversations/messages/attachments` via `chatDomain`.
- Resultado: evento entrava no backend, mas nao aparecia na inbox/thread principal.

## Decisao de arquitetura

1. Manter `/webhooks/waba` como ingestao tecnica `waba*` (nao quebrar fluxo atual).
2. Adicionar ponte dedicada para n8n:
   - `POST /integrations/n8n/whatsapp/inbound`
   - `POST /integrations/n8n/whatsapp/outbound`
3. Essas rotas chamam mutacoes internas que escrevem diretamente no modelo consumido pela UI.

## Regras de negocio implementadas

- Tenant-aware por `phoneNumberId` usando `wabaTenantMappings`.
- Fail-closed quando `N8N_INTEGRATION_SECRET` nao configurado (`503`).
- Autorizacao por header `x-n8n-integration-secret` (`401` quando invalido).
- Upsert de conversa WhatsApp em `conversations` com `conversationId` deterministico por tenant+phone+wa_id.
- Inclusao de `conversationMemberships` para usuarios do tenant, para conversa aparecer no inbox.
- Dedupe basico por `externalMessageId` (quando presente) via `messageId` deterministico.
- Persistencia inbound/outbound em `messages` e anexos em `attachments`.

## Entregaveis

- Backend Convex: endpoints + mutacoes de ponte n8n.
- Workflow n8n importavel: `docs/n8n/wa-03-real-flow-convex-openai.json`.
- Docs atualizadas com setup reproduzivel: `docs/n8n/README.md`.
- Teste automatizado cobrindo inbound/outbound + visibilidade via `chatDomain`.

## Validacao executada

- Teste novo (`n8nBridge.test.ts`) criado em TDD (vermelho -> verde).
- Cenarios cobertos:
  - inbound armazenado nas tabelas de chat;
  - outbound armazenado no mesmo `conversationId`;
  - conversa visivel em query de inbox/thread;
  - dedupe de inbound;
  - fail-closed sem secret.
