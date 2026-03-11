import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { CalendarEvent } from '../domain/models/calendar-event.model';
import { CALENDAR_PORT } from '../domain/ports/calendar.port';

interface CalendarState {
  events: CalendarEvent[];
  loading: boolean;
  authenticated: boolean;
  error: string | null;
}

export const CalendarStore = signalStore(
  { providedIn: 'root' },
  withState<CalendarState>({
    events: [],
    loading: false,
    authenticated: false,
    error: null,
  }),
  withMethods((store) => {
    const calendarPort = inject(CALENDAR_PORT);
    return {
      checkAuth() {
        calendarPort.isAuthenticated().subscribe({
          next: (authenticated) => patchState(store, { authenticated }),
          error: () => patchState(store, { authenticated: false }),
        });
      },
      fetchEvents(timeMin: Date, timeMax: Date) {
        patchState(store, { loading: true });
        calendarPort.fetchEvents({ timeMin, timeMax }).subscribe({
          next: (events) => patchState(store, { events, loading: false }),
          error: (err) => patchState(store, { error: String(err), loading: false }),
        });
      },
      getAuthUrl(callback: (url: string) => void) {
        calendarPort.getAuthUrl().subscribe({ next: callback });
      },
      setAuthenticated(value: boolean) {
        patchState(store, { authenticated: value });
      },
    };
  })
);
