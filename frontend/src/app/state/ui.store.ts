import { computed } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays } from 'date-fns';

export type CalendarViewMode = 'week' | 'day';

interface UiState {
  activeView: CalendarViewMode;
  activeDate: Date;
  selectedEntryId: string | null;
  isEntryModalOpen: boolean;
  isProjectPanelOpen: boolean;
  isExportPanelOpen: boolean;
  defaultProjectId: string | null;
  highlightGaps: boolean;
  viewStartHour: number;
  viewEndHour: number;
  exportFromDate: string | null;
  exportToDate: string | null;
}

const DEFAULT_PROJECT_KEY = 'tb:default-project-id';

// localStorage is only touched lazily (store creation / method calls), never
// at module evaluation — keeps this module SSR-safe.
function readPersistedDefaultProjectId(): string | null {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem(DEFAULT_PROJECT_KEY)
    : null;
}

const initialState: UiState = {
  activeView: 'week',
  activeDate: new Date(),
  selectedEntryId: null,
  isEntryModalOpen: false,
  isProjectPanelOpen: false,
  isExportPanelOpen: false,
  defaultProjectId: null,
  highlightGaps: false,
  viewStartHour: 7,
  viewEndHour: 19,
  exportFromDate: null,
  exportToDate: null,
};

export const UiStore = signalStore(
  { providedIn: 'root' },
  withState(() => ({
    ...initialState,
    activeDate: new Date(),
    defaultProjectId: readPersistedDefaultProjectId(),
  })),
  withComputed(({ activeDate }) => ({
    weekStart: computed(() => startOfWeek(activeDate(), { weekStartsOn: 1 })),
    weekEnd: computed(() => endOfWeek(activeDate(), { weekStartsOn: 1 })),
  })),
  withMethods((store) => ({
    setView(view: CalendarViewMode) {
      patchState(store, { activeView: view });
    },
    navigateWeek(direction: 'prev' | 'next') {
      patchState(store, {
        activeDate: direction === 'next'
          ? addWeeks(store.activeDate(), 1)
          : subWeeks(store.activeDate(), 1),
      });
    },
    navigateDay(direction: 'prev' | 'next') {
      patchState(store, {
        activeDate: direction === 'next'
          ? addDays(store.activeDate(), 1)
          : subDays(store.activeDate(), 1),
      });
    },
    goToToday() {
      patchState(store, { activeDate: new Date() });
    },
    selectEntry(id: string | null) {
      patchState(store, { selectedEntryId: id, isEntryModalOpen: id !== null });
    },
    openNewEntryModal() {
      patchState(store, { selectedEntryId: null, isEntryModalOpen: true });
    },
    closeEntryModal() {
      patchState(store, { selectedEntryId: null, isEntryModalOpen: false });
    },
    toggleProjectPanel() {
      patchState(store, { isProjectPanelOpen: !store.isProjectPanelOpen() });
    },
    toggleExportPanel() {
      patchState(store, { isExportPanelOpen: !store.isExportPanelOpen() });
    },
    closeAllPanels() {
      patchState(store, { isProjectPanelOpen: false, isExportPanelOpen: false });
    },
    toggleHighlightGaps() {
      patchState(store, { highlightGaps: !store.highlightGaps() });
    },
    setViewStartHour(hour: number) {
      patchState(store, { viewStartHour: Math.max(0, Math.min(hour, store.viewEndHour() - 2)) });
    },
    setViewEndHour(hour: number) {
      patchState(store, { viewEndHour: Math.max(store.viewStartHour() + 2, Math.min(hour, 24)) });
    },
    setExportDateRange(from: string, to: string) {
      patchState(store, { exportFromDate: from, exportToDate: to });
    },
    setDefaultProject(projectId: string | null) {
      patchState(store, { defaultProjectId: projectId });
      if (typeof localStorage === 'undefined') return;
      if (projectId) {
        localStorage.setItem(DEFAULT_PROJECT_KEY, projectId);
      } else {
        localStorage.removeItem(DEFAULT_PROJECT_KEY);
      }
    },
  }))
);
