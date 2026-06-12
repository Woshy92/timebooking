---
id: TASK-0006
title: 'Destruktive Aktionen absichern: Undo und Vorwarnung überall'
status: To Do
assignee: []
created_date: '2026-06-12 17:15'
updated_date: '2026-06-12 17:24'
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
- [ ] #1 Löschen im Eintrags-Modal pusht den Eintrag in den UndoStore — der Undo-Toast erscheint und Rückgängig stellt den Eintrag wieder her
- [ ] #2 Der Urlaubs-Dialog zeigt vor dem Bestätigen die Anzahl der zu löschenden Einträge an (z.B. "3 Einträge werden gelöscht")
- [ ] #3 Entschieden und umgesetzt: Sync stellt ausgeblendete Events entweder nicht mehr wieder her, oder der Nutzer wird darauf hingewiesen
- [ ] #4 E2E-Test (Playwright): Eintrag im Modal löschen, Undo klicken, Eintrag ist wieder da
<!-- AC:END -->
