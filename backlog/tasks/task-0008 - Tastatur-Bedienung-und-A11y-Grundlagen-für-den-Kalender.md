---
id: TASK-0008
title: Tastatur-Bedienung und A11y-Grundlagen für den Kalender
status: To Do
assignee: []
created_date: '2026-06-12 17:15'
labels:
  - frontend
dependencies: []
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Der Kalender ist aktuell nur per Maus bedienbar: Eintrags-Blöcke sind <div>s mit (click)/(mousedown) ohne tabindex/role/keydown — Auswählen, Projekt-Popover und Löschen gehen ohne Maus nicht. Delete-X, Dismiss-X und Resize-Handles sind hover-only (opacity-0 group-hover:opacity-100), auf Touch unsichtbar. Mehrere Icon-only-Buttons (Modal-Schließen, Delete-X, Error-Toast-Dismiss) haben kein aria-label. Bonus-Polish: kurze Blöcke schneiden den Projektnamen ab ohne title-Tooltip, und der Nav-Button "Gaps" ist das einzige englische Label in der sonst deutschen UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eintrags-Blöcke sind per Tab fokussierbar (tabindex, role=button); Enter öffnet das Projekt-Popover, Entf löscht den Eintrag (mit Undo)
- [ ] #2 Alle Icon-only-Buttons haben deutsche aria-labels (mindestens: Modal-Schließen, Eintrag-Löschen-X, Google-Event-Dismiss-X, Toast-Schließen)
- [ ] #3 Hover-only-Controls (Delete-X, Resize-Handles, Dismiss-X) sind auf Touch-Geräten sichtbar/bedienbar (z.B. md:opacity-0-Pattern)
- [ ] #4 Eintrags-Blöcke haben ein title-Attribut mit Titel, Projektname und Zeitraum
- [ ] #5 Nav-Button "Gaps" heißt jetzt "Lücken"
- [ ] #6 E2E-Test (Playwright): Eintrag nur per Tastatur fokussieren und löschen
<!-- AC:END -->
