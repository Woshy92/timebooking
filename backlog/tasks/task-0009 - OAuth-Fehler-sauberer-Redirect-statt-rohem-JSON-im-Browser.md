---
id: TASK-0009
title: 'OAuth-Fehler: sauberer Redirect statt rohem JSON im Browser'
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:15'
updated_date: '2026-06-12 17:41'
labels:
  - ux
  - backend
  - auth
  - security
dependencies: []
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Der Login-Flow läuft jetzt als echte Browser-Navigation (GET /auth/start → Google → /auth/callback). Damit landen ALLE Fehlerpfade als rohes JSON im Browser-Tab: Google sendet ?error=access_denied bei Consent-Verweigerung (wird komplett ignoriert, Nutzer sieht "No authorization code provided"), ungültiger State liefert 403-JSON, Token-Exchange-Fehler 500-JSON. Der Nutzer strandet auf einer JSON-Seite ohne Weg zurück zur App. Quelle: FixBeforeProduction.md + auth.routes.ts (Working Tree).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Consent-Verweigerung (?error=access_denied) redirected zum Frontend mit Fehler-Parameter statt JSON zu zeigen
- [x] #2 Ungültiger State und fehlgeschlagener Token-Exchange redirecten ebenfalls zum Frontend mit Fehler-Parameter
- [x] #3 Das Frontend zeigt bei vorhandenem Fehler-Parameter eine deutsche Meldung (z.B. "Anmeldung abgebrochen") und räumt den Parameter aus der URL
- [x] #4 Kein Auth-Fehlerpfad, der per Browser-Navigation erreichbar ist, rendert rohes JSON
- [x] #5 Unit-Test (Backend): callback mit error-Param, ungültigem State und Exchange-Fehler antwortet jeweils mit Redirect
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Backend-Vitest+Supertest einrichten 2) auth.routes: alle Callback-Fehlerpfade als Redirect mit error-Param 3) Frontend: Meldung anzeigen + URL bereinigen 4) Backend-Unit-Tests für 3 Fehlerpfade
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backend-Test-Setup (Vitest + Supertest) wurde im Zuge dieses Tickets neu eingerichtet (backend/vitest.config.ts, src/test/setup.ts mit Test-Env, npm test). Fehler-Codes: auth_error=access_denied|invalid_state|token_exchange_failed|auth_failed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Alle per Browser-Navigation erreichbaren OAuth-Fehlerpfade redirecten jetzt zum Frontend mit ?auth_error=<code> statt rohes JSON zu rendern: Consent-Verweigerung (access_denied), fehlender Code, ungültiger State (invalid_state) und Token-Exchange-Fehler (token_exchange_failed); keine internen Details in der URL. Das Frontend zeigt beim Start eine deutsche Meldung über den bestehenden Error-Toast ('Anmeldung abgebrochen' bzw. 'Anmeldung fehlgeschlagen') und entfernt den Parameter via history.replaceState. Backend-Test-Setup (Vitest+Supertest) neu aufgebaut; 4 Backend-Tests + 5 Frontend-Tests grün.
<!-- SECTION:FINAL_SUMMARY:END -->
