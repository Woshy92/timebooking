import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="onBackdropClick($event)"
    >
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>
      <div
        class="relative bg-white rounded-2xl shadow-2xl w-full border border-gray-100 animate-modal-in"
        [style.max-width]="maxWidth()"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">{{ title() }}</h2>
          <button
            (click)="closed.emit()"
            class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="p-6">
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes modal-in {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .animate-modal-in {
      animation: modal-in 0.2s ease-out;
    }
  `],
})
export class ModalComponent {
  title = input.required<string>();
  maxWidth = input<string>('480px');
  closed = output<void>();

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
