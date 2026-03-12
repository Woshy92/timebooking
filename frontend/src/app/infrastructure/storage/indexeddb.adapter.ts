import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { StoragePort } from '../../domain/ports/storage.port';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../../domain/models/time-entry.model';
import { Project, CreateProjectDTO } from '../../domain/models/project.model';

const DB_NAME = 'timebooking';
const DB_VERSION = 2;

const STORES = {
  entries: 'entries',
  projects: 'projects',
  dismissed: 'dismissedGoogleEvents',
  recurringMappings: 'recurringProjectMappings',
} as const;

@Injectable()
export class IndexedDbAdapter implements StoragePort {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.entries)) {
          const entryStore = db.createObjectStore(STORES.entries, { keyPath: 'id' });
          entryStore.createIndex('start', 'start', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.projects)) {
          db.createObjectStore(STORES.projects, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.dismissed)) {
          db.createObjectStore(STORES.dismissed, { keyPath: 'eventId' });
        }
        if (!db.objectStoreNames.contains(STORES.recurringMappings)) {
          db.createObjectStore(STORES.recurringMappings, { keyPath: 'recurringEventId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private async tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async txAll<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T[]>): Promise<T[]> {
    return this.tx(storeName, 'readonly', fn);
  }

  // ─── Time Entries ──────────────────────────────────────

  getEntries(fromDate: Date, toDate: Date): Observable<TimeEntry[]> {
    return from(this.loadEntries(fromDate, toDate));
  }

  private async loadEntries(fromDate: Date, toDate: Date): Promise<TimeEntry[]> {
    const all = await this.txAll<TimeEntry>(STORES.entries, s => s.getAll());
    return all
      .map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }))
      .filter(e => e.start >= fromDate && e.start <= toDate);
  }

  saveEntry(dto: CreateTimeEntryDTO): Observable<TimeEntry> {
    const entry: TimeEntry = { ...dto, id: crypto.randomUUID() };
    return from(this.tx(STORES.entries, 'readwrite', s => s.put(entry)).then(() => entry));
  }

  updateEntry(id: string, changes: UpdateTimeEntryDTO): Observable<TimeEntry> {
    return from(this.doUpdateEntry(id, changes));
  }

  private async doUpdateEntry(id: string, changes: UpdateTimeEntryDTO): Promise<TimeEntry> {
    const existing = await this.tx<TimeEntry>(STORES.entries, 'readonly', s => s.get(id));
    if (!existing) throw new Error(`Entry ${id} not found`);
    const updated = { ...existing, ...changes };
    await this.tx(STORES.entries, 'readwrite', s => s.put(updated));
    return { ...updated, start: new Date(updated.start), end: new Date(updated.end) };
  }

  deleteEntry(id: string): Observable<void> {
    return from(this.doDeleteEntry(id));
  }

  private async doDeleteEntry(id: string): Promise<void> {
    const existing = await this.tx<TimeEntry>(STORES.entries, 'readonly', s => s.get(id));
    if (existing?.googleEventId) {
      await this.tx(STORES.dismissed, 'readwrite', s => s.put({ eventId: existing.googleEventId }));
    }
    await this.tx(STORES.entries, 'readwrite', s => s.delete(id));
  }

  deleteEntries(ids: string[]): Observable<string[]> {
    return from(this.doDeleteEntries(ids));
  }

  private async doDeleteEntries(ids: string[]): Promise<string[]> {
    const dismissedGoogleIds: string[] = [];
    for (const id of ids) {
      const existing = await this.tx<TimeEntry>(STORES.entries, 'readonly', s => s.get(id));
      if (existing?.googleEventId) {
        dismissedGoogleIds.push(existing.googleEventId);
        await this.tx(STORES.dismissed, 'readwrite', s => s.put({ eventId: existing.googleEventId }));
      }
      await this.tx(STORES.entries, 'readwrite', s => s.delete(id));
    }
    return dismissedGoogleIds;
  }

  // ─── Dismissed Google Events ───────────────────────────

  getDismissedGoogleEventIds(): Observable<string[]> {
    return from(
      this.txAll<{ eventId: string }>(STORES.dismissed, s => s.getAll())
        .then(items => items.map(i => i.eventId))
    );
  }

  dismissGoogleEvent(eventId: string): Observable<void> {
    return from(this.tx(STORES.dismissed, 'readwrite', s => s.put({ eventId })).then(() => {}));
  }

  clearDismissedGoogleEventIds(): Observable<void> {
    return from(this.tx(STORES.dismissed, 'readwrite', s => s.clear()).then(() => {}));
  }

  // ─── Recurring Project Mappings ───────────────────────

  getRecurringProjectMappings(): Observable<Map<string, string>> {
    return from(
      this.txAll<{ recurringEventId: string; projectId: string }>(STORES.recurringMappings, s => s.getAll())
        .then(items => new Map(items.map(i => [i.recurringEventId, i.projectId])))
    );
  }

  setRecurringProjectMapping(recurringEventId: string, projectId: string): Observable<void> {
    return from(
      this.tx(STORES.recurringMappings, 'readwrite', s => s.put({ recurringEventId, projectId })).then(() => {})
    );
  }

  deleteRecurringProjectMapping(recurringEventId: string): Observable<void> {
    return from(
      this.tx(STORES.recurringMappings, 'readwrite', s => s.delete(recurringEventId)).then(() => {})
    );
  }

  // ─── Projects ──────────────────────────────────────────

  getProjects(): Observable<Project[]> {
    return from(
      this.txAll<Project>(STORES.projects, s => s.getAll())
        .then(all => {
          all.forEach((p, i) => { p.order = p.order ?? i; p.rate = p.rate ?? ''; });
          all.sort((a, b) => a.order - b.order);
          return all;
        })
    );
  }

  saveProject(dto: CreateProjectDTO): Observable<Project> {
    return from(this.doSaveProject(dto));
  }

  private async doSaveProject(dto: CreateProjectDTO): Promise<Project> {
    const all = await this.txAll<Project>(STORES.projects, s => s.getAll());
    const maxOrder = all.reduce((max, p) => Math.max(max, p.order ?? 0), -1);
    const project: Project = { ...dto, id: crypto.randomUUID(), order: maxOrder + 1 };
    await this.tx(STORES.projects, 'readwrite', s => s.put(project));
    return project;
  }

  updateProject(id: string, changes: Partial<Project>): Observable<Project> {
    return from(this.doUpdateProject(id, changes));
  }

  private async doUpdateProject(id: string, changes: Partial<Project>): Promise<Project> {
    const existing = await this.tx<Project>(STORES.projects, 'readonly', s => s.get(id));
    if (!existing) throw new Error(`Project ${id} not found`);
    const updated = { ...existing, ...changes };
    await this.tx(STORES.projects, 'readwrite', s => s.put(updated));
    return updated;
  }

  deleteProject(id: string): Observable<void> {
    return from(this.tx(STORES.projects, 'readwrite', s => s.delete(id)).then(() => {}));
  }

  reorderProjects(orderedIds: string[]): Observable<Project[]> {
    return from(this.doReorderProjects(orderedIds));
  }

  private async doReorderProjects(orderedIds: string[]): Promise<Project[]> {
    const all = await this.txAll<Project>(STORES.projects, s => s.getAll());
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
    const updated = all.map(p => ({ ...p, order: orderMap.get(p.id) ?? p.order ?? 999 }));
    updated.sort((a, b) => a.order - b.order);

    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.projects, 'readwrite');
      const store = tx.objectStore(STORES.projects);
      for (const p of updated) store.put(p);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return updated;
  }
}
