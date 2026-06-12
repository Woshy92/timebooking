---
id: TASK-0010
title: Backend Production-Hardening (Rest aus FixBeforeProduction.md)
status: Done
assignee:
  - '@claude'
created_date: '2026-06-12 17:16'
updated_date: '2026-06-12 17:54'
labels:
  - backend
  - security
  - resilience
dependencies: []
priority: low
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sammelticket für die noch offenen Punkte aus FixBeforeProduction.md — bei rein lokalem Betrieb unkritisch, vor einem Deployment Pflicht. Bereits erledigt im Working Tree: sameSite=lax, OAuth-State ohne Session-Cookie (/auth/start). Hinweis für die Umsetzung: der neue In-Memory-State-Store in auth.routes.ts überlebt keinen Server-Restart und skaliert nicht auf mehrere Instanzen — bei Deployment mitdenken. Außerdem nutzt das Backend inzwischen PGlite (initializeDatabase in server.ts), das beim Shutdown sauber geschlossen werden sollte.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 XSRF-TOKEN-Cookie wird nach Login und Logout rotiert (Token-Fixation ausgeschlossen)
- [x] #2 Rate-Limiting (express-rate-limit) aktiv auf /auth/* und /api/*
- [x] #3 Logout löscht das Session-Cookie explizit (res.clearCookie) zusätzlich zu session.destroy
- [x] #4 SIGTERM/SIGINT-Handler: HTTP-Server und PGlite werden sauber geschlossen, laufende Session-File-Writes nicht korrumpiert
- [x] #5 app.listen-Fehler (z.B. EADDRINUSE) werden gefangen und mit verständlicher Meldung beendet
- [x] #6 ui.store.ts greift nicht mehr bei Module-Evaluation auf localStorage zu (SSR-sicher)
- [x] #7 OAuth-State ist an die Session gebunden: /auth/start speichert die Session-ID zum State (pendingStates.set(state, { sid: req.sessionID, createdAt })), /auth/callback lehnt ab wenn entry.sid !== req.sessionID (Login-CSRF ausgeschlossen)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) XSRF-Rotation nach Login/Logout 2) express-rate-limit auf /auth/* und /api/* 3) clearCookie bei Logout 4) SIGTERM/SIGINT: HTTP+PGlite sauber schließen 5) listen-Fehler abfangen 6) ui.store ohne localStorage bei Module-Eval 7) OAuth-State an Session-ID binden 8) Backend-Tests, FixBeforeProduction.md auf Ticket verweisen/löschen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Limits: 15-min-Fenster, auth 10/IP, api 300/IP, via RATE_LIMIT_AUTH_MAX/API_MAX env-überschreibbar (Tests: 1000). /auth/status läuft unter dem API-Limit (SPA-Polling). Rate-Limit auf GET /auth/* redirectet mit auth_error=rate_limited. In Tests MemoryStore statt session-file-store (hermetisch). In-Memory-State-Store-Trade-off (kein Restart/Multi-Instanz) als Kommentar dokumentiert. FixBeforeProduction.md gelöscht — alle Punkte erledigt oder obsolet (GET /auth/url existiert nicht mehr).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backend-Production-Hardening komplett: XSRF-TOKEN-Cookie wird nach Login und Logout rotiert (neues geteiltes csrf.middleware.ts); express-rate-limit auf /auth/* (10/15min) und /api/* (300/15min, env-konfigurierbar); Logout löscht das Session-Cookie explizit via res.clearCookie; SIGTERM/SIGINT schließen erst den HTTP-Server, dann PGlite (zweites Signal → Sofort-Exit); EADDRINUSE & Co. enden mit verständlicher Meldung und Exit 1; ui.store.ts greift nicht mehr bei Module-Evaluation auf localStorage zu (SSR-sicher, Factory mit Guard); OAuth-State ist an die Session-ID gebunden — Callback mit fremder Session wird als invalid_state-Redirect abgelehnt (Login-CSRF ausgeschlossen). FixBeforeProduction.md gelöscht (alle Punkte erledigt/obsolet). Tests: 12 Backend-Tests grün (inkl. Rate-Limit-Überschreitung, XSRF-Rotation, State-Binding positiv/negativ, Logout-Cookie), Frontend-Suite 110 grün; SIGTERM- und Port-Konflikt-Verhalten real verifiziert.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 FixBeforeProduction.md wird gelöscht oder auf dieses Ticket verwiesen
<!-- DOD:END -->
