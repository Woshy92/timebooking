---
id: TASK-0002
title: Export zählt Pausen in den Summen mit
status: To Do
assignee: []
created_date: '2026-06-12 17:14'
labels:
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
- [ ] #1 PDF- und CSV-Gesamtsumme schließen Einträge mit pause=true aus und stimmen mit der in der App angezeigten Summe für denselben Zeitraum überein
- [ ] #2 Die Zusammenfassungsseite (Projekt × Tag) zählt Pausen nicht unter 'Ohne Projekt'
- [ ] #3 Entschieden und dokumentiert: Pausen-Zeilen erscheinen entweder klar als 'Pause' markiert in der Detailtabelle oder gar nicht (beides ok, aber bewusst)
- [ ] #4 Unit-Test: Export mit 6h Arbeit + 1h Pause ergibt Summe 6:00, nicht 7:00
<!-- AC:END -->
