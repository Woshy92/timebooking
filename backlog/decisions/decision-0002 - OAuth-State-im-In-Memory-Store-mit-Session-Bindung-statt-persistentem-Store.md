---
id: decision-0002
title: OAuth-State im In-Memory-Store mit Session-Bindung statt persistentem Store
date: '2026-06-12 18:03'
status: accepted
---
## Context

Timebooking läuft als lokales Single-Instance-Tool (ein Entwickler, ein
Prozess). Der OAuth 2.0 Authorization Code Flow benötigt einen `state`-Parameter
zur Abwehr von Login-CSRF-Angriffen. Dieser State muss zwischen dem Redirect zu
Google und dem Callback verifizierbar gespeichert werden.

Zwei Hauptalternativen standen zur Wahl:

1. **State in der Express-Session speichern:** Scheitert, weil Browser beim
   Top-Level-Redirect zu Google (accounts.google.com) keine SameSite-Cookies
   im Callback-Request mitsenden — die Session ist im Callback nicht zuverlässig
   verfügbar.

2. **Persistenter Store (Datenbank / Redis):** Technisch korrekt, aber für
   lokalen Einzelbetrieb überdimensioniert.

## Decision

Der OAuth-State wird in einem prozessinternen `Map<state, { sid, createdAt }>`
gehalten. Bei der State-Generierung wird die aktuelle Session-ID eingetragen;
der Callback prüft, ob die Session-ID aus dem Cookie mit dem gespeicherten Wert
übereinstimmt. States haben eine implizite Lebensdauer (Prozess-Lifetime) und
werden nach Verbrauch aus der Map gelöscht.

Implementierung: `backend/src/middleware/csrf.middleware.ts` und der
OAuth-Callback in `backend/src/routes/auth.routes.ts`.

## Consequences

**Positiv:**
- Keine externe Infrastruktur erforderlich (kein Redis, keine DB-Migration).
- Login-CSRF ist ausgeschlossen: State ist an die Session des initiierenden
  Browsers gebunden.
- Implementierung minimal und auditierbar.

**Negativ / Trade-offs:**
- Der State-Store **überlebt keinen Server-Neustart** nicht. Ein Neustart
  während eines laufenden Login-Flows führt zu einem Auth-Fehler; der Nutzer
  muss den Flow neu starten — für ein lokales Tool akzeptabel.
- Der Store **skaliert nicht auf mehrere Backend-Instanzen** (kein Shared State
  zwischen Prozessen).

**Migrationsweg:** Bei Deployment auf mehrere Instanzen oder produktivem Betrieb
muss die Map durch einen Redis- oder DB-backed Store ersetzt werden. Das Risiko
ist in doc-0005 als R-1 dokumentiert.

## Alternativen verworfen

| Alternative | Grund für Ablehnung |
|-------------|-------------------|
| State in Session speichern | SameSite-Cookie-Restriktionen machen Session im Google-Callback unzuverlässig |
| Persistenter DB-Store | Overkill für lokalen Einzelbetrieb; erhöht Ops-Komplexität ohne Mehrwert |

