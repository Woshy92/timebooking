---
id: TASK-0011
title: 'Modal-Dialog A11y: role=dialog, Fokus-Management und Label-Input-Verknüpfung'
status: To Do
assignee: []
created_date: '2026-06-12 18:04'
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
- [ ] #1 Modal hat role=dialog, aria-modal=true und ein aria-labelledby auf den Titel
- [ ] #2 Fokus springt beim Öffnen ins Modal und kehrt beim Schließen zum Auslöser zurück; Escape schließt (falls nicht schon vorhanden)
- [ ] #3 Formular-Labels sind via for/id mit ihren Inputs verknüpft; bestehende E2E-Selektoren werden auf getByRole('dialog')/getByLabel umgestellt
- [ ] #4 Unit-/E2E-Abdeckung für Fokus-Verhalten
<!-- AC:END -->
