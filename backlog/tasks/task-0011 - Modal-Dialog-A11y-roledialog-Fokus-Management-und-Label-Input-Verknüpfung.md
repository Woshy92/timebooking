---
id: TASK-0011
title: 'Modal-Dialog A11y: role=dialog, Fokus-Management und Label-Input-Verknüpfung'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 18:04'
updated_date: '2026-06-12 18:46'
labels:
  - a11y
  - ux
  - frontend
dependencies: []
priority: low
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Beim Umsetzen von TASK-0006/TASK-0008 festgestellt: die Modal-Komponente (shared/components/modal) hat kein role=dialog/aria-modal und kein Fokus-Trapping, und im Zeiteintrag-Formular sind Labels nicht mit den Inputs verknüpft (kein for/id) — E2E-Tests mussten deshalb auf strukturelle/Placeholder-Selektoren ausweichen statt getByRole('dialog')/getByLabel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Modal hat role=dialog, aria-modal=true und ein aria-labelledby auf den Titel
- [x] #2 Fokus springt beim Öffnen ins Modal und kehrt beim Schließen zum Auslöser zurück; Escape schließt (falls nicht schon vorhanden)
- [x] #3 Formular-Labels sind via for/id mit ihren Inputs verknüpft; bestehende E2E-Selektoren werden auf getByRole('dialog')/getByLabel umgestellt
- [x] #4 Unit-/E2E-Abdeckung für Fokus-Verhalten
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Modal-Komponente: role=dialog, aria-modal, aria-labelledby, Fokus-Trap + Fokus-Rückgabe, Escape 2) Formular: for/id-Verknüpfung 3) E2E-Selektoren auf getByRole('dialog')/getByLabel umstellen 4) Unit-Tests Fokus-Verhalten
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Modal-Komponente um role=dialog, aria-modal, aria-labelledby (instanz-eindeutige Titel-ID) und tabindex=-1 ergänzt; Fokus springt beim Öffnen ins Modal (erstes fokussierbares Element), kehrt beim Schließen zum Auslöser zurück; Escape schließt (neu, mit stopPropagation gegen die document-level Handler der Views); Tab/Shift+Tab-Fokus-Trap. Labels in time-entry-form und project-form via for/id verknüpft (instanz-eindeutiges Präfix). E2E-Selektoren in undo-delete.spec.ts und keyboard-a11y.spec.ts auf getByRole('dialog')/getByLabel umgestellt. Tests: 7 neue Modal-Unit-Tests (Fokus rein/zurück, Escape, Tab-Wrap), volle Suite 131 grün, Playwright 3/3 grün.
<!-- SECTION:FINAL_SUMMARY:END -->
