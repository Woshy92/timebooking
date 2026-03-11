import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withXsrfConfiguration } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { CALENDAR_PORT } from './domain/ports/calendar.port';
import { STORAGE_PORT } from './domain/ports/storage.port';
import { PDF_EXPORT_PORT, CSV_EXPORT_PORT } from './domain/ports/export.port';
import { GoogleCalendarAdapter } from './infrastructure/calendar/google-calendar.adapter';
import { NoopCalendarAdapter } from './infrastructure/calendar/noop-calendar.adapter';
import { IndexedDbAdapter } from './infrastructure/storage/indexeddb.adapter';
import { PdfExportAdapter } from './infrastructure/export/pdf-export.adapter';
import { CsvExportAdapter } from './infrastructure/export/csv-export.adapter';
import { environment } from '../environments/environment';

const calendarAdapter = environment.googleCalendarEnabled
  ? GoogleCalendarAdapter
  : NoopCalendarAdapter;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    provideAnimationsAsync(),

    // Hexagonal: Port -> Adapter bindings
    { provide: CALENDAR_PORT, useClass: calendarAdapter },
    { provide: STORAGE_PORT, useClass: IndexedDbAdapter },
    { provide: PDF_EXPORT_PORT, useClass: PdfExportAdapter },
    { provide: CSV_EXPORT_PORT, useClass: CsvExportAdapter },
  ],
};
