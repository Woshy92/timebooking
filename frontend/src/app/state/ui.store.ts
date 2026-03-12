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
}

const DEFAULT_PROJECT_KEY = 'tb:default-project-id';

const initialState: UiState = {
  activeView: 'week',
  activeDate: new Date(),
  selectedEntryId: null,
  isEntryModalOpen: false,
  isProjectPanelOpen: false,
  isExportPanelOpen: false,
  defaultProjectId: localStorage.getItem(DEFAULT_PROJECT_KEY),
  highlightGaps: false,
  viewStartHour: 7,
  viewEndHour: 19,
};

export const UiStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
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
    openNewEntryModal(start?: Date, end?: Date) {
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
    setDefaultProject(projectId: string | null) {
      patchState(store, { defaultProjectId: projectId });
      if (projectId) {
        localStorage.setItem(DEFAULT_PROJECT_KEY, projectId);
      } else {
        localStorage.removeItem(DEFAULT_PROJECT_KEY);
      }
    },
  }))
);
