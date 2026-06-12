---
id: TASK-0014
title: 'E2E: Stateful-Backend-Helper nach fixtures.ts deduplizieren'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 18:27'
updated_date: '2026-06-12 18:56'
labels:
  - refactoring
  - testing
dependencies: []
priority: low
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code-Review-Finding: installStatefulBackend, midWeekDateStr, StoredEntry und PROJECT sind ~130 Zeilen nahezu zeichengleich zwischen frontend/e2e/keyboard-a11y.spec.ts und frontend/e2e/undo-delete.spec.ts dupliziert. fixtures.ts existiert bereits als gemeinsames Modul und ist der richtige Ort.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 installStatefulBackend, midWeekDateStr, StoredEntry und PROJECT existieren genau einmal in frontend/e2e/fixtures.ts; beide Specs importieren sie
- [x] #2 Beide E2E-Specs laufen unverändert grün
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) installStatefulBackend, midWeekDateStr, StoredEntry, PROJECT nach fixtures.ts heben 2) Beide Specs importieren 3) E2E grün
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
StoredEntry, PROJECT, installStatefulBackend und midWeekDateStr einmalig nach frontend/e2e/fixtures.ts gehoben; beide Specs importieren sie, ENTRY_TITLE bleibt pro Spec lokal. Einzige Differenz zwischen den Kopien waren Kommentare. Playwright 3/3 grün.
<!-- SECTION:FINAL_SUMMARY:END -->
