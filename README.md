# Timebooking

Zeiterfassungstool für Berater. Funktioniert komplett lokal im Browser – optional mit Google Calendar Import für automatischen Terminabgleich.

## Schnellstart

### Lokal-Modus (empfohlen zum Ausprobieren)

Keine Konfiguration nötig. Alles wird im Browser gespeichert (IndexedDB/LocalStorage).

```bash
git clone <repo-url> && cd timebooking

# Option A: Start-Skript
./start.sh --local

# Option B: Manuell
cd frontend
npm install
npx ng serve --configuration local
```

Öffne **http://localhost:4200** – fertig.

### Mit Google Calendar

Wenn du Termine aus Google Calendar importieren möchtest, brauchst du zusätzlich ein Google Cloud Projekt. Siehe [SETUP.md](SETUP.md) für die einmalige Einrichtung.

```bash
# 1. Backend konfigurieren (einmalig)
cd backend
cp .env.example .env
# → Google OAuth Credentials in .env eintragen (siehe SETUP.md)

# 2. Starten
./start.sh
```

Das Start-Skript prüft automatisch Node.js-Version, Dependencies, Ports und `.env`-Konfiguration.

```
./start.sh              # Frontend + Backend (Google Calendar)
./start.sh --local      # Nur Frontend (manuelle Zeiterfassung)
./start.sh --open       # Zusätzlich Browser öffnen
./start.sh --help       # Alle Optionen anzeigen
```

## Voraussetzungen

- **Node.js >= 20** und **npm >= 10** ([nodejs.org](https://nodejs.org/))
- **Google Cloud Projekt** (nur für Google Calendar Import – siehe [SETUP.md](SETUP.md))

## Was kann die App?

| Feature | Lokal-Modus | Mit Google Calendar |
|---------|:-----------:|:-------------------:|
| Wochenansicht mit Zeitraster | ✓ | ✓ |
| Tagesansicht | ✓ | ✓ |
| Einträge erstellen per Klick & Drag | ✓ | ✓ |
| Einträge bearbeiten (Titel, Zeit, Projekt, Notizen) | ✓ | ✓ |
| Einträge per Drag resizen | ✓ | ✓ |
| Projektverwaltung mit Farben | ✓ | ✓ |
| Export als PDF & CSV | ✓ | ✓ |
| Statistiken (Linie, Balken, Kreis) | ✓ | ✓ |
| Urlaubs-Markierung | ✓ | ✓ |
| Google Calendar Termine importieren | – | ✓ |
| Überlappende Einträge nebeneinander | ✓ | ✓ |
| Undo nach Löschen | ✓ | ✓ |
| Multi-Select & Batch-Aktionen | ✓ | ✓ |

**Datenhaltung**: Alle Daten liegen im Browser (IndexedDB). Es gibt keinen zentralen Server – die App ist auch offline nutzbar (im Lokal-Modus).

## Architektur

Hexagonale Architektur (Ports & Adapters) mit strikter Trennung:

```
frontend/src/app/
├── domain/           Modelle + Port-Interfaces (framework-frei)
│   ├── models/       TimeEntry, Project, CalendarEvent
│   └── ports/        CalendarPort, StoragePort, ExportPort
├── application/      Use-Case Services (Orchestrierung)
├── infrastructure/   Adapter (konkrete Implementierungen)
│   ├── calendar/     GoogleCalendarAdapter / NoopCalendarAdapter
│   ├── storage/      IndexedDbAdapter / LocalStorageAdapter
│   └── export/       PdfExportAdapter / CsvExportAdapter
├── state/            NgRx Signal Stores
├── features/         UI-Feature-Module (lazy loaded)
└── shared/           Wiederverwendbare UI-Komponenten + Pipes

backend/src/          (nur für Google Calendar)
├── routes/           Auth + Calendar API Routen
├── services/         Google Calendar API Wrapper
├── middleware/       Auth Guard
└── config/           OAuth2 Client Setup
```

### Adapter tauschen

In `frontend/src/app/app.config.ts` – eine Zeile pro Adapter:

```typescript
{ provide: STORAGE_PORT, useClass: IndexedDbAdapter },      // → LocalStorage, Supabase, ...
{ provide: CALENDAR_PORT, useClass: GoogleCalendarAdapter }, // → Outlook, Apple, Noop
{ provide: PDF_EXPORT_PORT, useClass: PdfExportAdapter },
{ provide: CSV_EXPORT_PORT, useClass: CsvExportAdapter },
```

## Tech Stack

| Komponente     | Technologie                                    |
|---------------|------------------------------------------------|
| Frontend      | Angular 19 (Standalone Components, Signals)     |
| State         | NgRx Signal Store                               |
| Styling       | Tailwind CSS 4                                  |
| Charts        | Chart.js                                        |
| Backend       | Express 5 + TypeScript (nur für Google OAuth)   |
| Auth          | Google OAuth2 (Authorization Code Flow, Session) |
| Calendar API  | Google Calendar API v3                          |
| PDF Export    | jsPDF + jspdf-autotable                         |
| CSV Export    | PapaParse                                       |

## Entwicklung

```bash
# Frontend (Dev Server mit Hot Reload)
cd frontend && npx ng serve            # http://localhost:4200

# Frontend Lokal-Modus (ohne Backend)
cd frontend && npx ng serve --configuration local

# Backend (Dev Server mit Hot Reload)
cd backend && npm run dev              # http://localhost:3000

# Frontend Build (Produktion)
cd frontend && npx ng build

# Backend Build
cd backend && npm run build
```
