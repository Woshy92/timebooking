---
id: TASK-0013
title: >-
  Export-Adapter: gemeinsame Berechnungslogik extrahieren und Farb-Map
  vorberechnen
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 18:27'
updated_date: '2026-06-12 18:46'
labels:
  - refactoring
  - frontend
  - export
dependencies: []
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code-Review-Findings: (1) Pause-Filter, formatHoursAsHHMM und die Projekt×Tag-Stunden-Aggregation (filter+isSameDay+reduce) sind zwischen csv-export.adapter.ts und pdf-export.adapter.ts dupliziert (4 wortgleiche Kopien der Aggregation). (2) dayTotals wird als Seiteneffekt in days.map() mutiert (csv:69-75, pdf:147-153). (3) pdf-export.adapter.ts ruft parseHexColor/projectMap.get pro Zelle in didParseCell/didDrawCell auf (~5000 Calls pro Export) und verstreut Tint-Faktoren 0.82/0.88/0.93 als unbenannte Literale. Lösung: gemeinsames Export-Util-Modul (z.B. infrastructure/export/export-summary.util.ts) mit formatHoursAsHHMM, Pause-Filter und einer einmal berechneten Stunden-Matrix; im PDF-Adapter eine vorab berechnete projectId→RGB/Tint-Map und benannte Tint-Konstanten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 formatHoursAsHHMM, Pause-Filter und Stunden-Aggregation existieren genau einmal in einem gemeinsamen Modul; beide Adapter nutzen es
- [x] #2 dayTotals wird ohne Seiteneffekt-Mutation in map() berechnet
- [x] #3 PDF-Adapter berechnet Projektfarben/Tints einmal pro Projekt (Map), nicht pro Zelle; Tint-Faktoren sind benannte Konstanten
- [x] #4 Bestehende Export-Unit-Tests bleiben grün; CSV- und PDF-Summen identisch zu vorher (Tests decken Pausen-Ausschluss und Summenbildung ab)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Gemeinsames Util-Modul (formatHoursAsHHMM, Pause-Filter, Stunden-Matrix) 2) Beide Adapter umstellen, dayTotals ohne map-Mutation 3) PDF: vorberechnete Farb/Tint-Map, benannte Konstanten 4) Bestehende Tests grün
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gemeinsames Modul export-summary.util.ts (formatHoursAsHHMM, excludePauses, buildHoursMatrix in einem Durchlauf ohne map-Mutation); CSV- und PDF-Adapter umgestellt; PDF berechnet projectId→RGB/Tint-Map einmal pro Projekt mit benannten Konstanten (HEADER_TINT 0.82, SUMMARY_ROW_TINT 0.88, ENTRY_ROW_TINT 0.93). 14 neue Util-Tests, bestehende Export-Regressionstests unverändert grün.
<!-- SECTION:FINAL_SUMMARY:END -->
