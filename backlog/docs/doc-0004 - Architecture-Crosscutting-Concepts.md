---
id: doc-0004
title: 'Architecture: Crosscutting Concepts'
type: specification
created_date: '2026-06-12 17:04'
updated_date: '2026-06-12 18:02'
tags:
  - arc42
---
# Crosscutting Concepts (arc42 §8)

> Maintained by woshy_plan_and_do on architecturally significant changes.
> What belongs here: patterns that span the system — auth, persistence,
> error handling, i18n, state management conventions.

## Authentication & Session

Session-based auth via Express-Session with session-file-store (httpOnly cookie,
tokens never reach the frontend; sessions survive server restarts).

**CSRF protection:** After login and logout the server rotates the XSRF token
(double-submit cookie pattern, shared middleware in
`backend/src/middleware/csrf.middleware.ts`). This closes CSRF on state-changing
endpoints without requiring per-request round-trips.

**OAuth Login-CSRF prevention:** The OAuth `state` parameter is bound to the
session ID at generation time and verified on callback (see ADR
decision-0002). All OAuth error paths redirect to the frontend with
`?auth_error=<code>` instead of rendering JSON server-side.

**Rate limiting:** `express-rate-limit` is applied on all routes:
- `/auth/*`: 10 requests / 15 min (hardened against brute-force)
- `/api/*`: 300 requests / 15 min (env-overridable via `RATE_LIMIT_AUTH_MAX` /
  `RATE_LIMIT_API_MAX`)

**Logout:** Express session is destroyed and the session cookie is explicitly
cleared via `res.clearCookie()` to prevent zombie sessions.

**Graceful shutdown:** The server listens for SIGTERM/SIGINT and tears down in
order — HTTP server close first, then PGlite — to avoid data corruption.
`EADDRINUSE` on startup is caught and reported cleanly.

## Persistence

Frontend: StoragePort (InjectionToken + Interface in `domain/ports/`); adapters
LocalStorage and IndexedDB implement it. Adapter binding exclusively in
`app.config.ts`.

Backend: PGlite (embedded Postgres) for structured data; session-file-store for
session persistence in `backend/sessions/`.

## State Management

NgRx Signal Store in `state/` — no BehaviorSubject, no classic Actions/Reducers.
UiStore holds transient UI state (activeView, activeDate, modals); not persisted,
not in the URL.

## Error Handling

OAuth errors are surfaced to the frontend as redirect query params
(`?auth_error=<code>`) rather than API JSON responses, so the SPA can handle
them uniformly in its routing layer.

## Internationalisation

UI language: German (labels, buttons, messages). Code language: English
(variables, functions, interfaces, comments).

## Testing

### Frontend — Unit & Integration

Vitest via `frontend/vitest.config.ts`. Acceptance criteria from tickets drive
the test plan. New or changed behaviour ships with tests.

### Frontend — End-to-End (Playwright)

Config: `frontend/playwright.config.ts`; fixtures: `e2e/fixtures.ts`.

**Determinism rules:**
- Backend is mocked via Playwright's `page.route()` (no live Google OAuth / Calendar calls).
- localStorage is reset between test runs.
- `webServer` launches `ng serve` inside the test run; tests use Playwright's
  auto-waiting and polling `expect` — no fixed sleeps.
- Selectors use ARIA roles or `data-testid` attributes, not fragile CSS chains.

### Backend — Unit & Integration

Vitest + Supertest; config: `backend/vitest.config.ts`.

`src/test/setup.ts` sets the test environment and substitutes an in-memory
session store for `session-file-store` so tests are stateless and portable
without touching the filesystem.
