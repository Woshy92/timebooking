# Setup: Google Calendar Import

> **Diese Anleitung ist nur nötig, wenn du Google Calendar Termine importieren möchtest.**
> Ohne Google-Anbindung funktioniert die App komplett lokal: `./start.sh --local`

## 1. Google Cloud Projekt erstellen

1. Gehe zu [console.cloud.google.com](https://console.cloud.google.com/)
2. Oben links auf das Projekt-Dropdown klicken → **"Neues Projekt"**
3. Name: `Timebooking` (oder beliebig) → **"Erstellen"**
4. Warte, bis das Projekt erstellt ist, und wähle es als aktives Projekt aus

## 2. Google Calendar API aktivieren

1. Im linken Menü: **APIs & Dienste** → **Bibliothek**
2. Suche nach **"Google Calendar API"**
3. Klicke auf das Ergebnis → **"Aktivieren"**

## 3. OAuth-Zustimmungsbildschirm konfigurieren

1. Im linken Menü: **APIs & Dienste** → **OAuth-Zustimmungsbildschirm**
2. **User Type**: "Extern" auswählen → **"Erstellen"**
3. Ausfüllen:
   - **App-Name**: `Timebooking`
   - **Support-E-Mail**: deine E-Mail
   - **Autorisierte Domains**: leer lassen (für lokale Entwicklung)
   - **E-Mail-Adresse des Entwicklers**: deine E-Mail
4. **"Speichern und fortfahren"**
5. **Bereiche (Scopes)**: Klicke **"Bereiche hinzufügen oder entfernen"**
   - Suche nach `Google Calendar API` und wähle:
     - `.../auth/calendar.readonly` (Kalender anzeigen)
   - **"Aktualisieren"** → **"Speichern und fortfahren"**
6. **Testnutzer**: Klicke **"Nutzer hinzufügen"**
   - Trage deine Google-E-Mail-Adresse ein
   - **"Speichern und fortfahren"**

> **Hinweis**: Solange die App im Status "Testing" ist, können nur die eingetragenen Testnutzer sich anmelden. Das reicht für den lokalen Betrieb völlig aus.

## 4. OAuth2-Credentials erstellen

1. Im linken Menü: **APIs & Dienste** → **Anmeldedaten**
2. **"+ Anmeldedaten erstellen"** → **"OAuth-Client-ID"**
3. Anwendungstyp: **"Webanwendung"**
4. Name: `Timebooking Local`
5. **Autorisierte Weiterleitungs-URIs**: Klicke **"URI hinzufügen"**
   - Eintragen: `http://localhost:3000/auth/callback`
6. **"Erstellen"**
7. Es erscheint ein Dialog mit **Client-ID** und **Client-Secret** – **beide Werte kopieren**

## 5. Backend konfigurieren

```bash
cd backend
cp .env.example .env
```

Öffne `backend/.env` und trage die Werte ein:

```env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
FRONTEND_ORIGIN=http://localhost:4200
SESSION_SECRET=ein-beliebiger-langer-string-hier
PORT=3000
```

> **SESSION_SECRET**: Beliebiger String. Generiere einen mit: `openssl rand -hex 32`

## 6. Starten

```bash
# Alles zusammen (empfohlen)
./start.sh

# Oder manuell in zwei Terminals:
cd backend && npm install && npm run dev     # Terminal 1
cd frontend && npm install && npx ng serve   # Terminal 2
```

## 7. Google Kalender verbinden

1. Öffne http://localhost:4200
2. Klicke auf das **Kalender-Icon** oben rechts (gelb = nicht verbunden)
3. Melde dich mit deinem Google-Account an
4. Bestätige die Berechtigungen ("Unsichere App" Warnung ist normal im Test-Modus)
5. Du wirst zurück zur App geleitet – das Icon wird grün
6. Deine Google Calendar Termine erscheinen als gestrichelte Karten
7. Klicke auf einen Termin, um ihn als Zeiteintrag zu importieren

## Fehlerbehebung

### "Access blocked: This app's request is invalid" (Error 400)
- Prüfe, ob die Redirect URI exakt `http://localhost:3000/auth/callback` ist (in Google Console **und** in `.env`)
- Kein Trailing Slash!

### "Access denied" / 403
- Prüfe, ob deine E-Mail als Testnutzer im OAuth-Zustimmungsbildschirm eingetragen ist

### "Token has been expired or revoked" / 401
- Die App leitet automatisch zur erneuten Anmeldung weiter
- Falls nicht: Browser-Cookies für localhost löschen und neu verbinden

### Keine Events sichtbar
- Prüfe, ob der Google-Account tatsächlich Termine im angefragten Zeitraum hat
- Ganztägige Events werden gefiltert (nur Events mit konkreter Uhrzeit)
- Abgelehnte Termine (RSVP: "Nein") werden automatisch ausgeblendet
- Navigiere mit den Pfeilen zur richtigen Woche

### Backend startet nicht
- Prüfe, ob `.env` existiert und alle Werte gesetzt sind
- Prüfe, ob Port 3000 frei ist: `lsof -i :3000`

### Daten zurücksetzen
Die App speichert alles im Browser. Zum Zurücksetzen:
- **DevTools** → **Application** → **IndexedDB** → `timebooking` → Datenbank löschen
- Oder: **Application** → **Storage** → **Clear site data**
