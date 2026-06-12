---
id: TASK-0008
title: Tastatur-Bedienung und A11y-Grundlagen für den Kalender
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:15'
updated_date: '2026-06-12 18:01'
labels:
  - ux
  - a11y
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
- [x] #1 Eintrags-Blöcke sind per Tab fokussierbar (tabindex, role=button); Enter öffnet das Projekt-Popover, Entf löscht den Eintrag (mit Undo)
- [x] #2 Alle Icon-only-Buttons haben deutsche aria-labels (mindestens: Modal-Schließen, Eintrag-Löschen-X, Google-Event-Dismiss-X, Toast-Schließen)
- [x] #3 Hover-only-Controls (Delete-X, Resize-Handles, Dismiss-X) sind auf Touch-Geräten sichtbar/bedienbar (z.B. md:opacity-0-Pattern)
- [x] #4 Eintrags-Blöcke haben ein title-Attribut mit Titel, Projektname und Zeitraum
- [x] #5 Nav-Button "Gaps" heißt jetzt "Lücken"
- [x] #6 E2E-Test (Playwright): Eintrag nur per Tastatur fokussieren und löschen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Eintrags-Blöcke fokussierbar (tabindex/role/keydown: Enter=Popover, Entf=Löschen mit Undo) in Week+Day 2) deutsche aria-labels für alle Icon-only-Buttons 3) Hover-only-Controls via md:opacity-0-Pattern touch-fähig 4) title-Attribut auf Blöcken 5) 'Gaps'→'Lücken' 6) Playwright-E2E: Eintrag nur per Tastatur löschen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Keyboard-Logik zentral im CalendarInteractionService (onEntryKeydown: Enter/Space=Popover, Delete/Backspace=undobares Löschen; openEntryPopover ankert am fokussierten Block). Eintrags-Blöcke tragen aria-label und title mit 'Titel · Projekt · Zeitraum'. Bekannte Lücke (Follow-up-Kandidat aus TASK-0006): Modal hat weiterhin kein role=dialog / keine Label-Input-Verknüpfung.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Kalender ist jetzt tastatur- und touch-bedienbar: Eintrags-Blöcke in Week- und Day-View sind fokussierbar (tabindex=0, role=button, focus-visible-Ring), Enter/Space öffnet das Projekt-Popover, Entf/Backspace löscht mit Undo. Alle Icon-only-Buttons haben deutsche aria-labels (Modal-Schließen, Lösch-X, Dismiss-X, Toast-Schließen, Navigations- und Stundenbereichs-Buttons). Hover-only-Controls nutzen das md:opacity-0-Pattern und sind auf Touch immer sichtbar. Blöcke tragen title-Tooltips mit Titel · Projekt · Zeitraum. Nav-Button 'Gaps' heißt jetzt 'Lücken'. Neuer deterministischer Playwright-E2E (Eintrag rein per Tastatur löschen + Undo-Toast); Gesamt: 110 Unit-Tests, 3 E2E, Build grün.
<!-- SECTION:FINAL_SUMMARY:END -->
