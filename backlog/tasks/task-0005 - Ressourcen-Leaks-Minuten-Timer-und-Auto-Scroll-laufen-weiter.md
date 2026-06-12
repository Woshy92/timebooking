---
id: TASK-0005
title: 'Ressourcen-Leaks: Minuten-Timer und Auto-Scroll laufen weiter'
status: To Do
assignee: []
created_date: '2026-06-12 17:14'
labels:
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
- [ ] #1 Day- und Week-View clearen ihr Interval via DestroyRef.onDestroy — nach 10 View-Wechseln läuft genau ein Timer
- [ ] #2 Drag endet auch sauber, wenn mouseup außerhalb des Fensters passiert (z.B. via pointerup/pointercapture oder window blur-Guard): rAF-Schleife gestoppt, cursor und userSelect zurückgesetzt
- [ ] #3 Unit-Test oder dokumentierte manuelle Verifikationsschritte für beide Fälle vorhanden
<!-- AC:END -->
