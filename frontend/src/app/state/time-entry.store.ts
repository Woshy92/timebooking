import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, withHooks, patchState } from '@ngrx/signals';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../domain/models/time-entry.model';
import { STORAGE_PORT } from '../domain/ports/storage.port';

interface TimeEntryState {
  entries: TimeEntry[];
  loading: boolean;
  error: string | null;
  dismissedGoogleEventIds: string[];
}

export const TimeEntryStore = signalStore(
  { providedIn: 'root' },
  withState<TimeEntryState>({
    entries: [],
    loading: false,
    error: null,
    dismissedGoogleEventIds: [],
  }),
  withComputed(({ entries }) => ({
    entriesByProject: computed(() => {
      const map = new Map<string, TimeEntry[]>();
      for (const entry of entries()) {
        const key = entry.projectId ?? 'unassigned';
        const list = map.get(key) ?? [];
        list.push(entry);
        map.set(key, list);
      }
      return map;
    }),
    totalHours: computed(() =>
      entries().reduce((sum, e) => sum + (e.end.getTime() - e.start.getTime()) / 3600000, 0)
    ),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_PORT);
    return {
      loadEntries(from: Date, to: Date) {
        patchState(store, { loading: true });
        storage.getEntries(from, to).subscribe({
          next: (entries) => patchState(store, { entries, loading: false }),
          error: (err) => patchState(store, { error: String(err), loading: false }),
        });
      },
      addEntry(dto: CreateTimeEntryDTO) {
        storage.saveEntry(dto).subscribe({
          next: (entry) => patchState(store, { entries: [...store.entries(), entry] }),
          error: (err) => patchState(store, { error: String(err) }),
        });
      },
      updateEntry(id: string, changes: UpdateTimeEntryDTO) {
        storage.updateEntry(id, changes).subscribe({
          next: (updated) => patchState(store, {
            entries: store.entries().map(e => e.id === id ? updated : e),
          }),
          error: (err) => patchState(store, { error: String(err) }),
        });
      },
      removeEntry(id: string) {
        const entry = store.entries().find(e => e.id === id);
        storage.deleteEntry(id).subscribe({
          next: () => {
            const updates: Partial<TimeEntryState> = {
              entries: store.entries().filter(e => e.id !== id),
            };
            if (entry?.googleEventId) {
              updates.dismissedGoogleEventIds = [...store.dismissedGoogleEventIds(), entry.googleEventId];
            }
            patchState(store, updates);
          },
          error: (err) => patchState(store, { error: String(err) }),
        });
      },
      loadDismissedGoogleEventIds() {
        storage.getDismissedGoogleEventIds().subscribe({
          next: (ids) => patchState(store, { dismissedGoogleEventIds: ids }),
        });
      },
      assignProject(entryId: string, projectId: string | undefined) {
        const entry = store.entries().find(e => e.id === entryId);
        if (!entry) return;
        storage.updateEntry(entryId, { projectId }).subscribe({
          next: (updated) => patchState(store, {
            entries: store.entries().map(e => e.id === entryId ? updated : e),
          }),
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.loadDismissedGoogleEventIds();
    },
  })
);
