import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import { ImportWizardComponent } from './import-wizard.component';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { CalendarSyncService } from '../../../application/calendar-sync.service';
import { CalendarEvent } from '../../../domain/models/calendar-event.model';
import { TimeEntry } from '../../../domain/models/time-entry.model';

/**
 * Stateful mock of the TimeEntryStore that mirrors the real store's semantics relevant to the
 * wizard: addEntry appends an entry with a fresh id; removeEntry deletes it AND dismisses its
 * googleEventId (the side effect the wizard must reverse); undismiss/dismiss/mapping methods
 * mutate the same backing signals so the component's computeds stay consistent.
 */
function createTimeEntryStoreMock() {
  const entries = signal<TimeEntry[]>([]);
  const dismissedGoogleEventIds = signal<string[]>([]);
  const recurringProjectMappings = signal<{ recurringEventId: string; projectId: string }[]>([]);
  let nextId = 1;

  const recurringMappingMap = () =>
    new Map(recurringProjectMappings().map(m => [m.recurringEventId, m.projectId]));

  return {
    entries,
    dismissedGoogleEventIds,
    recurringProjectMappings,
    recurringMappingMap,

    addEntry: vi.fn((dto: Omit<TimeEntry, 'id'>) => {
      const entry: TimeEntry = { ...dto, id: `entry-${nextId++}` };
      entries.update(list => [...list, entry]);
    }),
    removeEntry: vi.fn((id: string) => {
      const entry = entries().find(e => e.id === id);
      entries.update(list => list.filter(e => e.id !== id));
      if (entry?.googleEventId) {
        dismissedGoogleEventIds.update(ids => [...ids, entry.googleEventId!]);
      }
    }),
    dismissGoogleEvent: vi.fn((eventId: string) => {
      dismissedGoogleEventIds.update(ids => [...ids, eventId]);
    }),
    undismissGoogleEvent: vi.fn((eventId: string) => {
      dismissedGoogleEventIds.update(ids => ids.filter(id => id !== eventId));
    }),
    setRecurringProjectMapping: vi.fn((recurringEventId: string, projectId: string) => {
      recurringProjectMappings.update(list => [
        ...list.filter(m => m.recurringEventId !== recurringEventId),
        { recurringEventId, projectId },
      ]);
    }),
    deleteRecurringProjectMapping: vi.fn((recurringEventId: string) => {
      recurringProjectMappings.update(list => list.filter(m => m.recurringEventId !== recurringEventId));
    }),
  };
}

function ev(id: string, partial: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    title: partial.title ?? `Event ${id}`,
    start: partial.start ?? new Date(2026, 5, 12, 9, 0),
    end: partial.end ?? new Date(2026, 5, 12, 10, 0),
    source: 'google',
    recurringEventId: partial.recurringEventId,
    description: partial.description,
    attendees: partial.attendees,
  };
}

