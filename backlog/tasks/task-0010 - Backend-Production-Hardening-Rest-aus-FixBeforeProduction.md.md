---
id: TASK-0010
title: Backend Production-Hardening (Rest aus FixBeforeProduction.md)
status: To Do
assignee: []
created_date: '2026-06-12 17:16'
labels:
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
- [ ] #1 XSRF-TOKEN-Cookie wird nach Login und Logout rotiert (Token-Fixation ausgeschlossen)
- [ ] #2 Rate-Limiting (express-rate-limit) aktiv auf /auth/* und /api/*
- [ ] #3 Logout löscht das Session-Cookie explizit (res.clearCookie) zusätzlich zu session.destroy
- [ ] #4 SIGTERM/SIGINT-Handler: HTTP-Server und PGlite werden sauber geschlossen, laufende Session-File-Writes nicht korrumpiert
- [ ] #5 app.listen-Fehler (z.B. EADDRINUSE) werden gefangen und mit verständlicher Meldung beendet
- [ ] #6 ui.store.ts greift nicht mehr bei Module-Evaluation auf localStorage zu (SSR-sicher)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 FixBeforeProduction.md wird gelöscht oder auf dieses Ticket verwiesen
<!-- DOD:END -->
