---
id: TASK-0006
title: 'Destruktive Aktionen absichern: Undo und Vorwarnung überall'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:15'
updated_date: '2026-06-12 17:53'
labels:
  - ux
  - frontend
dependencies: []
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Drei Stellen zerstören Daten ohne Schutz, obwohl ein Undo-System (UndoStore + UndoToast) existiert: (1) Der Löschen-Button im Eintrags-Modal (time-entry-modal.component.ts) ruft removeEntry direkt auf — kein pushDelete, kein Undo-Toast, im Gegensatz zum Inline-Delete auf dem Kalenderblock. (2) Der Urlaubs-Dialog (week-view, applyVacationRange) löscht alle Einträge im Zeitraum, ohne vorher zu sagen wie viele betroffen sind — bei mehrwöchigen Bereichen sieht der Nutzer die Einträge nicht einmal. (3) Der Sync-Button (app.ts, refreshCalendar) ruft clearDismissedGoogleEventIds() auf — alle bewusst ausgeblendeten Events tauchen kommentarlos wieder auf.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Löschen im Eintrags-Modal pusht den Eintrag in den UndoStore — der Undo-Toast erscheint und Rückgängig stellt den Eintrag wieder her
- [x] #2 Der Urlaubs-Dialog zeigt vor dem Bestätigen die Anzahl der zu löschenden Einträge an (z.B. "3 Einträge werden gelöscht")
- [x] #3 Entschieden und umgesetzt: Sync stellt ausgeblendete Events entweder nicht mehr wieder her, oder der Nutzer wird darauf hingewiesen
- [x] #4 E2E-Test (Playwright): Eintrag im Modal löschen, Undo klicken, Eintrag ist wieder da
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Modal-Delete über UndoStore (pushDelete + Toast) wie Inline-Delete 2) Urlaubs-Dialog zeigt Anzahl betroffener Einträge vor Bestätigung 3) Sync: clearDismissedGoogleEventIds nicht mehr automatisch (Entscheidung dokumentieren) 4) Playwright-E2E: Modal-Delete + Undo
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#3 als Option A umgesetzt: Sync stellt ausgeblendete Events nicht mehr wieder her (clearDismissedGoogleEventIds aus refreshCalendar entfernt). Sicher, weil der Import-Wizard Dismissed weiterhin zurückholen kann (Bulk-Clear beim Öffnen ohne Events + undismissGoogleEvent einzeln). Follow-up-Kandidat: Modal/Formular haben kein role=dialog und keine Label-Input-Verknüpfung (E2E musste strukturelle Selektoren nutzen) — Teil von TASK-0008.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Alle drei ungeschützten destruktiven Stellen abgesichert: (1) Löschen im Eintrags-Modal pusht jetzt via UndoStore.pushDelete in den Undo-Toast (gleiches Muster wie Inline-Delete). (2) Der Urlaubs-Dialog zeigt reaktiv die Anzahl der zu löschenden Einträge ('N Einträge werden gelöscht') vor dem Bestätigen. (3) Sync stellt bewusst ausgeblendete Google-Events nicht mehr kommentarlos wieder her; Wiederherstellung bleibt über den Import-Wizard möglich. Tests: Playwright-E2E (Modal-Delete → Undo → Eintrag wieder da, deterministisch mit In-Memory-Backend-Mock) + 6 Unit-Tests (Urlaubs-Zählung, Modal-Delete-Logik) grün.
<!-- SECTION:FINAL_SUMMARY:END -->
