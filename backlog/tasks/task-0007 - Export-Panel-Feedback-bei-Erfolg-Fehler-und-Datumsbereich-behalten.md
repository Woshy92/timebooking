---
id: TASK-0007
title: 'Export-Panel: Feedback bei Erfolg/Fehler und Datumsbereich behalten'
status: To Do
assignee: []
created_date: '2026-06-12 17:15'
updated_date: '2026-06-12 17:24'
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
- [ ] #1 Fehler beim Export erzeugen eine sichtbare deutsche Fehlermeldung (Error-Toast)
- [ ] #2 Export-Buttons sind während eines laufenden Exports disabled
- [ ] #3 Ein manuell geänderter Datumsbereich überlebt Schließen und Wiederöffnen des Panels innerhalb der Session
- [ ] #4 Unit-Test: Export-Port wirft Fehler, ExportService meldet ihn an den Error-Kanal statt ihn zu verschlucken
<!-- AC:END -->
