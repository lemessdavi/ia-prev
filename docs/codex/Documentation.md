# Documentation - Fluxo Direto WhatsApp

Date: 2026-03-30
Run owner: Codex

## Status atual

- Pipeline ativo: Meta WhatsApp -> Convex -> OpenAI -> WhatsApp.
- Persistencia inbound/outbound no `chatDomain`.
- Auto-reply executado no backend Convex.
- Sem rotas de integracao legadas no backend.

## Decisoes tecnicas

- Consolidar somente `POST /webhooks/waba` como entrada operacional.
- Manter fallback mock quando `OPENAI_API_KEY` nao estiver configurada.
- Persistir outbound na mesma conversa para consistencia da UI.

## Evidencias de validacao

- `pnpm --filter @repo/convex-backend typecheck`
- `pnpm --filter @repo/convex-backend test`
- `pnpm --filter web typecheck`
- `pnpm --filter mobile typecheck`
