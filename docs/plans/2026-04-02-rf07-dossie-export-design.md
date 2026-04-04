# RF-07 - Design de Definicao do arquivos da conversa e Export ZIP de anexos

Date: 2026-04-02  
Status: aprovado para implementacao na branch `lemes/arquivos da conversa-pdf-zip-spec`

## Contexto

O fluxo atual exporta apenas JSON e o termo "arquivos da conversa" estava ambiguo.  
RF-07 pede:
- definicao formal de arquivos da conversa nesta versao
- export em PDF e ZIP
- ajuste web/mobile para baixar/compartilhar no novo formato
- compatibilidade minima com dados existentes

## Abordagens consideradas

1. **Gerar PDF/ZIP no cliente (web/mobile), mantendo backend como fonte do JSON**
- Pro: baixo acoplamento backend, sem storage adicional, evolucao incremental.
- Contra: logica de arquivo no frontend/shared utils.

2. **Gerar PDF/ZIP no backend Convex**
- Pro: centraliza geracao.
- Contra: maior custo de runtime, maior complexidade operacional.

3. **Somente ZIP (sem PDF real)**
- Pro: simples.
- Contra: nao atende requisito funcional.

## Decisao

Adotada a abordagem 1.

## Design tecnico

- Contrato de export recebe versao explicita: `formatVersion: "arquivos da conversa.v1"`.
- Contrato passa a incluir metadados de conversa (`conversationStatus`, `triageResult`) para remover ambiguidade de escopo.
- `packages/utils` centraliza:
  - geracao de PDF de resumo legivel
  - empacotamento ZIP com JSON + PDF
  - utilitario de base64 para compartilhamento mobile
- Web:
  - exporta ZIP (botao principal legado)
  - exporta PDF (botao dedicado)
- Mobile:
  - compartilha ZIP e PDF via arquivo temporario.

## Testes (TDD)

- RED:
  - testes de contrato (`formatVersion`)
  - testes de estrutura de artefatos PDF/ZIP
- GREEN:
  - implementacao minima para passar
- REFACTOR:
  - manter logica de artefatos em modulo unico compartilhado