describe('ImportWizardComponent.goBack', () => {
  let timeEntryStore: ReturnType<typeof createTimeEntryStoreMock>;

  beforeAll(() => {
    // No global Angular test setup file exists in this project; initialize it here.
    // initTestEnvironment throws if already initialized, which is harmless for this suite.
    try {
      TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch {
      // already initialized by another spec
    }
  });

  function setup() {
    timeEntryStore = createTimeEntryStoreMock();

    const calendarSync = {
      importEvent: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ImportWizardComponent,
        { provide: TimeEntryStore, useValue: timeEntryStore },
        { provide: ProjectStore, useValue: { activeProjects: () => [] } },
        // Empty + unauthenticated calendar so the constructor's afterInit goes straight to
        // startImport() with an empty snapshot and does not interfere with the manual setup.
        {
          provide: CalendarStore,
          useValue: {
            events: () => [],
            authenticated: () => false,
            loading: () => false,
            fetchEvents: vi.fn(),
          },
        },
        {
          provide: UiStore,
          useValue: {
            weekStart: () => new Date(2026, 5, 8),
            weekEnd: () => new Date(2026, 5, 14),
            defaultProjectId: () => undefined,
          },
        },
        { provide: CalendarSyncService, useValue: calendarSync },
      ],
    });

    const component = TestBed.inject(ImportWizardComponent);
    return component;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('single import: goBack removes the imported entry, restores the index and undismisses', () => {
    const c = setup();
    const events = [ev('g1'), ev('g2', { start: new Date(2026, 5, 12, 11, 0) })];
    c.eventsToProcess.set(events);
    c.currentIndex.set(0);
    c.importedCount.set(0);

    // Import first event with a project, advancing to index 1.
    c.importWithProject('p1');
    expect(timeEntryStore.entries()).toHaveLength(1);
    expect(c.currentIndex()).toBe(1);
    expect(c.importedCount()).toBe(1);

    // Go back.
    c.goBack();

    expect(timeEntryStore.entries()).toHaveLength(0);
    expect(c.currentIndex()).toBe(0);
    expect(c.importedCount()).toBe(0);
    // AC3: no lingering dismiss.
    expect(timeEntryStore.dismissedGoogleEventIds()).toEqual([]);
    // The event is decidable again.
    expect(c.currentEvent()?.id).toBe('g1');
  });

  it('series import: goBack removes ALL imported entries and restores series events to the wizard', () => {
    const c = setup();
    const events = [
      ev('s1', { recurringEventId: 'series-A', start: new Date(2026, 5, 12, 9, 0) }),
      ev('s2', { recurringEventId: 'series-A', start: new Date(2026, 5, 13, 9, 0) }),
      ev('s3', { recurringEventId: 'series-A', start: new Date(2026, 5, 14, 9, 0) }),
      ev('x1', { start: new Date(2026, 5, 15, 9, 0) }),
    ];
    c.eventsToProcess.set(events);
    c.currentIndex.set(0);
    c.importedCount.set(0);
    c.autoImportedCount.set(0);
    c.applyToSeries.set(true);

    // Import the first series event with applyToSeries -> imports s1, s2, s3.
    c.importWithProject('p1');

    // All three series entries created.
    expect(timeEntryStore.entries().map(e => e.googleEventId).sort()).toEqual(['s1', 's2', 's3']);
    expect(c.importedCount()).toBe(3);
    // Series events s2/s3 were spliced out of the snapshot.
    expect(c.eventsToProcess().map(e => e.id)).toEqual(['s1', 'x1']);
    expect(c.currentIndex()).toBe(1);

    // Go back undoes the entire series import.
    c.goBack();

    // AC1: ALL imported entries removed.
    expect(timeEntryStore.entries()).toHaveLength(0);
    expect(c.importedCount()).toBe(0);
    expect(c.autoImportedCount()).toBe(0);
    // AC2: series events back in eventsToProcess in original order and decidable.
    expect(c.eventsToProcess().map(e => e.id)).toEqual(['s1', 's2', 's3', 'x1']);
    expect(c.currentIndex()).toBe(0);
    expect(c.currentEvent()?.id).toBe('s1');
    // The recurring mapping created in this step is gone.
    expect(timeEntryStore.recurringMappingMap().has('series-A')).toBe(false);
    // AC3: nothing dismissed.
    expect(timeEntryStore.dismissedGoogleEventIds()).toEqual([]);
  });

  it('dismiss: goBack undismisses the event and makes it decidable again', () => {
    const c = setup();
    const events = [ev('g1'), ev('g2', { start: new Date(2026, 5, 12, 11, 0) })];
    c.eventsToProcess.set(events);
    c.currentIndex.set(0);

    // Dismiss (now labelled "Überspringen") the first event.
    c.dismissCurrent();
    expect(timeEntryStore.dismissedGoogleEventIds()).toEqual(['g1']);
    expect(c.currentIndex()).toBe(1);

    // Go back.
    c.goBack();

    // AC3: no lingering dismiss; event decidable again.
    expect(timeEntryStore.dismissedGoogleEventIds()).toEqual([]);
    expect(c.currentIndex()).toBe(0);
    expect(c.currentEvent()?.id).toBe('g1');
  });
});
