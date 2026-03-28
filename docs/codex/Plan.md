# Plan - Milestones de Execucao

Date: 2026-03-27  
Status: draft aprovado para execucao automatizada

## Regras de execucao

- Seguir ordem de milestones.
- Nao pular validacao.
- Se alguma validacao falhar: parar, corrigir, revalidar, so entao avancar.
- Registrar cada passo em `docs/codex/Documentation.md`.

## Milestone 0 - Baseline e diagnostico

### Objetivo

Consolidar estado atual, confirmar gaps reais e preparar trilha de alteracoes.

### Criterios de aceite

- Gaps de Fase 4/5 listados com precisao (codigo + impacto).
- Estrategia de ponte `waba* -> surface operacional` decidida e registrada.

### Validacao

```bash
git status --short
rg -n "waba|conversations|messages|attachments|webhooks/waba" packages/convex-backend -S
```

## Milestone 1 - Inbound real tenant-aware para surface da UI

### Objetivo

Garantir que inbound WA processado pelo webhook apareca no dominio usado por web/mobile.

### Criterios de aceite

- Inbound processado cria/atualiza conversa e mensagem no dominio lido pela UI.
- Isolamento tenant-aware preservado.
- Idempotencia preservada.

### Validacao

```bash
pnpm --filter @repo/convex-backend typecheck
pnpm --filter @repo/convex-backend test
```

## Milestone 2 - Outbound IA + persistencia de resposta

### Objetivo

Fechar loop IA + envio WA + persistencia outbound no Convex.

### Criterios de aceite

- Endpoint/funcoes para registrar outbound da IA.
- Resposta enviada ao WhatsApp e registrada na thread correta.
- Status de conversa atualizado conforme fluxo.
- Dois modos de IA suportados:
  - `live` (provider real configurado)
  - `mock` (sem dependencia de credencial externa)

### Validacao

```bash
pnpm --filter @repo/convex-backend typecheck
pnpm --filter @repo/convex-backend test
```

## Milestone 2.1 - Fallback IA mock-ready

### Objetivo

Permitir execucao integral do projeto sem credencial de IA, mantendo contrato compativel com modo live.

### Criterios de aceite

- Workflow n8n responde com mock deterministico quando `live` indisponivel.
- Contrato de entrada/saida do mock e compativel com provider real.
- Troca `mock -> live` documentada e sem alteracao estrutural no pipeline.

### Validacao

```bash
pnpm --filter @repo/convex-backend test
```

## Milestone 3 - Workflows n8n finais (importaveis)

### Objetivo

Entregar fluxo n8n completo de producao para este escopo.

### Criterios de aceite

- JSON importavel para:
  - inbound trigger
  - call Convex inbound
  - call IA (`live` ou `mock`)
  - send WA outbound
  - call Convex outbound
- README operacional atualizado com campos obrigatorios.

### Validacao

```bash
jq . docs/n8n/*.json >/dev/null
```

## Milestone 4 - Integracao web/mobile e consistencia de dados

### Objetivo

Garantir que UI consuma corretamente o que pipeline real persiste.

### Criterios de aceite

- Inbox e thread refletem inbound/outbound reais.
- Sem regressao no fluxo de operador (handoff/close/export).

### Validacao

```bash
pnpm --filter web typecheck || true
pnpm --filter mobile typecheck || true
pnpm --filter @repo/convex-backend test
```

## Milestone 5 - Hardening, docs finais e handoff

### Objetivo

Consolidar release tecnico: evidencias, runbook e proximos passos.

### Criterios de aceite

- `docs/codex/Documentation.md` completo.
- Instrucoes de deploy/teste n8n + Convex reproduziveis.
- Lista curta de riscos remanescentes e follow-ups.

### Validacao final

```bash
pnpm -r typecheck || true
pnpm -r test || true
```

## Dependencias externas (necessarias para E2E real)

- Credenciais WhatsApp Cloud validas (token, WABA ID, phone number id).
- Credenciais n8n (WhatsApp API + WhatsApp OAuth API).
- URL publica para webhook do n8n em modo production.
- Chave de IA (opcional para esta rodada; obrigatoria apenas para modo `live`).
