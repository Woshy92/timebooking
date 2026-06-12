# Fix Before Production

> **Migriert ins Backlog (2026-06-12):** Die offenen Punkte sind jetzt TASK-0009
> (OAuth-Fehler-Redirect) und TASK-0010 (Production-Hardening). Bereits im
> Working Tree erledigt: `sameSite: 'lax'`, OAuth-State ohne Session-Cookie
> (`/auth/start`). Diese Datei ist nur noch Referenz.

Issues die bei rein lokalem Betrieb irrelevant sind, aber vor einem Production-Deployment behoben werden muessen.

## Security

- **CSRF-Token-Rotation** (`app.ts:42-53`): `XSRF-TOKEN`-Cookie wird nach Login/Logout nie rotiert. Token-Fixation-Risiko.
- **CSRF auf GET-Endpoint** (`auth.routes.ts:7`): `GET /auth/url` schreibt `oauthState` in die Session — umgeht CSRF-Schutz. Sollte POST sein.
- **`sameSite: 'strict'`** (`app.ts:37`): Bricht OAuth-Redirect-Callback bei Cross-Origin. Fix: `sameSite: 'lax'`.
- **Rate-Limiting**: Kein Rate-Limiting auf keinem Endpoint. `express-rate-limit` einbauen.
- **OAuth-Error-Parameter ignoriert** (`auth.routes.ts:20`): Google sendet `?error=access_denied` bei Consent-Verweigerung — wird ignoriert, Browser sieht rohes JSON. Fix: Redirect zum Frontend mit Error-Param.

## Resilience

- **Graceful Shutdown** (`server.ts`): Keine `SIGTERM`/`SIGINT`-Handler. Session-File-Writes koennen bei Shutdown korrumpiert werden.
- **`app.listen` Error-Handler** (`server.ts:15`): Port-in-Use etc. wird nicht gefangen.
- **SSR-Kompatibilitaet** (`ui.store.ts:29`): `localStorage.getItem()` bei Module-Evaluation bricht SSR.

## Logout

- **Session-Cookie nicht geloescht** (`auth.routes.ts:50-58`): `req.session.destroy()` loescht den Cookie nicht explizit. `res.clearCookie('connect.sid')` fehlt.
