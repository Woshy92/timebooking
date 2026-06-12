---
id: TASK-0017
title: 'UiStore: doppelte activeDate-Initialisierung entfernen'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 18:27'
updated_date: '2026-06-12 18:46'
labels:
  - refactoring
  - frontend
dependencies: []
priority: low
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code-Review-Finding: activeDate: new Date() steht in ui.store.ts doppelt — in initialState (Z. 34) und als Override im withState-Factory-Spread (Z. 51). Die Kopie in initialState ist tot, da sie immer überschattet wird. Eine der beiden Deklarationen entfernen, sodass es genau eine Quelle gibt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 activeDate wird genau einmal initialisiert; Verhalten unverändert (frischer Date pro Store-Erzeugung)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Doppelte activeDate-Init entfernen (Factory-Override behalten) 2) Tests/Build grün
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
activeDate (und das ebenfalls tote defaultProjectId) aus dem initialState-Literal entfernt, Typ auf Omit<UiState, 'activeDate' | 'defaultProjectId'> geändert — beide Werte werden authoritativ in der withState-Factory gesetzt (frischer Date pro Store-Erzeugung, defaultProjectId aus localStorage). 110+ Tests und Build grün, Verhalten unverändert.
<!-- SECTION:FINAL_SUMMARY:END -->
