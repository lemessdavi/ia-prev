# n8n WhatsApp Cloud - fluxos importaveis

## Arquivos

- `wa-01-send-template.json`: envio manual do template `hello_world`.
- `wa-02-inbound-auto-reply.json`: trigger + auto reply simples (sem Convex/OpenAI).
- `wa-03-real-e2e.json`: fluxo real ponta a ponta em modo live (WhatsApp -> n8n -> OpenAI -> WhatsApp -> Convex chat tables).
- `wa-04-ai-mock-or-live.json`: fluxo real com comutacao `mock/live` sem mudar contrato.
- `wa-03-real-flow-convex-openai.json`: versao anterior mantida por compatibilidade.

## Pre-requisitos

### 1) Credenciais n8n

- Credencial `WhatsApp API` (tipo `whatsAppApi`):
  - `Access Token`
  - `Business Account ID`: `1278317544257467`
- Credencial `WhatsApp OAuth API` (tipo `whatsAppTriggerApi`):
  - `Client ID` (App ID Meta)
  - `Client Secret` (App Secret Meta)

### 2) Environment variables no n8n (para `wa-03` e `wa-04`)

Configure no ambiente do n8n:

- `CONVEX_SITE_URL`: URL HTTP do deployment Convex (dominio `.convex.site`).
  - Exemplo: se seu app usa `https://xxx.convex.cloud`, a URL HTTP action e `https://xxx.convex.site`.
- `N8N_INTEGRATION_SECRET`: mesmo valor configurado no Convex em `N8N_INTEGRATION_SECRET`.
- `AI_MODE`: `mock` (default recomendado) ou `live`.
- `OPENAI_API_KEY`: obrigatoria apenas para `AI_MODE=live`.
- `OPENAI_MODEL` (opcional): default do workflow e `gpt-4.1-mini`.

### 3) Environment variable no Convex (obrigatoria para `wa-03`)

Configure no deployment Convex:

- `N8N_INTEGRATION_SECRET`

Sem essa env var, os endpoints de integracao retornam `503` (fail-closed):

- `POST /integrations/n8n/whatsapp/inbound`
- `POST /integrations/n8n/whatsapp/outbound`

## Import e configuracao

1. No n8n, abra `Workflows` -> `Import from file`.
2. Importe `wa-04-ai-mock-or-live.json` (recomendado) ou `wa-03-real-e2e.json` (somente live).
3. No node `WhatsApp Trigger`, selecione a credencial `WhatsApp OAuth API`.
4. No node `WhatsApp Business Cloud`, selecione a credencial `WhatsApp API`.
5. Salve o workflow e clique em `Activate`.
6. Copie a `Production URL` do node `WhatsApp Trigger`.
7. No app Meta, configure essa URL como webhook do produto WhatsApp (campo `messages`).

## Como o `wa-03` funciona

1. Recebe evento `messages` do WhatsApp Trigger.
2. Normaliza payload (phone number id, wa_id, message id, body, anexos).
3. Chama Convex inbound:
   - resolve tenant por `wabaTenantMappings.phoneNumberId`;
   - persiste em `conversations/messages/attachments`;
   - retorna `conversationId`.
4. Chama OpenAI para gerar resposta curta em pt-BR.
5. Envia resposta no WhatsApp.
6. Chama Convex outbound para persistir a resposta da IA no mesmo `conversationId`.

## Como o `wa-04` funciona (mock ou live)

1. Recebe e normaliza inbound igual ao `wa-03`.
2. Persiste inbound no Convex.
3. Decide modo de IA:
   - `AI_MODE=live` + `OPENAI_API_KEY` valida -> chama OpenAI.
   - caso contrario -> responde com mock deterministico.
4. Envia resposta no WhatsApp.
5. Persiste outbound no Convex no mesmo `conversationId`.

Contrato de saida do passo de IA:
- Mantem shape compativel com OpenAI (`choices[0].message.content`) em ambos os modos.
- Permite trocar `mock` -> `live` sem refatorar os nodes seguintes.

## Smoke test recomendado

1. Dispare uma mensagem de texto do numero de teste para o sender configurado.
2. No n8n, confirme execucao completa do workflow `wa-03`.
3. Verifique:
   - mensagem inbound apareceu na inbox/thread da UI;
   - resposta da IA chegou no WhatsApp;
   - resposta outbound tambem apareceu no mesmo thread na UI.

## Observacoes

- O app WhatsApp aceita apenas **um webhook ativo por app**.
- Para disparo fora da janela de 24h, use template (`wa-01`) para iniciar conversa.
- Se quiser manter um fallback simples, mantenha `wa-02` desativado e use apenas para debug manual.

## Troca rapida entre `mock` e `live`

1. `mock` (recomendado para desenvolvimento):
   - `AI_MODE=mock`
   - `OPENAI_API_KEY` opcional
2. `live`:
   - `AI_MODE=live`
   - `OPENAI_API_KEY` obrigatoria
   - opcional `OPENAI_MODEL`
