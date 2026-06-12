---
id: TASK-0001
title: Project scaffolding and first milestone
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:05'
updated_date: '2026-06-12 17:40'
labels:
  - setup
dependencies: []
priority: high
ordinal: 1000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backlog.md initialized and committed
- [x] #2 Team/agents know the workflow
- [x] #3 Testing baseline in place (Vitest unit tests + deterministic Playwright E2E)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Playwright in frontend/ einrichten (webServer, Mock-Backend via page.route, deterministisch) 2) Smoke-E2E: App lädt, Eintrag anlegen 3) AC1/2 verifizieren (Backlog committed, CLAUDE.md-Workflow)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Playwright-Baseline ergänzt: frontend/playwright.config.ts (webServer ng serve, Chromium), e2e/fixtures.ts mockt alle Backend-Routen via page.route + räumt tb:-localStorage, e2e/smoke.spec.ts grün. Backend-Vitest kam via TASK-0009 dazu.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Testing-Baseline vervollständigt: Playwright-E2E-Setup im Frontend (deterministisch: Backend-Mocks via page.route, localStorage-Reset, Role-Selektoren, keine Sleeps) mit grünem Smoke-Test; Vitest-Unit-Suite existierte bereits. Backlog war initialisiert und committed, Workflow ist in CLAUDE.md dokumentiert.
<!-- SECTION:FINAL_SUMMARY:END -->
