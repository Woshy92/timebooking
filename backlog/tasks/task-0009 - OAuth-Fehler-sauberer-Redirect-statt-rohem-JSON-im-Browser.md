---
id: TASK-0009
title: 'OAuth-Fehler: sauberer Redirect statt rohem JSON im Browser'
status: To Do
assignee: []
created_date: '2026-06-12 17:15'
labels:
  - auth
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
- [ ] #1 Consent-Verweigerung (?error=access_denied) redirected zum Frontend mit Fehler-Parameter statt JSON zu zeigen
- [ ] #2 Ungültiger State und fehlgeschlagener Token-Exchange redirecten ebenfalls zum Frontend mit Fehler-Parameter
- [ ] #3 Das Frontend zeigt bei vorhandenem Fehler-Parameter eine deutsche Meldung (z.B. "Anmeldung abgebrochen") und räumt den Parameter aus der URL
- [ ] #4 Kein Auth-Fehlerpfad, der per Browser-Navigation erreichbar ist, rendert rohes JSON
- [ ] #5 Unit-Test (Backend): callback mit error-Param, ungültigem State und Exchange-Fehler antwortet jeweils mit Redirect
<!-- AC:END -->
