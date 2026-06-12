import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import { WeekViewComponent } from './week-view.component';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { UndoStore } from '../../../state/undo.store';
import { VacationStore } from '../../../state/vacation.store';
import { CalendarInteractionService } from '../../../shared/services/calendar-interaction.service';
import { TimeEntry } from '../../../domain/models/time-entry.model';

/**
 * Unit coverage for TASK-0006 AC#2: the vacation dialog must reactively report
 * how many entries the chosen range would delete. The count logic lives in the
 * WeekViewComponent's `vacationEntryCount` computed; it must:
 *  - be 0 when no dialog is open,
 *  - count entries on weekdays within [startDate, endDate],
 *  - exclude weekends and entries outside the range,
 *  - react to changes of the selected end date.
 */

function entry(id: string, start: Date): TimeEntry {
  return {
    id,
    title: id,
    start,
    end: new Date(start.getTime() + 3600000),
    projectId: 'p1',
    source: 'manual',
  };
}

describe('WeekViewComponent.vacationEntryCount', () => {
  let entries: ReturnType<typeof signal<TimeEntry[]>>;

  beforeAll(() => {
    try {
      TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch {
      // already initialized by another spec
    }
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  function setup(initialEntries: TimeEntry[]) {
    entries = signal<TimeEntry[]>(initialEntries);

    TestBed.configureTestingModule({
      providers: [
        WeekViewComponent,
        { provide: TimeEntryStore, useValue: { entries, removeEntries: vi.fn() } },
        {
          provide: ProjectStore,
          useValue: { projectMap: () => new Map(), activeProjects: () => [] },
        },
        { provide: CalendarStore, useValue: { events: () => [] } },
        {
          provide: UiStore,
          useValue: {
            viewStartHour: () => 7,
            viewEndHour: () => 19,
            weekStart: () => new Date(2026, 5, 8), // Mon 2026-06-08
            weekEnd: () => new Date(2026, 5, 14),
            defaultProjectId: () => null,
            highlightGaps: () => false,
          },
        },
        { provide: UndoStore, useValue: { pushDelete: vi.fn() } },
        {
          provide: VacationStore,
          useValue: { daySet: () => new Set<string>(), toggleDay: vi.fn(), setRange: vi.fn() },
        },
        {
          provide: CalendarInteractionService,
          useValue: { dismissEmptyDraft: vi.fn() },
        },
      ],
    });

    return TestBed.inject(WeekViewComponent);
  }

  it('is 0 when no vacation dialog is open', () => {
    const c = setup([entry('a', new Date(2026, 5, 10, 9, 0))]);
    expect(c.vacationEntryCount()).toBe(0);
  });

  it('counts entries on the single selected start day', () => {
    // Wed 2026-06-10 has two entries; another entry sits on a different day.
    const c = setup([
      entry('a', new Date(2026, 5, 10, 9, 0)),
      entry('b', new Date(2026, 5, 10, 14, 0)),
      entry('c', new Date(2026, 5, 11, 9, 0)),
    ]);
    c.vacationDialog.set({ startDate: new Date(2026, 5, 10), startDateStr: '2026-06-10', endDateStr: '2026-06-10' });
    c.vacationEndDate.set('2026-06-10');

    expect(c.vacationEntryCount()).toBe(2);
  });

  it('reacts when the selected end date extends the range', () => {
    const c = setup([
      entry('a', new Date(2026, 5, 10, 9, 0)), // Wed
      entry('b', new Date(2026, 5, 11, 9, 0)), // Thu
      entry('c', new Date(2026, 5, 12, 9, 0)), // Fri
    ]);
    c.vacationDialog.set({ startDate: new Date(2026, 5, 10), startDateStr: '2026-06-10', endDateStr: '2026-06-10' });
    c.vacationEndDate.set('2026-06-10');
    expect(c.vacationEntryCount()).toBe(1);

    // Extend to Friday -> now Wed/Thu/Fri are all in range.
    c.vacationEndDate.set('2026-06-12');
    expect(c.vacationEntryCount()).toBe(3);
  });

  it('excludes weekend entries from the range count', () => {
    const c = setup([
      entry('fri', new Date(2026, 5, 12, 9, 0)), // Fri (weekday)
      entry('sat', new Date(2026, 5, 13, 9, 0)), // Sat (weekend, excluded)
      entry('mon', new Date(2026, 5, 15, 9, 0)), // Mon next week (weekday)
    ]);
    c.vacationDialog.set({ startDate: new Date(2026, 5, 12), startDateStr: '2026-06-12', endDateStr: '2026-06-12' });
    c.vacationEndDate.set('2026-06-15');

    // Fri + Mon counted, Sat skipped.
    expect(c.vacationEntryCount()).toBe(2);
  });
});
