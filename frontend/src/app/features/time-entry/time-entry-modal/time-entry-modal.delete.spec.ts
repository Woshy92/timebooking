import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import { TimeEntryModalComponent } from './time-entry-modal.component';
import { UiStore } from '../../../state/ui.store';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UndoStore } from '../../../state/undo.store';
import { CalendarSyncService } from '../../../application/calendar-sync.service';
import { CalendarInteractionService } from '../../../shared/services/calendar-interaction.service';
import { TimeEntry } from '../../../domain/models/time-entry.model';

/**
 * Unit coverage for TASK-0006 AC#1 / TASK-0015: deleting from the entry modal
 * delegates to the canonical CalendarInteractionService.deleteSingleEntry path,
 * which pushes the deleted entry into the UndoStore (so the undo toast appears)
 * before removing it from the TimeEntryStore. The modal then closes.
 *
 * Two layers are verified:
 *  - the modal delegates the selected entry to deleteSingleEntry and closes, and
 *  - deleteSingleEntry pushes Undo + removes the entry (the behaviour the modal relies on).
 */

function entry(id: string): TimeEntry {
  return {
    id,
    title: `Entry ${id}`,
    start: new Date(2026, 5, 10, 9, 0),
    end: new Date(2026, 5, 10, 10, 0),
    projectId: 'p1',
    source: 'manual',
  };
}

describe('TimeEntryModalComponent.onDelete', () => {
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

  function setup(entries: TimeEntry[], selectedId: string | null) {
    const selectedEntryId = signal<string | null>(selectedId);
    const deleteSingleEntry = vi.fn();
    const closeEntryModal = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        TimeEntryModalComponent,
        {
          provide: UiStore,
          useValue: { selectedEntryId, isEntryModalOpen: () => true, closeEntryModal },
        },
        { provide: TimeEntryStore, useValue: { entries: () => entries } },
        { provide: CalendarInteractionService, useValue: { deleteSingleEntry } },
      ],
    });

    const component = TestBed.inject(TimeEntryModalComponent);
    return { component, deleteSingleEntry, closeEntryModal };
  }

  it('delegates the selected entry to deleteSingleEntry, then closes the modal', () => {
    const e = entry('e1');
    const { component, deleteSingleEntry, closeEntryModal } = setup([e], 'e1');

    component.onDelete();

    expect(deleteSingleEntry).toHaveBeenCalledTimes(1);
    expect(deleteSingleEntry).toHaveBeenCalledWith(null, e);
    expect(closeEntryModal).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no entry is selected', () => {
    const { component, deleteSingleEntry, closeEntryModal } = setup([], null);

    component.onDelete();

    expect(deleteSingleEntry).not.toHaveBeenCalled();
    expect(closeEntryModal).not.toHaveBeenCalled();
  });
});

/**
 * Verifies the behaviour the modal delegation relies on: deleteSingleEntry pushes
 * the entry into the UndoStore (undo toast) before removing it from the store, and
 * tolerates a null event (modal context has no DOM event).
 */
describe('CalendarInteractionService.deleteSingleEntry (modal delegation target)', () => {
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

  function makeService() {
    const pushDelete = vi.fn();
    const removeEntries = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        CalendarInteractionService,
        { provide: TimeEntryStore, useValue: { entries: () => [], removeEntries } },
        { provide: ProjectStore, useValue: { projectMap: () => new Map() } },
        { provide: CalendarStore, useValue: {} },
        { provide: CalendarSyncService, useValue: {} },
        { provide: UndoStore, useValue: { pushDelete } },
        { provide: UiStore, useValue: {} },
      ],
    });

    const service = TestBed.inject(CalendarInteractionService);
    return { service, pushDelete, removeEntries };
  }

  it('pushes the entry into the UndoStore, then removes it (null event tolerated)', () => {
    const { service, pushDelete, removeEntries } = makeService();
    const e = entry('e1');

    service.deleteSingleEntry(null, e);

    expect(pushDelete).toHaveBeenCalledTimes(1);
    expect(pushDelete).toHaveBeenCalledWith([e]);
    expect(removeEntries).toHaveBeenCalledWith(['e1']);
  });

  it('calls stopPropagation when invoked with a real event', () => {
    const { service } = makeService();
    const e = entry('e1');
    const stopPropagation = vi.fn();

    service.deleteSingleEntry({ stopPropagation } as unknown as Event, e);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});
