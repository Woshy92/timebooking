import { Component, inject, effect } from '@angular/core';
import { UiStore } from '../../../state/ui.store';
import { CalendarStore } from '../../../state/calendar.store';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { WeekViewComponent } from '../week-view/week-view.component';
import { DayViewComponent } from '../day-view/day-view.component';

@Component({
  selector: 'app-calendar-shell',
  standalone: true,
  imports: [WeekViewComponent, DayViewComponent],
  template: `
    @switch (ui.activeView()) {
      @case ('week') {
        <app-week-view />
      }
      @case ('day') {
        <app-day-view />
      }
    }
  `,
  styles: [`:host { display: flex; flex-direction: column; height: 100%; }`],
})
export class CalendarShellComponent {
  protected readonly ui = inject(UiStore);
  private readonly calendarStore = inject(CalendarStore);
  private readonly timeEntryStore = inject(TimeEntryStore);

  constructor() {
    effect(() => {
      const start = this.ui.weekStart();
      const end = this.ui.weekEnd();
      this.timeEntryStore.loadEntries(start, end);
      if (this.calendarStore.authenticated()) {
        this.calendarStore.fetchEvents(start, end);
      }
    });
  }
}
