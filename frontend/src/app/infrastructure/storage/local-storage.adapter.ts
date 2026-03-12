import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { StoragePort } from '../../domain/ports/storage.port';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../../domain/models/time-entry.model';
import { Project, CreateProjectDTO } from '../../domain/models/project.model';

const ENTRIES_KEY = 'tb:entries';
const PROJECTS_KEY = 'tb:projects';
const DISMISSED_GOOGLE_KEY = 'tb:dismissed-google-events';
const RECURRING_MAPPINGS_KEY = 'tb:recurring-project-mappings';

@Injectable()
export class LocalStorageAdapter implements StoragePort {

  getEntries(from: Date, to: Date): Observable<TimeEntry[]> {
    const all = this.readAll<TimeEntry>(ENTRIES_KEY).map(e => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end),
    }));
    const filtered = all.filter(e => e.start >= from && e.start <= to);
    return of(filtered);
  }

  saveEntry(dto: CreateTimeEntryDTO): Observable<TimeEntry> {
    const entry: TimeEntry = { ...dto, id: crypto.randomUUID() };
    const all = this.readAll<TimeEntry>(ENTRIES_KEY);
    this.persist(ENTRIES_KEY, [...all, entry]);
    return of(entry);
  }

  updateEntry(id: string, changes: UpdateTimeEntryDTO): Observable<TimeEntry> {
    const all = this.readAll<TimeEntry>(ENTRIES_KEY);
    const index = all.findIndex(e => e.id === id);
    if (index === -1) return throwError(() => new Error(`Entry ${id} not found`));
    const updated = { ...all[index], ...changes };
    all[index] = updated;
    this.persist(ENTRIES_KEY, all);
    return of({ ...updated, start: new Date(updated.start), end: new Date(updated.end) });
  }

  deleteEntry(id: string): Observable<void> {
    const all = this.readAll<TimeEntry>(ENTRIES_KEY);
    const entry = all.find(e => e.id === id);
    if (entry?.googleEventId) {
      const dismissed = this.readAll<string>(DISMISSED_GOOGLE_KEY);
      if (!dismissed.includes(entry.googleEventId)) {
        this.persist(DISMISSED_GOOGLE_KEY, [...dismissed, entry.googleEventId]);
      }
    }
    this.persist(ENTRIES_KEY, all.filter(e => e.id !== id));
    return of(void 0);
  }

  deleteEntries(ids: string[]): Observable<string[]> {
    const idSet = new Set(ids);
    const all = this.readAll<TimeEntry>(ENTRIES_KEY);
    const toDelete = all.filter(e => idSet.has(e.id));
    const googleIds = toDelete.filter(e => e.googleEventId).map(e => e.googleEventId!);
    if (googleIds.length > 0) {
      const dismissed = this.readAll<string>(DISMISSED_GOOGLE_KEY);
      const newDismissed = [...new Set([...dismissed, ...googleIds])];
      this.persist(DISMISSED_GOOGLE_KEY, newDismissed);
    }
    this.persist(ENTRIES_KEY, all.filter(e => !idSet.has(e.id)));
    return of(googleIds);
  }

  getDismissedGoogleEventIds(): Observable<string[]> {
    return of(this.readAll<string>(DISMISSED_GOOGLE_KEY));
  }

  dismissGoogleEvent(eventId: string): Observable<void> {
    const dismissed = this.readAll<string>(DISMISSED_GOOGLE_KEY);
    if (!dismissed.includes(eventId)) {
      this.persist(DISMISSED_GOOGLE_KEY, [...dismissed, eventId]);
    }
    return of(void 0);
  }

  undismissGoogleEvent(eventId: string): Observable<void> {
    const dismissed = this.readAll<string>(DISMISSED_GOOGLE_KEY);
    this.persist(DISMISSED_GOOGLE_KEY, dismissed.filter(id => id !== eventId));
    return of(void 0);
  }

  clearDismissedGoogleEventIds(): Observable<void> {
    localStorage.removeItem(DISMISSED_GOOGLE_KEY);
    return of(void 0);
  }

  getRecurringProjectMappings(): Observable<Map<string, string>> {
    const obj: Record<string, string> = safeParse(localStorage.getItem(RECURRING_MAPPINGS_KEY), {});
    return of(new Map(Object.entries(obj)));
  }

  setRecurringProjectMapping(recurringEventId: string, projectId: string): Observable<void> {
    const obj: Record<string, string> = safeParse(localStorage.getItem(RECURRING_MAPPINGS_KEY), {});
    obj[recurringEventId] = projectId;
    localStorage.setItem(RECURRING_MAPPINGS_KEY, JSON.stringify(obj));
    return of(void 0);
  }

  deleteRecurringProjectMapping(recurringEventId: string): Observable<void> {
    const obj: Record<string, string> = safeParse(localStorage.getItem(RECURRING_MAPPINGS_KEY), {});
    delete obj[recurringEventId];
    localStorage.setItem(RECURRING_MAPPINGS_KEY, JSON.stringify(obj));
    return of(void 0);
  }

  getProjects(): Observable<Project[]> {
    const all = this.readAll<Project>(PROJECTS_KEY).map((p, i) => ({
      ...p,
      order: p.order ?? i,
      rate: p.rate ?? '',
    }));
    all.sort((a, b) => a.order - b.order);
    return of(all);
  }

  saveProject(dto: CreateProjectDTO): Observable<Project> {
    const all = this.readAll<Project>(PROJECTS_KEY);
    const maxOrder = all.reduce((max, p) => Math.max(max, p.order ?? 0), -1);
    const project: Project = { ...dto, id: crypto.randomUUID(), order: maxOrder + 1 };
    this.persist(PROJECTS_KEY, [...all, project]);
    return of(project);
  }

  updateProject(id: string, changes: Partial<Project>): Observable<Project> {
    const all = this.readAll<Project>(PROJECTS_KEY);
    const index = all.findIndex(p => p.id === id);
    if (index === -1) return throwError(() => new Error(`Project ${id} not found`));
    const updated = { ...all[index], ...changes };
    all[index] = updated;
    this.persist(PROJECTS_KEY, all);
    return of(updated);
  }

  deleteProject(id: string): Observable<void> {
    const all = this.readAll<Project>(PROJECTS_KEY);
    this.persist(PROJECTS_KEY, all.filter(p => p.id !== id));
    return of(void 0);
  }

  reorderProjects(orderedIds: string[]): Observable<Project[]> {
    const all = this.readAll<Project>(PROJECTS_KEY);
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
    const updated = all.map(p => ({ ...p, order: orderMap.get(p.id) ?? p.order ?? 999 }));
    updated.sort((a, b) => a.order - b.order);
    this.persist(PROJECTS_KEY, updated);
    return of(updated);
  }

  private readAll<T>(key: string): T[] {
    return safeParse(localStorage.getItem(key), []);
  }

  private persist<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
