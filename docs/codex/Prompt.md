# Prompt - IAPrev Finalizacao Operacional

Date: 2026-03-27  
Owner: Codex long-horizon run

## Objetivo

Finalizar o projeto no escopo operacional acordado, com entrega ponta a ponta:

1. Entrada de mensagem WhatsApp.
2. Orquestracao no n8n.
3. Resposta da IA.
4. Envio de resposta no WhatsApp.
5. Persistencia tenant-aware no Convex.
6. Atualizacao da UI (web/mobile) com dados reais.

O resultado deve ser testavel, auditavel e alinhado com os documentos de plano ja existentes no repositorio.

### Meta de completude desta rodada

Buscar 99% de completude operacional:

- 100% do pipeline WhatsApp+n8n+Convex+UI funcional.
- Integracao de IA em modo `live` quando credenciais estiverem disponiveis.
- Se credenciais de IA nao estiverem disponiveis, entregar modo `mock` com contrato identico de entrada/saida para permitir troca para `live` sem refatoracao estrutural.

## Fontes de verdade obrigatorias

Ler e seguir estes arquivos antes de implementar:

- `docs/plans/2026-03-10-multi-tenant-design.md`
- `docs/plans/2026-03-10-multi-tenant-implementation-plan.md`
- `docs/plans/2026-03-23-iap20-waba-routing-design.md`
- `docs/plans/2026-03-25-iap21-tenant-aware-integration-plan.md`
- `docs/n8n/README.md`
- `docs/n8n/wa-01-send-template.json`
- `docs/n8n/wa-02-inbound-auto-reply.json`

## Escopo desta execucao

### In scope

- Fechar os gaps de Fase 4 + Fase 5 no fluxo real.
- Resolver o desencaixe atual entre ingestao `waba*` e leitura da UI (`conversations/messages/attachments`) sem quebrar isolamento de tenant.
- Entregar workflow n8n importavel para fluxo real:
  - inbound WA -> Convex ingest
  - chamada IA
  - outbound WA
  - persistencia de outbound no Convex
- Atualizar documentacao operacional com passo a passo reproduzivel.
- Cobrir com testes automatizados e smoke test de integracao.
- Implementar fallback `mock` da resposta de IA, com chave de feature/config clara e documentada.

### Out of scope (por decisao atual)

- Fase 6 (LGPD/auditoria ampliada/observabilidade completa).
- Fase 7 (go-live controlado multi-cliente em producao).

## Restricoes nao negociaveis

- Fail-closed para phone number sem mapping ativo.
- Zero vazamento cross-tenant.
- Idempotencia para webhook duplicado.
- Nao remover nem degradar fluxos existentes do operador.
- Nao fazer alteracoes destrutivas de git.

## Entregaveis obrigatorios

1. Backend Convex com endpoints/funcoes para fluxo inbound/outbound real usado pelo n8n.
2. Persistencia consistente para refletir inbox/thread na UI existente.
3. Workflows n8n novos em `docs/n8n/` (json importavel).
4. README de operacao n8n atualizado com credenciais, webhook e teste de ponta a ponta.
5. Testes e validacoes executados com resultado registrado.
6. `docs/codex/Documentation.md` atualizado milestone a milestone.
7. Estrategia de IA documentada com dois modos:
  - `live` (provider real)
  - `mock` (resposta deterministica de desenvolvimento)

## Done when

Considerar concluido somente quando todos abaixo estiverem verdadeiros:

- Mensagem recebida no WhatsApp aparece na inbox/thread web e mobile.
- IA gera resposta e resposta sai no WhatsApp:
  - em modo `live` quando credenciais existirem;
  - em modo `mock` quando credenciais nao existirem.
- Resposta outbound tambem aparece na thread da UI.
- Testes relevantes passam (lint/typecheck/test/build conforme plano).
- Documentacao final inclui:
  - como rodar
  - como importar workflows n8n
  - evidencias de validacao
  - como alternar entre IA `mock` e `live`
  - gaps remanescentes (se houver).
