---
id: TASK-0007
title: 'Export-Panel: Feedback bei Erfolg/Fehler und Datumsbereich behalten'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:15'
updated_date: '2026-06-12 17:54'
labels:
  - ux
  - export
  - frontend
dependencies: []
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Zwei UX-Lücken im Export: (1) ExportService.export() subscribed ohne error-Handler — schlägt die PDF/CSV-Generierung fehl, passiert sichtbar nichts (kein Toast, kein Hinweis); es gibt auch keinen Loading-/Disabled-State, Doppelklick startet zwei Exporte. (2) Ein effect() im Export-Panel setzt fromDate/toDate bei jedem Öffnen auf die aktuelle Woche zurück — wer einen Monatsbereich eingestellt hat und das Panel kurz schließt, verliert ihn.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fehler beim Export erzeugen eine sichtbare deutsche Fehlermeldung (Error-Toast)
- [x] #2 Export-Buttons sind während eines laufenden Exports disabled
- [x] #3 Ein manuell geänderter Datumsbereich überlebt Schließen und Wiederöffnen des Panels innerhalb der Session
- [x] #4 Unit-Test: Export-Port wirft Fehler, ExportService meldet ihn an den Error-Kanal statt ihn zu verschlucken
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) ExportService: error-Handling + busy-State (Signal) 2) Error-Toast bei Fehler, Buttons disabled während Export 3) Datumsbereich überlebt Panel-Reopen (Session-State statt effect-Reset) 4) Unit-Test für Fehlerpfad
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Datumsbereich liegt im UiStore (transienter Session-State, kein localStorage) — überlebt Panel-Reopen, nicht Reload, wie gefordert. Fehlerkanal: CalendarStore.setError, ErrorToast aggregiert die Store-Errors bereits.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Export-Panel-UX geschlossen: ExportService hat jetzt ein busy-Signal (Doppelklick-Schutz, Buttons disabled während laufendem Export) und einen error-Handler — Fehler erzeugen den Toast 'Export fehlgeschlagen' statt still zu verschwinden. Der resettende effect() im Panel wurde ersetzt: Datumsbereich initialisiert aus dem UiStore und wird dorthin zurückgeschrieben, überlebt also Schließen/Wiederöffnen in der Session (Default beim ersten Öffnen bleibt die aktuelle Woche). 5 neue Unit-Tests (Fehlerpfad, busy-Lifecycle, Doppelklick) grün. Hinweis: der ui.store.ts-Commit enthält zusätzlich die SSR-sichere localStorage-Initialisierung aus TASK-0010 (verschränkte Hunks).
<!-- SECTION:FINAL_SUMMARY:END -->
