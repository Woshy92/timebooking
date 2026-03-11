import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CalendarEvent, CalendarFetchParams } from '../models/calendar-event.model';

export interface CalendarPort {
  fetchEvents(params: CalendarFetchParams): Observable<CalendarEvent[]>;
  isAuthenticated(): Observable<boolean>;
  getAuthUrl(): Observable<string>;
}

export const CALENDAR_PORT = new InjectionToken<CalendarPort>('CalendarPort');
