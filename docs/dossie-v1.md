# Definicao do Dossie v1 (RF-07)

Status: ativo  
Versao de formato: `dossie.v1`

## Objetivo

Padronizar o significado de "Dossie" no produto e remover ambiguidade no export.

Nesta versao, **Dossie** e o pacote de dados de uma conversa entre operador e contato, contendo:
- metadados da conversa
- perfil consolidado do contato
- trilha recente de eventos do caso
- mensagens, anexos e handoffs da conversa

## Estrutura canonica (JSON)

### Campos obrigatorios de topo

- `formatVersion`: `"dossie.v1"`
- `tenantId`: `string`
- `conversationId`: `string`
- `conversationStatus`: `"EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO"`
- `triageResult`: `"APTO" | "REVISAO_HUMANA" | "NAO_APTO" | "N_A"`
- `contactId`: `string`
- `generatedAtIso`: `string` (ISO-8601)
- `dossier`: objeto `Dossier`
- `recentEvents`: lista de `DossierEvent`
- `messages`: lista de `Message`
- `attachments`: lista de `Attachment`
- `handoffEvents`: lista de `HandoffEvent`

### Campos opcionais de topo

- `closureReason`: `string` (presente quando a conversa foi encerrada com motivo)

### Objeto `Dossier`

Campos obrigatorios:
- `id`
- `tenantId`
- `contactId`
- `role`
- `company`
- `location`
- `summary`
- `tags`
- `updatedAt`

Campos opcionais:
- nenhum na v1

### Objeto `DossierEvent`

Campos obrigatorios:
- `id`
- `tenantId`
- `contactId`
- `title`
- `description`
- `occurredAt`
- `type` (`interaction | status | note`)

Campos opcionais:
- nenhum na v1

## Artefatos de export

### PDF

Arquivo legivel para humano com resumo operacional do Dossie v1:
- identificadores (tenant, conversa, contato)
- status/triagem e fechamento
- dados consolidados do contato
- indicadores de volume (mensagens/anexos/handoffs/eventos)
- eventos recentes

### ZIP

Pacote da conversa contendo:
- `dossie-<conversationId>.json` (estrutura canonica v1)
- `dossie-<conversationId>.pdf` (resumo legivel)

## Compatibilidade minima

- O JSON legado permanece disponivel dentro do ZIP.
- O fluxo de leitura de dossie na UI segue usando o mesmo endpoint de export.
- Novos campos (`formatVersion`, `conversationStatus`, `triageResult`) sao aditivos.

