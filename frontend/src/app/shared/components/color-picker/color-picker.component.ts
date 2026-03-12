import { Component, input, output } from '@angular/core';

export const PRESET_COLORS = [
  '#4F46E5', '#7C3AED', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#64748B', '#78716C', '#0EA5E9', '#D946EF',
];

@Component({
  selector: 'app-color-picker',
  standalone: true,
  template: `
    <div class="grid grid-cols-8 gap-2">
      @for (color of colors; track color) {
        <button
          type="button"
          (click)="colorChange.emit(color)"
          class="w-8 h-8 rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
          [style.background-color]="color"
          [class.ring-2]="color === value()"
          [class.ring-offset-2]="color === value()"
          [class.ring-gray-900]="color === value()"
        ></button>
      }
    </div>
    <div class="flex items-center gap-2 mt-3">
      <div class="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0"
           [style.background-color]="value()"></div>
      <input
        type="text"
        [value]="value()"
        (input)="onHexInput($event)"
        class="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-lg
               focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        placeholder="#000000"
        maxlength="7"
      />
    </div>
  `,
})
export class ColorPickerComponent {
  value = input<string>('#4F46E5');
  colorChange = output<string>();
  readonly colors = PRESET_COLORS;

  onHexInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      this.colorChange.emit(val);
    }
  }
}
