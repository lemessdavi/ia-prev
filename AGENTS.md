# AGENTS.md

## Contexto Atual do Repositório

- Stack principal: monorepo com `apps/*`, `packages/*` e backend Convex em `packages/convex-backend/convex`.
- Fluxo de handoff com notificação WhatsApp ao cliente (RF-05) agora é **direto via WhatsApp Cloud API**.
- Não usar n8n para novos fluxos de handoff/notificação.

## Fluxo Atual de Handoff (Fonte de Verdade)

1. A action [`chatHandoffNode:takeConversationHandoff`](packages/convex-backend/convex/chatHandoffNode.ts) orquestra o handoff.
2. A preparação valida sessão, conversa e dados WA em [`chatDomain:prepareConversationHandoff`](packages/convex-backend/convex/chatDomain.ts).
3. O envio da mensagem ocorre direto na Graph API:
   - `POST https://graph.facebook.com/{version}/{phoneNumberId}/messages`
4. Se envio falhar:
   - handoff **não** é concluído;
   - falha auditada em `auditLogs` com ações:
     - `conversation.handoff.taken.failed`
     - `conversation.handoff.whatsapp_notification.failed`
5. Se envio funcionar:
   - handoff é concluído;
   - mensagem é persistida no histórico da conversa;
   - auditoria registra:
     - `conversation.handoff.taken`
     - `conversation.handoff.whatsapp_notification.sent`

## Variáveis de Ambiente (Handoff)

- Obrigatória:
  - `WHATSAPP_CLOUD_ACCESS_TOKEN`
- Opcionais:
  - `WHATSAPP_CLOUD_API_VERSION` (default: `v22.0`)
  - `WHATSAPP_CLOUD_GRAPH_BASE_URL` (default: `https://graph.facebook.com`)

## Diretrizes para Novas Mudanças

- Não introduzir novas dependências de n8n em código de produção.
- Não adicionar env vars `N8N_*` para fluxos novos.
- Não criar endpoints novos sob `/integrations/n8n/*`.
- Tratar referências a n8n como legado, exceto quando estiver editando artefatos históricos.

## Legado e Escopo de Limpeza

Referências históricas de n8n podem existir em:
- `logs/**`
- `docs/codex/**`
- documentos de plano antigos em `docs/plans/**`

Esses arquivos são históricos; não são fonte de verdade operacional atual.

## Checklist Anti-Regressão (antes de merge)

1. Confirmar que handoff usa `chatHandoffNode:takeConversationHandoff`.
2. Rodar:
   - `pnpm --filter @repo/convex-backend typecheck`
   - `pnpm --filter @repo/convex-backend test operatorWorkspaceFlows.test.ts`
3. Verificar que não houve nova introdução de n8n:
   - `rg -n "N8N_|/integrations/n8n|n8n" packages apps README.md docs -S`

