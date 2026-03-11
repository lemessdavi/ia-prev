# Plano de Implementacao - MVP Multi-tenant (IA Prev)

Date: 2026-03-10  
Status: Proposed (aligned with approved design)

## 1. Objetivo

Entregar um MVP multi-tenant sem alterar o comportamento funcional atual da advocacia:
- Um painel superadmin para cadastro e gestao de clientes.
- Usuarios com login simples, cada usuario pertencendo a um unico cliente.
- Conta WhatsApp Business (WABA) configurada por cliente.
- Um perfil de IA ativo por cliente no MVP.
- Isolamento total de dados entre clientes.

## 2. Entradas e Decisoes Ja Aprovadas

- Requisitos funcionais base: Documento "Levantamento de Requisitos - IA Prev" (v0.2).
- Decisao arquitetural: abordagem 1 (multi-tenant logico) agora, com evolucao planejada para abordagem 3 (roteamento por fluxo/tipo de demanda) no futuro.
- Design registrado em: `docs/plans/2026-03-10-multi-tenant-design.md`.

## 3. Estado Atual e PRs Abertos

PRs em aberto considerados neste plano:
- PR #1: `feat(backend): add chat backend package with schema, queries/mutations and tests`
- PR #2: `feat(ui): add shared tokens/mocks and prototype-based web+mobile chat UI`

Comentarios de alinhamento multi-tenant ja publicados:
- PR #1: https://github.com/lemessdavi/ia-prev/pull/1#issuecomment-4034795741
- PR #2: https://github.com/lemessdavi/ia-prev/pull/2#issuecomment-4034796239

## 4. Decisao de Merge dos PRs

1. PR #1 (backend): NAO mergear como base de producao sem ajustes de tenant.
Itens bloqueantes: tenantId nas entidades/sessao, filtros tenant-aware em queries/mutations, indices por tenant, testes de isolamento entre clientes.

2. PR #2 (UI): pode ser mergeado como base visual, com ajustes preventivos.
Recomendado incluir: placeholders de tenant (nome/IA/WABA), remover acoplamento de marca fixa nos mocks compartilhados, separar claramente tela de operacao do tenant_user do futuro painel superadmin.

## 5. Roadmap Tecnico por Fases

## Fase 0 - Preparacao e Higiene (curta)

Entregas:
- Definir convencao unica de nomenclatura tenant (`tenantId`) no dominio.
- Definir contrato minimo de sessao (`userId`, `tenantId`, `role`).
- Confirmar estrategia de secrets por tenant (WABA e IA).

Criterio de saida:
- Checklist tecnico de convencoes aprovado e compartilhado no repo.

## Fase 1 - Fundacao Multi-tenant Backend

Entregas:
- Modelo de dados tenant-aware:
  - `tenants`, `tenant_waba_accounts`, `users`, `ai_profiles`, `conversations`, `messages`, `attachments`, `handoff_events`, `audit_logs`.
- Toda entidade operacional com `tenantId`.
- Camada de acesso com escopo obrigatorio por tenant.
- Testes automatizados de isolamento (A nao le/escreve B).

Dependencias:
- Fase 0 concluida.

Criterio de saida:
- Suite de testes cobrindo leitura/escrita cross-tenant bloqueada.

## Fase 2 - Autenticacao Simples + Sessao

Entregas:
- Login usuario/senha com hash seguro.
- Sessao com `tenantId` resolvido no login.
- Guardas de autorizacao para `superadmin` e `tenant_user`.
- Fluxo de reset de senha operacional para superadmin.

Criterio de saida:
- Usuario tenant nao acessa recursos fora do proprio tenant em nenhum endpoint.

## Fase 3 - Painel Superadmin

Entregas:
- CRUD de clientes (tenant).
- Vinculo de conta WABA por cliente.
- CRUD de usuarios por cliente.
- Configuracao do perfil de IA ativo por cliente.
- Saude basica de integracao (ultimo webhook/erros recentes).

