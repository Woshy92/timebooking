import { Component, inject, effect, signal } from '@angular/core';
import { UndoStore } from '../../../state/undo.store';
import { TimeEntryStore } from '../../../state/time-entry.store';

const UNDO_TIMEOUT = 6000;

@Component({
  selector: 'app-undo-toast',
  standalone: true,
  template: `
    @if (undoStore.action(); as action) {
      @if (!dismissed()) {
        <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-pop-in">
          <div class="bg-gray-900 text-white pl-4 pr-3 py-2.5 rounded-xl shadow-xl flex items-center gap-3">
            <span class="text-sm">
              {{ action.entries.length === 1 ? '1 Eintrag' : action.entries.length + ' Einträge' }} gelöscht
            </span>
            <button
              (click)="undo()"
              class="px-3 py-1 text-sm font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              Rückgängig
            </button>
          </div>
        </div>
      }
    }
  `,
})
export class UndoToastComponent {
  readonly undoStore = inject(UndoStore);
  private readonly timeEntryStore = inject(TimeEntryStore);

  dismissed = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const action = this.undoStore.action();
      if (action) {
        this.dismissed.set(false);
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.undoStore.clear();
          this.dismissed.set(true);
        }, UNDO_TIMEOUT);
      }
    });
  }

  undo() {
    const action = this.undoStore.action();
    if (!action) return;
    for (const entry of action.entries) {
      this.timeEntryStore.addEntry({
        title: entry.title,
        start: entry.start,
        end: entry.end,
        projectId: entry.projectId,
        source: entry.source,
        googleEventId: entry.googleEventId,
        notes: entry.notes,
      });
    }
    this.undoStore.clear();
    this.dismissed.set(true);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
