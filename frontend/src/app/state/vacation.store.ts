import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { format } from 'date-fns';

const VACATION_KEY = 'tb:vacation-days';

export const VacationStore = signalStore(
  { providedIn: 'root' },
  withState({ days: [] as string[] }),
  withComputed(({ days }) => ({
    daySet: computed(() => new Set(days())),
  })),
  withMethods((store) => ({
    toggleDay(date: Date) {
      const key = format(date, 'yyyy-MM-dd');
      const current = store.days();
      const updated = current.includes(key)
        ? current.filter(d => d !== key)
        : [...current, key];
      patchState(store, { days: updated });
      localStorage.setItem(VACATION_KEY, JSON.stringify(updated));
    },
    isVacation(date: Date): boolean {
      return store.daySet().has(format(date, 'yyyy-MM-dd'));
    },
  })),
  withHooks({
    onInit(store) {
      const raw = localStorage.getItem(VACATION_KEY);
      if (raw) {
        try { patchState(store, { days: JSON.parse(raw) }); } catch { /* ignore corrupt data */ }
      }
    },
  })
);
