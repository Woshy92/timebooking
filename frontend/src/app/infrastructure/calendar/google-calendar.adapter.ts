import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { CalendarPort } from '../../domain/ports/calendar.port';
import { CalendarEvent, CalendarFetchParams } from '../../domain/models/calendar-event.model';
import { environment } from '../../../environments/environment';

interface GoogleEventDTO {
  id: string;
  summary: string;
  description?: string;
  attendees?: string[];
  recurringEventId?: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

@Injectable()
export class GoogleCalendarAdapter implements CalendarPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl;

  fetchEvents(params: CalendarFetchParams): Observable<CalendarEvent[]> {
    return this.http.get<GoogleEventDTO[]>(`${this.baseUrl}/api/calendar/events`, {
      params: {
        timeMin: params.timeMin.toISOString(),
        timeMax: params.timeMax.toISOString(),
        calendarId: params.calendarId ?? 'primary',
      },
      withCredentials: true,
    }).pipe(
      map(events => events.map(e => ({
        id: e.id,
        title: e.summary || '(Kein Titel)',
        start: new Date(e.start.dateTime),
        end: new Date(e.end.dateTime),
        description: e.description,
        attendees: e.attendees?.length ? e.attendees : undefined,
        recurringEventId: e.recurringEventId,
        source: 'google' as const,
      })))
    );
  }

  isAuthenticated(): Observable<boolean> {
    return this.http.get<{ authenticated: boolean }>(
      `${this.baseUrl}/auth/status`,
      { withCredentials: true }
    ).pipe(map(r => r.authenticated));
  }

  getAuthUrl(): Observable<string> {
    return this.http.get<{ url: string }>(
      `${this.baseUrl}/auth/url`,
      { withCredentials: true }
    ).pipe(map(r => r.url));
  }
}
