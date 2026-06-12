---
id: TASK-0012
title: 'OAuth-Redirect: URL-Validierung vor window.location.href wiederherstellen'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 18:27'
updated_date: '2026-06-12 18:56'
labels:
  - security
  - frontend
dependencies: []
priority: medium
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code-Review-Finding (Push ae38d51..3173152): In frontend/src/app/app.ts:303 wird die vom CalendarPort gelieferte Auth-URL ohne Prüfung direkt window.location.href zugewiesen — die frühere Validierung wurde entfernt. Defense-in-Depth: nur same-origin-relative URLs oder https-URLs auf erwartete Hosts (Backend-Origin) zulassen, sonst Fehler anzeigen statt navigieren.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Redirect erfolgt nur, wenn die URL same-origin/relativ ist oder https mit erwartetem Host; andernfalls wird nicht navigiert und ein Fehler angezeigt
- [x] #2 Unit-Test deckt gültige und bösartige URLs (http, fremder Host, javascript:) ab
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Validierungs-Helper (same-origin/relativ oder https mit Backend-Host) 2) app.ts: nur validierte URL zuweisen, sonst Fehlermeldung 3) Unit-Tests gültig/bösartig
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Neuer Helper isSafeRedirectUrl (shared/utils/safe-redirect.ts): erlaubt nur http(s), same-origin (inkl. relative URLs) oder https mit dem aus environment.backendUrl abgeleiteten Backend-Host; javascript:/data:/fremde Hosts/protocol-relative werden abgelehnt. onGoogleConnect in app.ts navigiert nur bei validierter URL, sonst deutsche Fehlermeldung via calendarStore.setError (Error-Toast). 11 Unit-Tests für gültige und bösartige URLs. Suite 144 grün, Build grün.
<!-- SECTION:FINAL_SUMMARY:END -->
