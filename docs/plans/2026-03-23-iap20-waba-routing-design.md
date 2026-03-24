# IAP-20 - WABA Routing & Ingestao (Design + Entregaveis)

Date: 2026-03-23  
Status: Implementado

## 1) Escopo confirmado

Card alvo: `IAP-20`  
Objetivo: entrada/normalizacao de eventos WhatsApp com roteamento tenant-aware por `phone_number_id`, fail-closed em mapeamento ausente, persistencia correta de mensagem/anexo, idempotencia basica e auditoria minima.

## 2) Abordagens consideradas

1. Modulo novo de ingestao + reuso do store atual (**escolhida**).  
2. Acoplar ingestao dentro de `queries.ts`.  
3. Criar camada de servico mais ampla para webhook.

Decisao: abordagem 1 por menor risco de conflito com `IAP-19`, diff isolado e pipeline explicito.

## 3) Matriz card x levantamento (RF/RNF/RN/UC)

| Item do card IAP-20 | RF | RNF | RN | UC | Cobertura |
| --- | --- | --- | --- | --- | --- |
| Normalizar evento WhatsApp | RF-01 | RNF-01 (confiabilidade de parse) | RN-01 (aceitar tipos text/image/audio/document) | UC-01 | `normalizeInboundMessage` em `webhookIngestion.ts` |
| Resolver tenant por `phone_number_id` | RF-02 | RNF-02 (isolamento tenant) | RN-02 (resolver sempre antes de persistir) | UC-01/UC-02 | `resolveTenantByPhoneNumberId` + pipeline |
| Fail-closed sem mapeamento | RF-03 | RNF-03 (seguranca operacional) | RN-03 (bloquear persistencia) | UC-03 | retorno `status=blocked` + `webhook.routing.failed` |
| Associar mensagem/anexo ao tenant/conversa corretos | RF-04 | RNF-02 | RN-04 (conversa por `tenant + waContactId`) | UC-01/UC-04 | `upsertConversation`, `insertMessage`, `insertAttachment` |
| Ingestao texto, imagem, audio, PDF | RF-05 | RNF-01 | RN-05 (media vira attachment) | UC-04 | testes dedicados para 4 tipos |
| Idempotencia para webhook reprocessado | RF-06 | RNF-04 (retry-safe) | RN-06 (dedupe por `messageId` normalizado) | UC-05 | `findMessage` + retorno `ignored` |
| Log/auditoria minima de roteamento e falha | RF-07 | RNF-05 (auditabilidade) | RN-07 (auditar ingestao/duplicata/falha) | UC-06 | `insertAuditLog` + `logInfo/logError` |

Legenda curta:
- RF: requisito funcional
- RNF: requisito nao funcional
- RN: regra de negocio
- UC: caso de uso

## 4) Fluxo de roteamento implementado

Pipeline executado por `ingestWhatsAppWebhook`:

1. Normaliza payload (`phone_number_id`, `message.id`, `from`, tipo, conteudo, anexo).
2. Resolve tenant por `phone_number_id`.
3. Se mapeamento ausente: bloqueia (fail-closed), audita falha e retorna `blocked`.
4. Deduplica por `messageId` normalizado (`wa_<external_id>`).
5. Persiste conversa (upsert), mensagem e anexo (quando existir).
6. Registra auditoria de ingestao/duplicata e logs estruturados.

## 5) Estrategia de idempotencia

- Chave de dedupe: `messageId` normalizado (`wa_<external_message_id>`).
- Antes de persistir, busca `findMessage(messageId, tenantId)`.
- Se ja existir: nao duplica mensagem/anexo, registra `webhook.duplicate.ignored` e retorna `status=ignored`.

## 6) Evidencias de testes executados

Comandos:

```bash
npm --prefix packages/backend run compile
npm --prefix packages/backend run test
```

Resultado:
- `compile`: sucesso
- `test`: `31` testes passando (`0` falhas)
- Cobertura direta de IAP-20:
  - isolamento tenant A/B
  - fail-closed para `phone_number_id` desconhecido
  - idempotencia (mesmo webhook id)
  - ingestao texto, imagem, audio e PDF
  - testes negativos de isolamento

## 7) Riscos e gaps remanescentes

1. Payload real da Meta pode trazer variacoes adicionais nao cobertas no MVP (ex.: multiplas mensagens por evento).
2. Attachment URL em producao pode exigir resolucao via API de media (hoje usa URL direta/fallback).
3. Conversa inbound cria agrupamento por `tenant + waContactId`; regras de distribuicao para atendentes humanos ficam para card futuro.

## 8) Declaracao de nao interferencia no IAP-19

- Nao houve alteracao em `apps/web/**` nem `apps/mobile/**`.
- Alteracoes concentradas em backend (`packages/backend/**`) e documentacao de plano.
- Nenhuma rota/tela ligada ao escopo do `IAP-19` foi modificada.
