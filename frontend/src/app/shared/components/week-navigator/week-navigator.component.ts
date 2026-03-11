import { Component, inject, computed } from '@angular/core';
import { UiStore } from '../../../state/ui.store';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { getISOWeek } from 'date-fns';

@Component({
  selector: 'app-week-navigator',
  standalone: true,
  template: `
    <div class="flex items-center gap-2">
      <button
        (click)="ui.navigateWeek('prev')"
        class="p-1.5 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <button
        (click)="ui.goToToday()"
        class="px-2.5 py-1 text-xs font-medium rounded-md hover:bg-gray-800 hover:text-white transition-colors"
      >
        Heute
      </button>

      <button
        (click)="ui.navigateWeek('next')"
        class="p-1.5 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <div class="ml-1.5">
        <div class="text-xs font-semibold text-white">KW {{ weekNumber() }}</div>
        <div class="text-[10px] text-gray-500">{{ dateRange() }}</div>
      </div>
    </div>
  `,
})
export class WeekNavigatorComponent {
  protected readonly ui = inject(UiStore);

  readonly weekNumber = computed(() => getISOWeek(this.ui.activeDate()));

  readonly dateRange = computed(() => {
    const start = format(this.ui.weekStart(), 'dd. MMM', { locale: de });
    const end = format(this.ui.weekEnd(), 'dd. MMM yyyy', { locale: de });
    return `${start} – ${end}`;
  });
}
