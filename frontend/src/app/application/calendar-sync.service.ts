import { Injectable, inject } from '@angular/core';
import { TimeEntryStore } from '../state/time-entry.store';
import { UiStore } from '../state/ui.store';
import { CalendarEvent } from '../domain/models/calendar-event.model';

@Injectable({ providedIn: 'root' })
export class CalendarSyncService {
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly uiStore = inject(UiStore);

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
}
