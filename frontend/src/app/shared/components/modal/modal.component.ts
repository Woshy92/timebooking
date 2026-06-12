import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/** Selector for elements that can receive keyboard focus inside the dialog. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let nextModalId = 0;

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="onBackdropClick($event)"
      (keydown)="onKeydown($event)"
    >
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        tabindex="-1"
        class="relative bg-white rounded-2xl shadow-2xl w-full border border-gray-100 animate-modal-in outline-none"
        [style.max-width]="maxWidth()"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 [id]="titleId" class="text-lg font-semibold text-gray-900">{{ title() }}</h2>
          <button
            (click)="closed.emit()"
            aria-label="Schließen"
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

  /** Unique id linking the dialog (aria-labelledby) to its title heading. */
  protected readonly titleId = `app-modal-title-${nextModalId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Element that was focused before the modal opened; focus returns there on close. */
  private readonly previouslyFocused: HTMLElement | null =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  constructor() {
    // Move focus into the dialog once it has rendered: prefer the first
    // focusable element, fall back to the container (tabindex="-1").
    afterNextRender(() => {
      const target = this.focusableElements()[0] ?? this.dialogElement();
      target?.focus();
    });
    inject(DestroyRef).onDestroy(() => this.previouslyFocused?.focus());
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Keep document-level Escape handlers (e.g. draft/popover handling in
      // the calendar views) from also reacting while the modal is open.
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    // Focus trap: Tab/Shift+Tab cycle within the dialog.
    const dialogEl = this.dialogElement();
    if (!dialogEl) return;
    const focusable = this.focusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      dialogEl.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogEl)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private dialogElement(): HTMLElement | null {
    return this.host.nativeElement.querySelector('[role="dialog"]');
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(this.dialogElement()?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
  }
}
