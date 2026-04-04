# Plan - Fluxo Direto WhatsApp

Date: 2026-03-30
Status: vigente

## Objetivo

Manter o fluxo operacional direto:

1. Meta WhatsApp Webhook recebe inbound.
2. Convex processa e persiste em `chatDomain`.
3. Convex chama OpenAI para gerar resposta.
4. Convex envia outbound via WhatsApp Cloud API.
5. Convex persiste outbound na mesma conversa.

## Milestones

### M0 - Ingestao webhook

- `POST /webhooks/waba` processa payload e preserva isolamento tenant-aware.
- Fail-closed para `phone_number_id` desconhecido.
- Idempotencia de inbound preservada.

Validacao:

```bash
pnpm --filter @repo/convex-backend test
```

### M1 - Resposta automatica

- Auto-reply por OpenAI com fallback mock.
- Envio WhatsApp Cloud API sem componente intermediario.

Validacao:

```bash
pnpm --filter @repo/convex-backend test
```

### M2 - Superficies web/mobile

- Inbox/thread refletem inbound e outbound persistidos no `chatDomain`.

Validacao:

```bash
pnpm --filter web typecheck || true
pnpm --filter mobile typecheck || true
```

### M3 - Hardening

- Typecheck backend verde.
- Suite backend verde.
- Documentacao alinhada com fluxo direto.

Validacao:

```bash
pnpm --filter @repo/convex-backend typecheck
pnpm --filter @repo/convex-backend test
```
