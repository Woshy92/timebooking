---
id: TASK-0003
title: 'Import-Wizard: Zurück macht Importe nicht vollständig rückgängig'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:14'
updated_date: '2026-06-12 17:41'
labels:
  - bug
  - wizard
  - frontend
dependencies: []
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Zwei zusammenhängende Bugs in import-wizard.component.ts: (1) Bei Serien-Import (applyToSeries=true) werden alle künftigen Vorkommen importiert, aber goBack() entfernt nur den Eintrag des aktuellen Events — die restlichen Serien-Einträge bleiben im Store und die Events sind im Wizard nicht mehr entscheidbar. (2) removeEntry() fügt beim Löschen eines Google-Eintrags dessen googleEventId automatisch zur Dismissed-Liste hinzu; goBack() nach einem Import ruft kein undismiss auf, wodurch das Event nach Wizard-Ende im Kalender versteckt bleibt und die Dismissed-Liste mit jedem Zurück wächst. Zusätzlich UX: der Button "Löschen" im Wizard blendet nur aus (dismiss), löscht aber nichts — irreführendes Label.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Zurück nach einem Serien-Import entfernt ALLE in diesem Schritt importierten Einträge aus dem TimeEntryStore
- [x] #2 Die Serien-Events sind nach Zurück wieder im Wizard entscheidbar (zurück in eventsToProcess)
- [x] #3 Zurück nach einem Import hinterlässt keinen Eintrag in dismissedGoogleEventIds — das Event ist danach in der Kalenderansicht wieder als Google-Event sichtbar
- [x] #4 Der Dismiss-Button im Wizard heißt nicht mehr "Löschen", sondern z.B. "Überspringen" oder "Ausblenden"
- [x] #5 Unit-Tests für goBack decken die drei Fälle ab: Einzel-Import, Serien-Import, Dismiss
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) goBack: Serien-Einträge vollständig entfernen + Events zurück in eventsToProcess 2) undismiss bei Zurück nach Import 3) Button-Label 'Überspringen' 4) Unit-Tests Einzel/Serie/Dismiss
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
History-Mechanismus: pro Wizard-Schritt wird eine HistoryAction gepusht (importedEntryIds inkl. Serien-Einträge, importedGoogleEventIds fürs Undismiss, removedSeriesEvents mit Original-Indizes für Reinsert, createdRecurringMappingId). goBack() reverted genau einen Schritt. TimeEntryStore.undismissGoogleEvent existierte bereits.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Import-Wizard: goBack() macht Importe jetzt vollständig rückgängig. Serien-Importe werden komplett entfernt (alle in dem Schritt erzeugten Einträge) und die Serien-Events an ihren Original-Indizes zurück in eventsToProcess gelegt; nach jedem Zurück wird undismissGoogleEvent aufgerufen, sodass die Dismissed-Liste nicht mehr wächst und Events im Kalender wieder sichtbar sind. Dismiss-Button heißt jetzt 'Überspringen'. 3 neue Unit-Tests (Einzel-Import, Serien-Import, Dismiss) grün.
<!-- SECTION:FINAL_SUMMARY:END -->
