---
id: doc-0005
title: 'Architecture: Quality & Risks'
type: specification
created_date: '2026-06-12 17:04'
updated_date: '2026-06-12 18:02'
tags:
  - arc42
---
# Quality & Risks (arc42 §10, §11)

> Maintained by woshy_plan_and_do on architecturally significant changes.
> What belongs here: concrete quality scenarios, known risks, and technical debt.

## Quality Scenarios

| ID | Quality goal | Scenario | Target |
|----|-------------|---------|--------|
| QS-1 | Security | Attacker replays a stale OAuth `state` param | Callback rejects (state bound to session ID, expires) |
| QS-2 | Security | Brute-force against /auth/* | Blocked after 10 req/15 min by rate limiter |
| QS-3 | Reliability | Server receives SIGTERM during active request | Graceful shutdown: in-flight requests complete, PGlite closes cleanly |
| QS-4 | Testability | E2E test suite run on CI without live Google credentials | All tests pass via mocked `page.route()` fixtures |
| QS-5 | Maintainability | Developer changes an auth flow | Backend unit tests (Vitest/Supertest) catch regressions without a running browser |

## Known Risks & Trade-offs

### R-1 — OAuth-State In-Memory Store (accepted, local deployment only)

OAuth `state` tokens are held in a process-level `Map`. This means:
- State is **lost on server restart** (user sees an auth error and must retry — acceptable for a local tool).
- The store does **not scale to multiple backend instances**.

Mitigation path: replace the Map with Redis or a DB-backed store before any
multi-instance or long-lived deployment (see ADR decision-0002).

### R-2 — Session-file-store on local filesystem

Sessions are stored in `backend/sessions/` as plain files. Acceptable for
single-user local operation; would require a production session store (Redis,
DB) for multi-user deployment.

### R-3 — Frontend test coverage baseline still thin

E2E fixture layer is in place; unit coverage of complex store interactions
(CalendarStore, TimeEntryStore) is not yet complete. Risk: regressions in
import/dismiss flows may go undetected. Mitigation: extend Vitest coverage as
part of normal feature development.

## Technical Debt

Known pre-production issues are tracked in `FixBeforeProduction.md` (repo root)
and a refactoring plan is documented in user memory (`refactoring-plan.md`).
Both should migrate into backlog tasks and be prioritised before any wider
rollout.
