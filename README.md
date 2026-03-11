# Timebooking

Zeiterfassungstool für Berater. Zieht Termine aus Google Calendar, zeigt sie in einer Wochen-/Tagesansicht an und erlaubt die flexible Zuordnung zu konfigurierbaren Projekten. Export als PDF und CSV.

## Architektur

Hexagonale Architektur (Ports & Adapters) mit strikter Trennung:

```
frontend/src/app/
├── domain/           Modelle + Port-Interfaces (framework-frei)
│   ├── models/       TimeEntry, Project, CalendarEvent
│   └── ports/        CalendarPort, StoragePort, ExportPort
├── application/      Use-Case Services (Orchestrierung)
├── infrastructure/   Adapter (konkrete Implementierungen)
│   ├── calendar/     GoogleCalendarAdapter  → CalendarPort
│   ├── storage/      LocalStorageAdapter    → StoragePort
│   └── export/       PdfExportAdapter       → ExportPort
│                     CsvExportAdapter       → ExportPort
├── state/            NgRx Signal Stores
├── features/         UI-Feature-Module (lazy loaded)
└── shared/           Wiederverwendbare UI-Komponenten + Pipes

backend/src/
├── routes/           Auth + Calendar API Routen
├── services/         Google Calendar API Wrapper
├── middleware/       Auth Guard
└── config/           OAuth2 Client Setup
```

### Adapter tauschen

In `frontend/src/app/app.config.ts` – eine Zeile pro Adapter:

```typescript
{ provide: STORAGE_PORT, useClass: LocalStorageAdapter },   // → IndexedDB, Supabase, ...
{ provide: CALENDAR_PORT, useClass: GoogleCalendarAdapter }, // → Outlook, Apple, ...
{ provide: PDF_EXPORT_PORT, useClass: PdfExportAdapter },   // → anderes PDF-Tool
{ provide: CSV_EXPORT_PORT, useClass: CsvExportAdapter },   // → anderes Format
```

## Tech Stack

| Komponente     | Technologie                                    |
|---------------|------------------------------------------------|
| Frontend      | Angular 19 (Standalone Components, Signals)     |
| State         | NgRx Signal Store                               |
| Styling       | Tailwind CSS 4                                  |
| Backend       | Express 5 + TypeScript                          |
| Auth          | Google OAuth2 (Authorization Code Flow, Session) |
| Calendar API  | Google Calendar API v3                          |
| PDF Export    | jsPDF + jspdf-autotable                         |
| CSV Export    | PapaParse                                       |

## Voraussetzungen

- Node.js >= 20
- npm >= 10
- Google Cloud Projekt mit Calendar API (siehe `SETUP.md`)

## Quickstart

```bash
# 1. Repo klonen & Setup prüfen
./start.sh

# Oder manuell:

# 2. Backend
cd backend
cp .env.example .env        # Dann Google Credentials eintragen
npm install
npm run dev

# 3. Frontend (neues Terminal)
cd frontend
npm install
npm start                    # → http://localhost:4200
```

## Features

- **Wochenansicht** mit Zeitraster (7–20 Uhr), Stunden pro Tag
- **Tagesansicht** mit detaillierter Darstellung
- **Google Calendar Import** – Events erscheinen gestrichelt, Klick importiert sie
- **Doppelklick** auf leeren Slot erstellt neuen Eintrag
- **Projektverwaltung** mit Farbauswahl und Abrechenbar-Flag
- **Flexible Bearbeitung** – Titel, Zeiten, Projekt, Notizen
- **Export** als CSV (Excel-kompatibel, `;`-Trenner) oder PDF (formatierter Bericht mit Summe)
- **Wochennavigation** mit KW-Anzeige und Heute-Button
