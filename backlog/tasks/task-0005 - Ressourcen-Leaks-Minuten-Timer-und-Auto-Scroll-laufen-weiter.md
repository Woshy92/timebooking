---
id: TASK-0005
title: 'Ressourcen-Leaks: Minuten-Timer und Auto-Scroll laufen weiter'
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
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Zwei Cleanup-Bugs in den Kalender-Views: (1) Day- und Week-View starten in afterNextRender ein setInterval für den Jetzt-Indikator, ohne es bei Component-Destroy zu clearen — jeder View-Wechsel stapelt ein weiteres Interval (Memory-Leak + unnötige Signal-Writes). (2) Der rAF-basierte Auto-Scroll (shared/utils/auto-scroll.ts) wird nur durch mouseup auf document gestoppt; lässt der Nutzer die Maus AUSSERHALB des Browserfensters los, läuft die Schleife endlos weiter und cursor/userSelect bleiben im Drag-Zustand hängen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Day- und Week-View clearen ihr Interval via DestroyRef.onDestroy — nach 10 View-Wechseln läuft genau ein Timer
- [x] #2 Drag endet auch sauber, wenn mouseup außerhalb des Fensters passiert (z.B. via pointerup/pointercapture oder window blur-Guard): rAF-Schleife gestoppt, cursor und userSelect zurückgesetzt
- [x] #3 Unit-Test oder dokumentierte manuelle Verifikationsschritte für beide Fälle vorhanden
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) DestroyRef.onDestroy für setInterval in Day/Week-View 2) auto-scroll: pointerup/pointercapture+blur-Guard 3) Unit-Tests bzw. dokumentierte Verifikation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Subagent brach nach dem auto-scroll-Teil ab (API-Fehler); Interval-Cleanup und auto-scroll.spec.ts vom Orchestrator ergänzt. Ansatz Fall 2: startAutoScroll registriert window pointerup+blur als Selbst-Stopp-Guards, stop() ist idempotent und ruft einen optionalen onStop-Callback (setzt cursor/userSelect in beiden Views zurück).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Beide Ressourcen-Leaks behoben: (1) Day- und Week-View clearen ihr Jetzt-Indikator-Interval via DestroyRef.onDestroy — kein Stapeln mehr bei View-Wechseln. (2) startAutoScroll stoppt sich jetzt selbst bei window pointerup und blur (Maus außerhalb des Fensters losgelassen), stop() ist idempotent und ein onStop-Callback setzt cursor/userSelect zurück. 6 neue Unit-Tests für auto-scroll (gemocktes rAF) grün.
<!-- SECTION:FINAL_SUMMARY:END -->
