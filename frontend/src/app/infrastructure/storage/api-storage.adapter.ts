import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { StoragePort } from '../../domain/ports/storage.port';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../../domain/models/time-entry.model';
import { Project, CreateProjectDTO } from '../../domain/models/project.model';
import { RecurringProjectMapping } from '../../domain/models/recurring-mapping.model';
import { environment } from '../../../environments/environment';

@Injectable()
export class ApiStorageAdapter implements StoragePort {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.backendUrl}/api/storage`;

  // ─── Time Entries ──────────────────────────────────────

  getEntries(from: Date, to: Date): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(`${this.base}/entries`, {
      params: { from: from.toISOString(), to: to.toISOString() },
      withCredentials: true,
    }).pipe(
      map(entries => entries.map(e => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
      })))
    );
  }

  saveEntry(dto: CreateTimeEntryDTO): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.base}/entries`, dto, {
      withCredentials: true,
    }).pipe(
      map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }))
    );
  }

  updateEntry(id: string, changes: UpdateTimeEntryDTO): Observable<TimeEntry> {
    return this.http.put<TimeEntry>(`${this.base}/entries/${id}`, changes, {
      withCredentials: true,
    }).pipe(
      map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }))
    );
  }

  deleteEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/entries/${id}`, {
      withCredentials: true,
    });
  }

  deleteEntries(ids: string[]): Observable<string[]> {
    return this.http.post<string[]>(`${this.base}/entries/delete-batch`, { ids }, {
      withCredentials: true,
    });
  }

  // ─── Dismissed Google Events ───────────────────────────

  getDismissedGoogleEventIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/dismissed-events`, {
      withCredentials: true,
    });
  }

  dismissGoogleEvent(eventId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/dismissed-events`, { eventId }, {
      withCredentials: true,
    });
  }

  undismissGoogleEvent(eventId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dismissed-events/${encodeURIComponent(eventId)}`, {
      withCredentials: true,
    });
  }

  clearDismissedGoogleEventIds(): Observable<void> {
    return this.http.delete<void>(`${this.base}/dismissed-events/all`, {
      withCredentials: true,
    });
  }

  // ─── Recurring Project Mappings ────────────────────────

  getRecurringProjectMappings(): Observable<RecurringProjectMapping[]> {
    return this.http.get<RecurringProjectMapping[]>(`${this.base}/recurring-mappings`, {
      withCredentials: true,
    });
  }

  setRecurringProjectMapping(recurringEventId: string, projectId: string, eventTitle: string): Observable<void> {
    return this.http.put<void>(
      `${this.base}/recurring-mappings/${encodeURIComponent(recurringEventId)}`,
      { projectId, eventTitle },
      { withCredentials: true },
    );
  }

  deleteRecurringProjectMapping(recurringEventId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/recurring-mappings/${encodeURIComponent(recurringEventId)}`,
      { withCredentials: true },
    );
  }

  // ─── Projects ──────────────────────────────────────────

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.base}/projects`, {
      withCredentials: true,
    });
  }

  saveProject(dto: CreateProjectDTO): Observable<Project> {
    return this.http.post<Project>(`${this.base}/projects`, dto, {
      withCredentials: true,
    });
  }

  updateProject(id: string, changes: Partial<Project>): Observable<Project> {
    return this.http.put<Project>(`${this.base}/projects/${id}`, changes, {
      withCredentials: true,
    });
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/projects/${id}`, {
      withCredentials: true,
    });
  }

  reorderProjects(orderedIds: string[]): Observable<Project[]> {
    return this.http.put<Project[]>(`${this.base}/projects/reorder`, { orderedIds }, {
      withCredentials: true,
    });
  }
}
