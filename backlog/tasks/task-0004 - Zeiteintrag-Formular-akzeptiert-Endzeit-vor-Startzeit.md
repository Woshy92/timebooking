---
id: TASK-0004
title: Zeiteintrag-Formular akzeptiert Endzeit vor Startzeit
status: To Do
assignee: []
created_date: '2026-06-12 17:14'
updated_date: '2026-06-12 17:24'
labels:
  - bug
  - frontend
dependencies: []
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
time-entry-form.component.ts validiert beim Submit nicht, dass die Endzeit nach der Startzeit liegt. Von=17:00 / Bis=09:00 erzeugt einen Eintrag mit negativer Dauer, der im Kalender als Null-/Negativ-Block gerendert wird und Summen verfälscht.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Submit mit Endzeit <= Startzeit wird verhindert und zeigt eine deutsche Inline-Fehlermeldung (z.B. "Endzeit muss nach der Startzeit liegen")
- [ ] #2 Der Fehler verschwindet reaktiv, sobald die Zeiten gültig sind
- [ ] #3 Unit-Test: ungültige Zeitkombination erzeugt keinen Eintrag im Store
<!-- AC:END -->
