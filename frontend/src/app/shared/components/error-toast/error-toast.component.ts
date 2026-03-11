import { Component, inject, computed, signal, effect } from '@angular/core';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';

@Component({
  selector: 'app-error-toast',
  standalone: true,
  template: `
    @if (visibleError(); as error) {
      <div class="fixed bottom-4 right-4 z-50 max-w-sm animate-pop-in">
        <div class="bg-red-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-3">
          <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">Fehler</div>
            <div class="text-xs text-red-100 mt-0.5 break-words">{{ error }}</div>
          </div>
          <button (click)="dismiss()" class="p-1 hover:bg-red-700 rounded transition-colors flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    }
  `,
})
export class ErrorToastComponent {
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);

  private dismissed = signal(false);
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  readonly latestError = computed(() =>
    this.timeEntryStore.error() ?? this.projectStore.error() ?? this.calendarStore.error() ?? null
  );

  readonly visibleError = computed(() =>
    this.dismissed() ? null : this.latestError()
  );

  constructor() {
    effect(() => {
      const err = this.latestError();
      if (err) {
        this.dismissed.set(false);
        if (this.dismissTimer) clearTimeout(this.dismissTimer);
        this.dismissTimer = setTimeout(() => this.dismissed.set(true), 5000);
      }
    });
  }

  dismiss() {
    this.dismissed.set(true);
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}
