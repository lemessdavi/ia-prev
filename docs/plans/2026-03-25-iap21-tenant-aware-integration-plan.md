# IAP-21 - Fase 5 Integracao Web/Mobile Tenant-Aware

Date: 2026-03-25  
Status: Em execucao

## 1) Referencias lidas

- `docs/plans/2026-03-10-multi-tenant-design.md`
- `docs/plans/2026-03-10-multi-tenant-implementation-plan.md`
- `docs/plans/2026-03-23-iap20-waba-routing-design.md`

Dependencia de documentacao:
- O arquivo `Levantamento de Requisitos - IA Prev v0.2` nao esta presente neste repositorio.
- Impacto: validacao formal de cobertura integral fica parcial ate o documento ser anexado/referenciado no repo.

## 2) Matriz card x levantamento (foco RF-01, RF-04, RF-05, RF-06, RF-07, RF-10)

| Item do card IAP-21 | RF principal | Estado atual base | Acao prevista nesta execucao |
| --- | --- | --- | --- |
| Exibir mensagens em tempo real (web/mobile) | RF-01 | Parcial: backend persiste e lista conversas, mas nao expone thread operacional para UI | Criar query tenant-aware de thread + polling no web/mobile |
| Reproducao/visualizacao/download de audio, imagem e PDF | RF-04 | Parcial: anexos sao persistidos pela ingestao (`IAP-20`), sem superficie de consumo no front | Expor anexos na thread + CTA abrir/baixar por canal |
| Handoff e continuidade humana | RF-05 | Parcial: existe `handoff_events` no modelo, sem mutation operacional | Criar mutation de handoff (`assistant -> human`) com auditoria |
| Painel de conversas com listagem, busca e filtros | RF-06 | Nao atendido no contrato atual (`listConversationsWithUnreadBadge` sem status/filtro) | Nova query com filtros de status e busca tenant-aware |
| Exportar arquivos da conversa | RF-07 | Parcial: arquivos da conversa existe em query de contato, sem fluxo de exportacao | Criar query de exportacao minima e acao de download/compartilhamento |
| Encerrar caso com motivo | RF-10 | Nao atendido | Criar mutation para fechamento com motivo + log de auditoria |

## 3) Dependencias e blockers antes da codificacao

### 3.1 Blockers de contrato backend (tratados nesta branch)

1. Nao existe query publica para obter mensagens/anexos por conversa tenant-aware.
2. Nao existe mutation para handoff operacional.
3. Nao existe mutation para encerramento com motivo.
4. Nao existe query para exportacao minima de arquivos da conversa por conversa.
5. Nao existe query de lista de conversas com busca/filtro por status.

### 3.2 Dependencia externa de documentacao (nao bloqueante para codar)

- Falta no repo o documento de levantamento v0.2 citado no plano macro.

## 4) Plano de implementacao por camada

### 4.1 Backend contract

- Adicionar tipos e contrato para:
  - resumo operacional do tenant autenticado;
  - lista de conversas com filtros e busca;
  - thread de conversa (mensagens, anexos e historico de handoff);
  - handoff da conversa;
  - encerramento com motivo;
  - exportacao minima de arquivos da conversa.
- Garantir isolamento tenant-aware em todas as operacoes.
- Adicionar testes de integracao cobrindo:
  - bloqueio cross-tenant;
  - filtros/busca;
  - handoff;
  - encerramento com motivo;
  - exportacao.

### 4.2 Web

- Remover dependencia de `packages/utils/src/chatMocks.ts` na tela operacional.
- Implementar login/sessao real de `tenant_user`.
- Consumir contrato tenant-aware real para:
  - lista, busca e filtro de conversas;
  - thread e anexos;
  - handoff;
  - exportacao de arquivos da conversa;
  - encerramento com motivo.
- Implementar estados `loading`, `empty` e `error`.

### 4.3 Mobile

- Remover dependencia de mocks compartilhados.
- Implementar login/sessao real e resolver tenant autenticado.
- Consumir mesmo contrato tenant-aware para conversas/chat/arquivos da conversa.
- Implementar handoff, anexos, exportacao minima e encerramento com motivo.
- Implementar estados `loading`, `empty` e `error`.

## 5) Criterios de validacao nesta branch

- Tenant user A nao enxerga dados do tenant B no backend e nas superficies.
- Web e mobile deixam de depender de `chatMocks`.
- Fluxos minimos funcionando:
  - listar/buscar/filtrar conversas;
  - abrir thread e anexos;
  - assumir handoff;
  - exportar arquivos da conversa;
  - encerrar caso com motivo.
- Testes automatizados atualizados e verdes para os contratos novos.
