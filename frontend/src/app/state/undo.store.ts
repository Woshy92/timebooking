import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { TimeEntry } from '../domain/models/time-entry.model';

export interface UndoAction {
  type: 'delete';
  entries: TimeEntry[];
  timestamp: number;
}

interface UndoState {
  action: UndoAction | null;
}

export const UndoStore = signalStore(
  { providedIn: 'root' },
  withState<UndoState>({ action: null }),
  withMethods((store) => ({
    pushDelete(entries: TimeEntry[]) {
      patchState(store, {
        action: { type: 'delete', entries, timestamp: Date.now() },
      });
    },
    clear() {
      patchState(store, { action: null });
    },
  }))
);
