# Timebooking – Claude Code Context

## Projekt-Überblick

Zeiterfassungstool für Berater mit hexagonaler Architektur. Angular 19 Frontend + Express Backend für Google OAuth2.

## Architektur-Regeln

- **Hexagonal (Ports & Adapters)**: Domain kennt keine Frameworks. Ports sind `InjectionToken<Interface>` in `domain/ports/`. Adapter in `infrastructure/` implementieren die Interfaces.
- **Adapter-Binding** ausschließlich in `frontend/src/app/app.config.ts` via `{ provide: TOKEN, useClass: Adapter }`.
- **Kein direkter Import** von Adaptern in Komponenten oder Services – immer über `inject(PORT_TOKEN)`.
- **Neue Adapter**: Interface in `domain/ports/` implementieren, Klasse in `infrastructure/` anlegen, in `app.config.ts` binden.

## Tech Stack & Konventionen

- **Angular 19**: Standalone Components, Signals, `inject()`, neue Control Flow Syntax (`@if`, `@for`, `@switch`)
- **State**: NgRx Signal Store in `state/` – kein BehaviorSubject, kein klassisches NgRx mit Actions/Reducers
- **Styling**: Tailwind CSS 4 – kein Angular Material, kein SCSS
- **Templates**: Inline Templates (kein separate .html-Dateien), Inline Styles wo nötig
- **Backend**: Express 5, ESM (`"type": "module"`), `.js`-Extensions in Imports
- **Sprache UI**: Deutsch (Labels, Buttons, Meldungen)
- **Sprache Code**: Englisch (Variablen, Funktionen, Interfaces, Kommentare)

## Verzeichnisstruktur

```
frontend/src/app/
  domain/models/       → TimeEntry, Project, CalendarEvent (reine Interfaces)
  domain/ports/        → CalendarPort, StoragePort, ExportPort (InjectionToken + Interface)
  application/         → CalendarSyncService, ExportService (Use-Case Orchestrierung)
  infrastructure/
    calendar/          → GoogleCalendarAdapter, NoopCalendarAdapter
    export/            → PdfExportAdapter, CsvExportAdapter
    storage/           → LocalStorageAdapter, IndexedDbAdapter
  state/               → UiStore, TimeEntryStore, ProjectStore, CalendarStore
  features/            → calendar/, time-entry/, projects/, export/ (lazy loaded)
  shared/
    components/        → Modal, ColorPicker, WeekNavigator, ProjectPillsBar
    pipes/             → DurationPipe

backend/src/
  config/              → OAuth2 Client (oauth.config.ts)
  routes/              → auth.routes.ts, calendar.routes.ts
  services/            → google-calendar.service.ts
  middleware/           → auth.middleware.ts
  types/               → express-session.d.ts (Session-Typen)
  server.ts            → Server-Entrypoint
  app.ts               → Express App Factory
```

## Wichtige Dateien

- `frontend/src/app/app.config.ts` – DI-Wiring (Port → Adapter)
- `frontend/src/app/domain/ports/` – alle Port-Interfaces
- `frontend/src/app/state/` – alle Signal Stores
- `backend/src/app.ts` – Express App Factory
- `backend/.env` – Google OAuth Credentials (nicht im Repo)

## Build & Run

```bash
# Frontend
cd frontend && ng serve          # Dev: http://localhost:4200
cd frontend && ng build          # Prod Build

# Backend
cd backend && npm run dev        # Dev mit Hot Reload (tsx watch)
cd backend && npm run build      # TypeScript kompilieren

# Beides zusammen
./start.sh
```

## Patterns

- **Export-Port**: Hat zwei Adapter (PDF + CSV) mit separaten InjectionTokens (`PDF_EXPORT_PORT`, `CSV_EXPORT_PORT`). `ExportService` wählt anhand des Formats. PDF ist Querformat mit Projektfarben (Zeilenhintergrund + Farbpunkt). Optionale Zusammenfassungsseite (Projekt × Tag) über `ExportOptions.includeSummary` steuerbar.
- **Google Calendar Events**: Werden erst im CalendarStore als `CalendarEvent[]` gehalten. Erst bei Klick werden sie als `TimeEntry` mit `source: 'google'` und `googleEventId` in den TimeEntryStore importiert. Bereits importierte Events (matching via `googleEventId`) werden in der Kalenderansicht nicht mehr als Google-Events angezeigt. Events können dismissed werden (`dismissedGoogleEventIds` in TimeEntryStore, persistiert in `tb:dismissed-google-events` localStorage Key).
- **Default-Projekt**: `ProjectPillsBarComponent` (shared) ersetzt den alten Dropdown. Beide Views (Week + Day) importieren es. `onGoogleEventClick` vergibt automatisch `defaultProjectId`.
- **UI-State**: `UiStore` hält transiente UI-Zustände (activeView, activeDate, Modals). Nicht in der URL, nicht persistent.
- **Session-Auth**: Google Tokens liegen in der Express-Session (httpOnly Cookie, `session-file-store` in `backend/sessions/`). Sessions überleben Server-Neustarts. Frontend bekommt nie die Tokens direkt.
