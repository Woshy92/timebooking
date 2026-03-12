import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, withHooks, patchState } from '@ngrx/signals';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../domain/models/time-entry.model';
import { STORAGE_PORT } from '../domain/ports/storage.port';
import { computeGapFills } from '../shared/utils/gap-filler';

interface TimeEntryState {
  entries: TimeEntry[];
  loading: boolean;
  error: string | null;
  dismissedGoogleEventIds: string[];
  recurringProjectMappings: Map<string, string>;
}

export const TimeEntryStore = signalStore(
  { providedIn: 'root' },
  withState<TimeEntryState>({
    entries: [],
    loading: false,
    error: null,
    dismissedGoogleEventIds: [],
    recurringProjectMappings: new Map<string, string>(),
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
      entries().filter(e => !e.pause).reduce((sum, e) => sum + (e.end.getTime() - e.start.getTime()) / 3600000, 0)
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
      removeEntries(ids: string[]) {
        storage.deleteEntries(ids).subscribe({
          next: (dismissedGoogleIds) => {
            const idSet = new Set(ids);
            const updates: Partial<TimeEntryState> = {
              entries: store.entries().filter(e => !idSet.has(e.id)),
            };
            if (dismissedGoogleIds.length > 0) {
              updates.dismissedGoogleEventIds = [...new Set([...store.dismissedGoogleEventIds(), ...dismissedGoogleIds])];
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
      dismissGoogleEvent(eventId: string) {
        storage.dismissGoogleEvent(eventId).subscribe({
          next: () => patchState(store, {
            dismissedGoogleEventIds: [...store.dismissedGoogleEventIds(), eventId],
          }),
        });
      },
      undismissGoogleEvent(eventId: string) {
        storage.undismissGoogleEvent(eventId).subscribe({
          next: () => patchState(store, {
            dismissedGoogleEventIds: store.dismissedGoogleEventIds().filter(id => id !== eventId),
          }),
        });
      },
      clearDismissedGoogleEventIds() {
        storage.clearDismissedGoogleEventIds().subscribe({
          next: () => patchState(store, { dismissedGoogleEventIds: [] }),
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
      loadRecurringProjectMappings() {
        storage.getRecurringProjectMappings().subscribe({
          next: (mappings) => patchState(store, { recurringProjectMappings: mappings }),
        });
      },
      setRecurringProjectMapping(recurringEventId: string, projectId: string) {
        storage.setRecurringProjectMapping(recurringEventId, projectId).subscribe({
          next: () => {
            const updated = new Map(store.recurringProjectMappings());
            updated.set(recurringEventId, projectId);
            patchState(store, { recurringProjectMappings: updated });
          },
        });
      },
      deleteRecurringProjectMapping(recurringEventId: string) {
        storage.deleteRecurringProjectMapping(recurringEventId).subscribe({
          next: () => {
            const updated = new Map(store.recurringProjectMappings());
            updated.delete(recurringEventId);
            patchState(store, { recurringProjectMappings: updated });
          },
        });
      },
    };
  }),
  withMethods((store) => ({
    fillGaps() {
      const entries = store.entries();
      if (entries.length === 0) return;

      const byDay = new Map<string, TimeEntry[]>();
      for (const e of entries) {
        const dayKey = new Date(e.start).toDateString();
        const list = byDay.get(dayKey) ?? [];
        list.push(e);
        byDay.set(dayKey, list);
      }

      for (const dayEntries of byDay.values()) {
        const adjustments = computeGapFills(dayEntries);
        for (const adj of adjustments) {
          store.updateEntry(adj.id, {
            ...(adj.start && { start: adj.start }),
            ...(adj.end && { end: adj.end }),
          });
        }
      }
    },
  })),
  withHooks({
    onInit(store) {
      store.loadDismissedGoogleEventIds();
      store.loadRecurringProjectMappings();
    },
  })
);
