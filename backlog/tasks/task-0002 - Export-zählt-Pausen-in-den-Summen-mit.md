---
id: TASK-0002
title: Export zählt Pausen in den Summen mit
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:14'
updated_date: '2026-06-12 17:41'
labels:
  - bug
  - export
  - frontend
dependencies: []
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Die App-Ansicht (Tages-/Wochensumme) filtert Pause-Einträge heraus, der Export (ExportService.export, frontend/src/app/application/export.service.ts) aber nicht. PDF/CSV zeigen dadurch höhere Summen als die App — für einen Berater-Stundenzettel ein echter Korrektheitsfehler. Betroffen: Detailtabelle, 'Gesamt'-Footer und die Zusammenfassungsseite (Pausen landen dort unter 'Ohne Projekt').
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PDF- und CSV-Gesamtsumme schließen Einträge mit pause=true aus und stimmen mit der in der App angezeigten Summe für denselben Zeitraum überein
- [x] #2 Die Zusammenfassungsseite (Projekt × Tag) zählt Pausen nicht unter 'Ohne Projekt'
- [x] #3 Entschieden und dokumentiert: Pausen-Zeilen erscheinen entweder klar als 'Pause' markiert in der Detailtabelle oder gar nicht (beides ok, aber bewusst)
- [x] #4 Unit-Test: Export mit 6h Arbeit + 1h Pause ergibt Summe 6:00, nicht 7:00
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) ExportService/Adapter: pause=true aus Summen+Detail+Zusammenfassung filtern 2) Entscheidung dokumentieren 3) Unit-Tests 6h+1h=6:00
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Entscheidung AC#3: Pausen erscheinen in der Detailtabelle als 'Pause' markiert (Transparenz im Stundenzettel), zählen aber konsistent zur App-Ansicht (filter !pause) nicht in Summen/Zusammenfassung. Als Kommentar an den Filterstellen dokumentiert.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Export (PDF+CSV) schließt Pause-Einträge jetzt aus allen Summen aus: Gesamt-Footer, Tages-/Projektsummen und Zusammenfassungsseite (Projekt × Tag) laufen über workEntries = entries.filter(e => !e.pause) — konsistent zur App-Ansicht. Pausen-Zeilen bleiben in der Detailtabelle sichtbar, klar als 'Pause' markiert (ohne Projektfarbe). Tests: export.service.spec.ts erweitert (14 Tests grün, u.a. 6h Arbeit + 1h Pause ⇒ 6:00).
<!-- SECTION:FINAL_SUMMARY:END -->
