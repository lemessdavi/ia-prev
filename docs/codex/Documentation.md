# Documentation - Log de Execucao Long Horizon

Date: 2026-03-27  
Run owner: Codex

## 1) Status geral

| Milestone | Nome | Status | Inicio | Fim | Observacoes |
| --- | --- | --- | --- | --- | --- |
| M0 | Baseline e diagnostico | PENDING | - | - | - |
| M1 | Inbound real tenant-aware para surface da UI | PENDING | - | - | - |
| M2 | Outbound IA + persistencia de resposta | PENDING | - | - | - |
| M2.1 | Fallback IA mock-ready | PENDING | - | - | - |
| M3 | Workflows n8n finais (importaveis) | PENDING | - | - | - |
| M4 | Integracao web/mobile e consistencia de dados | PENDING | - | - | - |
| M5 | Hardening, docs finais e handoff | PENDING | - | - | - |

Legenda de status: `PENDING` | `IN_PROGRESS` | `DONE` | `BLOCKED`

## 2) Decisoes tecnicas

Registrar decisoes arquiteturais relevantes.

- [pendente]

## 3) Diario de execucao

Adicionar entradas cronologicas:

### Template de entrada

```txt
Timestamp:
Milestone:
Mudancas:
Arquivos alterados:
Comandos de validacao:
Resultado:
Proximo passo:
```

## 4) Evidencias de validacao

Registrar somente comandos e resultado resumido.

- [pendente]

## 5) Estado dos workflows n8n

Checklist operacional:

- [ ] Inbound trigger ativo
- [ ] Convex inbound call ok
- [ ] IA response call ok (live ou mock)
- [ ] WhatsApp outbound send ok
- [ ] Convex outbound persist ok
- [ ] Fluxo completo testado de ponta a ponta

Modo de IA em uso:

- [ ] live
- [ ] mock

Arquivos esperados em `docs/n8n/`:

- `wa-01-send-template.json`
- `wa-02-inbound-auto-reply.json`
- `wa-03-real-e2e.json` (novo esperado)
- `wa-04-ai-mock-or-live.json` (novo esperado)
- `README.md`

## 6) Bloqueios

Registrar bloqueios com acao necessaria.

- [nenhum bloqueio registrado ate o momento]

## 7) Riscos remanescentes

- [pendente]

## 8) Handoff final

Preencher ao final:

- O que foi entregue
- O que ficou pendente
- Como reproduzir localmente
- Como operar no n8n
