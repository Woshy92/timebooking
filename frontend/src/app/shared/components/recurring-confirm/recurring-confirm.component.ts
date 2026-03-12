import { Component, input, output } from '@angular/core';
import { RecurringConfirmState } from '../../models/calendar-view.models';

@Component({
  selector: 'app-recurring-confirm',
  standalone: true,
  template: `
    @if (state(); as rc) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"
           (click)="dismiss.emit()">
        <div class="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm mx-4"
             (click)="$event.stopPropagation()">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span class="text-sm font-semibold text-gray-900">Serientermin</span>
          </div>
          <p class="text-sm text-gray-600 mb-3">
            Soll <span class="font-medium" [style.color]="rc.projectColor">{{ rc.projectName }}</span>
            als Standard für zukünftige Termine dieser Serie gelten?
          </p>
          <div class="flex gap-2 justify-end">
            <button (click)="dismiss.emit()"
                    class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
              Nein
            </button>
            <button (click)="confirm.emit()"
                    class="px-3 py-1.5 text-xs font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 transition-colors">
              Ja, für zukünftige
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RecurringConfirmComponent {
  state = input<RecurringConfirmState | null>(null);
  confirm = output<void>();
  dismiss = output<void>();
}
