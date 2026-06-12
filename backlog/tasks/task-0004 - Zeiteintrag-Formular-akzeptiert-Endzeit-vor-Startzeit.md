---
id: TASK-0004
title: Zeiteintrag-Formular akzeptiert Endzeit vor Startzeit
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:14'
updated_date: '2026-06-12 17:41'
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
- [x] #1 Submit mit Endzeit <= Startzeit wird verhindert und zeigt eine deutsche Inline-Fehlermeldung (z.B. "Endzeit muss nach der Startzeit liegen")
- [x] #2 Der Fehler verschwindet reaktiv, sobald die Zeiten gültig sind
- [x] #3 Unit-Test: ungültige Zeitkombination erzeugt keinen Eintrag im Store
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Submit-Validierung Endzeit>Startzeit mit deutscher Inline-Meldung 2) reaktives Zurücksetzen 3) Unit-Test
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Zeiteintrag-Formular validiert jetzt Endzeit > Startzeit: Submit wird bei Endzeit <= Startzeit blockiert, eine deutsche Inline-Meldung ('Endzeit muss nach der Startzeit liegen') erscheint unter dem Bis-Feld und verschwindet reaktiv via computed-Signal, sobald die Zeiten gültig sind. Validierungslogik als pure Funktion in time-validation.ts ausgelagert. 13 Unit-Tests grün (Edge-Cases inkl. Mitternacht, gleiche Zeiten, Submit-Guard erzeugt keinen Store-Eintrag).
<!-- SECTION:FINAL_SUMMARY:END -->
