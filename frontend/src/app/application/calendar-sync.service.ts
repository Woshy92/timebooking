import { Injectable, inject } from '@angular/core';
import { CalendarStore } from '../state/calendar.store';
import { TimeEntryStore } from '../state/time-entry.store';
import { UiStore } from '../state/ui.store';
import { CalendarEvent } from '../domain/models/calendar-event.model';

@Injectable({ providedIn: 'root' })
export class CalendarSyncService {
  private readonly calendarStore = inject(CalendarStore);
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly uiStore = inject(UiStore);

  syncCurrentWeek(): void {
    const start = this.uiStore.weekStart();
    const end = this.uiStore.weekEnd();
    this.calendarStore.fetchEvents(start, end);
  }

  importEvent(event: CalendarEvent): void {
    this.timeEntryStore.addEntry({
      title: event.title,
      start: event.start,
      end: event.end,
      projectId: this.uiStore.defaultProjectId() ?? undefined,
      source: 'google',
      googleEventId: event.id,
    });
  }

  importAllUnbooked(): void {
    const existingGoogleIds = new Set(
      this.timeEntryStore.entries()
        .filter(e => e.googleEventId)
        .map(e => e.googleEventId)
    );
    for (const event of this.calendarStore.events()) {
      if (!existingGoogleIds.has(event.id)) {
        this.importEvent(event);
      }
    }
  }
}
