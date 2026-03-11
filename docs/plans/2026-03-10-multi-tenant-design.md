# Multi-tenant MVP Design - IA Prev

Date: 2026-03-10  
Status: Approved

## 1. Context and Objective

The current scope for Lemes Advocacia Previdenciaria remains unchanged. We will add a tenant layer so the same platform can serve multiple clients in parallel, each with its own WhatsApp Business account, users, and AI configuration.

MVP target:
- Support at least 2 clients concurrently (e.g., Advocacia + Clinica Odontologica).
- Keep the current triage + handoff flow intact.
- Ensure strict data isolation between clients.

## 2. Final Decision

### Chosen approach for MVP: Approach 1 (Logical multi-tenant)

We will implement logical multi-tenancy with `tenant_id` across all operational data, plus a central superadmin panel.

Why this approach:
- Fastest path to production for MVP.
- Preserves current flow with minimal behavior change.
- Supports future expansion without expensive replatforming.

### Explicit future direction: Approach 3 (Tenant + flow engine)

After MVP stabilization, we will evolve to per-tenant routing by demand type/flow (e.g., `auxilio_acidente`, `aposentadoria_antecipada`, etc.), allowing multiple AI routes/models per tenant.

## 3. Scope Boundaries

### In scope (MVP)
- Tenant registration and management in a superadmin panel.
- Tenant users with simple login (username/password), one tenant per user.
- Per-tenant WhatsApp Business account mapping.
- Per-tenant active AI profile (exactly one active profile in MVP).
- End-to-end tenant isolation in web/mobile/API and data storage.

### Out of scope (MVP)
- Multiple internal roles per tenant (all tenant users have same access level).
- Multi-flow AI routing per tenant.
- Advanced IAM/SSO.
- Full document AI analysis.

## 4. Functional Design

## 4.1 Access model

System roles:
- `superadmin`: full visibility and configuration across all tenants.
- `tenant_user`: access restricted to one tenant.

Rules:
- Every `tenant_user` belongs to exactly one tenant.
- No cross-tenant visibility for tenant users.

## 4.2 Core entities

Minimum entity set:
- `tenants`
- `tenant_waba_accounts`
- `users`
- `ai_profiles`
- `conversations`
- `messages`
- `attachments`
- `handoff_events`
- `audit_logs`

Tenant isolation rule:
- Every operational entity carries `tenant_id` and is always queried/updated with tenant-scoped predicates.

## 4.3 WhatsApp routing

Inbound webhook processing sequence:
1. Read incoming WABA identifier (`phone_number_id` / account reference).
2. Resolve mapped tenant in `tenant_waba_accounts`.
3. If mapping exists, process event under resolved `tenant_id`.
4. If mapping fails, stop processing and move event to error queue/log for manual review.

This is mandatory to prevent cross-tenant leakage.

## 4.4 AI configuration in MVP

- Each tenant has one active AI profile (`ai_profiles.is_active = true`).
- AI profile stores provider/model/prompt/config references.
- Runtime always resolves active profile by tenant.

Future-ready note:
- Data model should allow adding `flow_key` and routing tables later without breaking tenant boundaries.

## 4.5 Superadmin panel capabilities

Required screens/actions:
- Create/edit/disable tenant.
- Register tenant WABA account mapping.
- Create/disable tenant user and reset password.
- Configure active AI profile per tenant.
- Basic integration observability (last webhook received, recent errors).

## 5. Non-functional and compliance considerations

- LGPD: retain consent evidence and minimize data collection by flow.
- Security: password hashing, session expiration, secure credential storage.
- Auditability: track sensitive reads/exports/ownership changes.
- Reliability: webhook idempotency and retry-safe processing.

## 6. Migration strategy from current scope

1. Create initial tenant: `Lemes Advocacia Previdenciaria`.
2. Attach current operational users to this tenant.
3. Map current WABA integration to this tenant.
4. Keep existing user-facing flow behavior unchanged (triage -> handoff -> case dossier).

## 7. Risks and mitigations

Risk: missing tenant filters in queries.  
Mitigation: repository/service layer must enforce tenant predicate + automated tests.

Risk: wrong WABA-to-tenant mapping.  
Mitigation: strict validation, fail-closed behavior, explicit error queue.

Risk: credential exposure across tenants.  
Mitigation: per-tenant secret references and restricted access paths.

## 8. Acceptance criteria for this design

- It must be possible to onboard two clients with distinct WABA accounts.
- Users from client A cannot access any data from client B.
- Superadmin can manage tenants, users, WABA mapping, and active AI profile.
- Current advocacia scope remains behaviorally unchanged.
- Architecture leaves a clear path to future Approach 3 (multi-flow routing per tenant).
