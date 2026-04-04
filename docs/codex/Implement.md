# Implement - Runbook Fluxo Direto

Date: 2026-03-30

## Ordem de referencia

1. `docs/codex/Prompt.md`
2. `docs/codex/Plan.md`
3. Documentos em `docs/plans/`
4. Estado real do codigo

## Loop operacional

Para cada milestone:

1. Implementar escopo minimo.
2. Rodar validacao do milestone.
3. Corrigir regressao imediatamente.
4. Registrar evidencias em `docs/codex/Documentation.md`.

## Regras

- Preservar isolamento tenant-aware.
- Preservar fail-closed para roteamento por `phone_number_id`.
- Preservar idempotencia da ingestao.
- Nao introduzir orquestrador externo no pipeline.
- Manter diffs pequenos e revisaveis.
