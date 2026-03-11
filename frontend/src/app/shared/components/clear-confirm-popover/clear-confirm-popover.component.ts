import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-clear-confirm-popover',
  standalone: true,
  template: `
    <div class="relative">
      <button (click)="open.set(true)"
        class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
        [title]="title()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
      @if (open()) {
        <div class="fixed inset-0 z-30" (click)="open.set(false)"></div>
        <div class="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-40 animate-pop-in">
          <p class="text-xs text-gray-600 mb-2">
            @if (entryCount() > 0 && googleEventCount() > 0) {
              <strong>{{ entryCount() }}</strong> Einträge und <strong>{{ googleEventCount() }}</strong> Kalendervorschläge {{ label() }} löschen?
            } @else if (entryCount() > 0) {
              Alle <strong>{{ entryCount() }}</strong> Einträge {{ label() }} löschen?
            } @else if (googleEventCount() > 0) {
              Alle <strong>{{ googleEventCount() }}</strong> Kalendervorschläge {{ label() }} löschen?
            }
          </p>
          <div class="flex gap-2">
            <button (click)="open.set(false)"
              class="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
              Abbrechen
            </button>
            <button (click)="onConfirm()"
              class="flex-1 px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors">
              Löschen
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ClearConfirmPopoverComponent {
  entryCount = input.required<number>();
  googleEventCount = input(0);
  label = input.required<string>();
  title = input('Leeren');
  confirm = output<void>();

  open = signal(false);

  onConfirm() {
    this.confirm.emit();
    this.open.set(false);
  }
}
