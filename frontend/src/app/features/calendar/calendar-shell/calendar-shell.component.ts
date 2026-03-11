import { Component, inject, effect, untracked } from '@angular/core';
import { UiStore } from '../../../state/ui.store';
import { CalendarStore } from '../../../state/calendar.store';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
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
  private readonly projectStore = inject(ProjectStore);

  private lastLoadedRange = '';

  constructor() {
    effect(() => {
      const start = this.ui.weekStart();
      const end = this.ui.weekEnd();
      const rangeKey = `${start.getTime()}-${end.getTime()}`;
      if (rangeKey === this.lastLoadedRange) return;
      this.lastLoadedRange = rangeKey;
      untracked(() => this.timeEntryStore.loadEntries(start, end));
    });

    effect(() => {
      if (!this.ui.defaultProjectId()) {
        const first = this.projectStore.activeProjects()[0];
        if (first) untracked(() => this.ui.setDefaultProject(first.id));
      }
    });
  }
}
