---
id: TASK-0015
title: Modal-Delete an CalendarInteractionService.deleteSingleEntry delegieren
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 18:27'
updated_date: '2026-06-12 18:56'
labels:
  - refactoring
  - frontend
dependencies: []
priority: low
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code-Review-Finding: time-entry-modal.component.ts:50-57 re-implementiert den Single-Entry-Delete (undoStore.pushDelete + removeEntry) statt an den im selben Push eingeführten kanonischen Pfad CalendarInteractionService.deleteSingleEntry zu delegieren. Verhalten (Undo-Toast) ist heute identisch — reine Konsolidierung, damit Änderungen am Undo-Kontrakt nicht zwei Stellen brauchen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 onDelete im Time-Entry-Modal delegiert an CalendarInteractionService.deleteSingleEntry (Modal-Schließen bleibt erhalten)
- [x] #2 Bestehende Delete/Undo-Tests bleiben grün (time-entry-modal.delete.spec.ts ggf. angepasst)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) onDelete delegiert an CalendarInteractionService.deleteSingleEntry, Modal-Close bleibt 2) Delete-Spec anpassen 3) Suite grün
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
onDelete im Time-Entry-Modal delegiert an CalendarInteractionService.deleteSingleEntry; Service-Signatur minimal auf event: Event | null erweitert (stopPropagation via Optional Chaining), closePopover ist im Modal-Kontext ein harmloser No-op. Modal-Schließen bleibt im Component. Delete-Spec auf Delegation + Service-Verhalten umgestellt. Suite 144 grün, Build grün.
<!-- SECTION:FINAL_SUMMARY:END -->
