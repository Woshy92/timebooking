---
id: decision-0001
title: 'Testing baseline: unit coverage + deterministic Playwright E2E'
date: '2026-06-12 17:05'
status: accepted
---
## Context

Timebooking had no automated test infrastructure. The CLAUDE.md quality rule
requires new or changed behaviour to ship with tests and E2E coverage for
user-visible flows to be deterministic (no fixed sleeps, no live external
services, no fragile CSS selectors).

## Decision

Establish a two-layer testing baseline:

**Frontend unit/integration:** Vitest (`frontend/vitest.config.ts`). Acceptance
criteria from tickets are the primary test plan driver.

**Frontend E2E (Playwright):** `frontend/playwright.config.ts` with fixtures in
`e2e/fixtures.ts`. Backend is mocked entirely via `page.route()` — no live
Google OAuth or Calendar calls. localStorage is reset between runs. `webServer`
spins up `ng serve`; tests use Playwright auto-waiting and polling `expect`.
Selectors use ARIA roles or `data-testid`, not CSS chains.

**Backend unit/integration:** Vitest + Supertest (`backend/vitest.config.ts`).
`src/test/setup.ts` sets the test environment and swaps `session-file-store` for
an in-memory store so tests are stateless and filesystem-free.

## Consequences

- CI can run the full test suite without Google credentials or a running browser
  connected to live services.
- A flaky suite is avoided by design: deterministic mocking means green = green.
- Backend tests run independently of the filesystem session store, making them
  portable across environments.
- Coverage of complex store interactions (CalendarStore, TimeEntryStore) is still
  thin — extending it is tracked as risk R-3 in doc-0005.

