import { Component, input, output } from '@angular/core';

const PRESET_COLORS = [
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
  `,
})
export class ColorPickerComponent {
  value = input<string>('#4F46E5');
  colorChange = output<string>();
  readonly colors = PRESET_COLORS;
}