Criterio de saida:
- Onboarding completo de um novo cliente sem operacao manual em banco.

## Fase 4 - Integracao WhatsApp e Roteamento por Tenant

Entregas:
- Webhook de entrada resolve tenant via WABA/phone_number_id.
- Processamento fail-closed para mapeamento inexistente.
- Auditoria de eventos de roteamento e falhas.

Criterio de saida:
- Mensagens de duas contas WABA distintas chegam no tenant correto, sem mistura.

## Fase 5 - Adaptacao Web/Mobile para Contexto de Tenant

Entregas:
- App carrega contexto do tenant autenticado (nome cliente, IA ativa, conta WABA vinculada).
- Lista de conversas/chat/dossie consultando APIs tenant-aware.
- Sem alteracao de comportamento de negocio do fluxo atual (triagem/handoff).

Criterio de saida:
- Experiencia atual da advocacia preservada, mas isolada por tenant.

## Fase 6 - LGPD, Auditoria e Observabilidade Minimas

Entregas:
- Trilha de acesso para visualizacao/download/exportacao.
- Registro de consentimento LGPD por conversa.
- Mecanismos minimos de retencao/exclusao sob solicitacao.

Criterio de saida:
- Evidencia auditavel basica para operacao interna multi-cliente.

## Fase 7 - Go-live Controlado (2 clientes)

Entregas:
- Tenant 1: Lemes Advocacia (2 usuarios).
- Tenant 2: Clinica (1+ usuarios).
- WABA e IA ativa configurados para cada tenant.
- Checklist de smoke test de producao executado.

Criterio de saida:
- Operacao paralela dos 2 clientes sem incidente de isolamento.

## 6. Backlog Priorizado (MVP)

P0 (obrigatorio antes de go-live):
- MT-01: tenantId obrigatorio em dados operacionais.
- MT-02: guards de autorizacao por tenant em todas funcoes.
- MT-03: webhook routing WABA -> tenant fail-closed.
- MT-04: painel superadmin (cliente, usuario, WABA, IA ativa).
- MT-05: testes cross-tenant (query/mutation).

P1 (logo apos base P0):
- MT-06: auditoria de acesso/download/export.
- MT-07: observabilidade de integrações por tenant.
- MT-08: estados de loading/empty/error no front tenant-aware.

P2 (pos-MVP, ponte para abordagem 3):
- MT-09: roteamento por fluxo (auxilio-acidente, aposentadoria, etc).
- MT-10: multiplos perfis de IA por tenant com selecao por fluxo.

## 7. Estrategia de Testes

- Unitarios: validacao de guards, validadores e roteadores.
- Integracao: webhook -> resolucao tenant -> persistencia correta.
- Seguranca funcional: tentativas cross-tenant bloqueadas.
- E2E minimo:
  1) login tenant A, operar conversa A;
  2) login tenant B, operar conversa B;
  3) garantir nao visibilidade cruzada.

## 8. Riscos e Mitigacoes

Risco: query sem filtro de tenant.  
Mitigacao: repositorio unificado com tenantId obrigatorio + testes negativos.

Risco: mapeamento WABA incorreto.  
Mitigacao: validacao de unicidade e monitoramento de erros de webhook.

Risco: retrabalho por acoplamento de mocks/branding.  
Mitigacao: placeholders de tenant e injecao de contexto ja na camada de UI.

## 9. Plano de Execucao Sugerido

Sequencia recomendada:
1. Ajustar PR #1 para tenant-aware (bloqueante) e revisar novamente.
2. Ajustar PR #2 para contexto de tenant (preventivo) e mergear base visual.
3. Implementar Fases 1-4 em branch dedicada de plataforma multi-tenant.
4. Integrar front (Fase 5), completar compliance minima (Fase 6) e executar go-live controlado (Fase 7).

