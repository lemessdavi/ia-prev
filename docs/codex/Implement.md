# Implement - Runbook de Execucao

Date: 2026-03-27

## Ordem de prioridade de instrucoes

1. `docs/codex/Prompt.md`
2. `docs/codex/Plan.md`
3. Documentos em `docs/plans/`
4. Estado real do codigo no repositorio

Se houver conflito, seguir a ordem acima e registrar decisao em `Documentation.md`.

## Loop operacional obrigatorio

Para cada milestone:

1. Ler objetivo e criterios.
2. Implementar em escopo minimo necessario.
3. Rodar validacoes do milestone.
4. Corrigir falhas imediatamente.
5. Atualizar `docs/codex/Documentation.md`:
  - status
  - decisoes
  - comandos executados
  - resultados
6. Avancar para o proximo milestone.

## Politica de escopo

- Nao expandir escopo sem necessidade tecnica real.
- Nao atacar Fase 6 e Fase 7 nesta execucao.
- Nao reescrever areas nao relacionadas.

## Politica de qualidade

- Toda mudanca deve ser testavel.
- Preferir cobertura automatizada para fluxos novos.
- Nao deixar TODO critico sem registrar em `Documentation.md`.

## Politica de seguranca e dados

- Preservar isolamento tenant-aware.
- Preservar fail-closed no roteamento por `phone_number_id`.
- Preservar idempotencia de ingestao webhook.
- Nunca vazar token/segredo em logs ou docs.

## Politica de diffs

- Diffs pequenos e revisaveis.
- Um objetivo tecnico claro por bloco de alteracoes.
- Evitar refactors grandes sem ganho direto para milestone atual.

## Politica de bloqueio

Se bloquear por dependencia externa (credencial/infra/acesso):

1. Tentar fallback tecnico seguro.
2. Se nao houver fallback, registrar bloqueio com:
  - causa
  - impacto
  - acao necessaria do usuario
3. Continuar em tarefas desbloqueadas do milestone.

### Regra especifica para IA

Se nao houver credenciais de IA `live`, implementar e usar caminho `mock` obrigatoriamente.

- O fluxo nao pode ficar bloqueado por falta de chave.
- O mock deve manter contrato compativel com provider real.
- A comutacao `mock/live` deve ficar parametrizada e documentada.

## Checklist de encerramento

Antes de concluir a execucao:

- Todos milestones in-scope completos ou com bloqueio explicitamente registrado.
- Validacoes finais rodadas.
- `docs/codex/Documentation.md` atualizado e coerente com o codigo.
- Artefatos n8n importaveis presentes em `docs/n8n/`.
