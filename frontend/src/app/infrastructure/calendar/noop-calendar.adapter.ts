import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CalendarPort } from '../../domain/ports/calendar.port';
import { CalendarEvent, CalendarFetchParams } from '../../domain/models/calendar-event.model';

@Injectable()
export class NoopCalendarAdapter implements CalendarPort {
  fetchEvents(_params: CalendarFetchParams): Observable<CalendarEvent[]> {
    return of([]);
  }

  isAuthenticated(): Observable<boolean> {
    return of(false);
  }

  getAuthUrl(): Observable<string> {
    return of('');
  }
}
