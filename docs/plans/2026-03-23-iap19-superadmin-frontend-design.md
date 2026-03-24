# IAP-19 Superadmin Frontend Design

Date: 2026-03-23
Status: Approved

## 1. Objective

Deliver web frontend phase 3 for superadmin, integrated with the existing auth/session multi-tenant backend contracts, without breaking merged backend behavior.

## 2. Decisions

- `/` becomes login page.
- Legacy mock chat UI moves from `/` to `/mock/legacy-chat`.
- Successful login redirects:
  - `superadmin` -> `/superadmin`
  - `tenant_user` -> `/superadmin` (forbidden state with CTA to `/app`)
- `/superadmin` remains protected:
  - no session -> redirect to `/`
  - non-superadmin -> explicit 403 UI
- Session persistence uses secure HTTP-only cookie.

## 3. Architecture

### 3.1 Frontend routes

- `/`: login page (username/password)
- `/superadmin`: admin panel (protected + role-aware)
- `/mock/legacy-chat`: old prototype screen (kept for reference)
- `/app`: placeholder route for blocked tenant users

### 3.2 Convex integration in web/mobile

Web and mobile consume backend capabilities only through Convex:

- typed API contract from `@repo/convex-backend`
- runtime client hooks from `convex/react`
- auth and superadmin operations implemented in Convex queries/mutations/actions

No runtime path should call `packages/backend` directly from BFF or route handlers.

### 3.3 Session model

- Cookie stores serialized authenticated session payload: `sessionId`, `userId`, `tenantId`, `role`, `createdAt`.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- All protected operations validate persisted session via Convex auth/session guards.

## 4. Superadmin UI Scope

Single page with four functional modules:

- Tenants: list, create, edit, activate/deactivate
- Users: list by tenant, create, activate/deactivate, reset password
- WABA: link/update `phone_number_id` and `waba_account_id`
- AI Profiles: list by tenant and set exactly one active profile

Each module must render explicit: loading, empty, error, forbidden states.

## 5. Error Handling

- Map Convex errors to UI states (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_REQUEST`, `NOT_FOUND`).
- UI surfaces readable validation errors.
- Forbidden access always shows clear 403 state and CTA `/app`.

## 6. Test Plan (TDD)

Critical behavior-first tests:

1. Post-login redirect by role
2. `/superadmin` protection rules
3. Invalid login returns error and does not authenticate

Additional tests for new Convex admin operations and invariants (including exactly one active AI profile per tenant).

## 7. Non-goals

- No backend replatforming or external persistent database in this card.
- No reintroduction of direct `packages/backend` runtime dependencies.
- No new tenant-user operation screens beyond placeholder `/app`.
- No removal of legacy mock (only route move).
