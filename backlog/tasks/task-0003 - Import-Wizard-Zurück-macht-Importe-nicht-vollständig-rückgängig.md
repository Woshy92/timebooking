---
id: TASK-0003
title: 'Import-Wizard: Zurück macht Importe nicht vollständig rückgängig'
status: To Do
assignee: []
created_date: '2026-06-12 17:14'
updated_date: '2026-06-12 17:24'
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
- [ ] #1 Zurück nach einem Serien-Import entfernt ALLE in diesem Schritt importierten Einträge aus dem TimeEntryStore
- [ ] #2 Die Serien-Events sind nach Zurück wieder im Wizard entscheidbar (zurück in eventsToProcess)
- [ ] #3 Zurück nach einem Import hinterlässt keinen Eintrag in dismissedGoogleEventIds — das Event ist danach in der Kalenderansicht wieder als Google-Event sichtbar
- [ ] #4 Der Dismiss-Button im Wizard heißt nicht mehr "Löschen", sondern z.B. "Überspringen" oder "Ausblenden"
- [ ] #5 Unit-Tests für goBack decken die drei Fälle ab: Einzel-Import, Serien-Import, Dismiss
<!-- AC:END -->
