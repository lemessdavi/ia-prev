# Prompt - Operacao WhatsApp Direta

Date: 2026-03-30
Owner: Codex

## Objetivo

Garantir pipeline ponta a ponta sem intermediarios:

1. Entrada de mensagem WhatsApp no webhook Meta.
2. Persistencia tenant-aware no Convex.
3. Geracao de resposta por IA (OpenAI ou mock).
4. Envio de resposta no WhatsApp Cloud API.
5. Persistencia outbound e refletir na UI.

## Entregaveis obrigatorios

1. Backend Convex com fluxo direto via `/webhooks/waba`.
2. Persistencia consistente para inbox/thread.
3. Auto-reply com OpenAI e fallback mock.
4. Testes e validacoes registradas.
5. Documentacao operacional sem dependencias legadas.
