import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import { TimeEntryModalComponent } from './time-entry-modal.component';
import { UiStore } from '../../../state/ui.store';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { UndoStore } from '../../../state/undo.store';
import { TimeEntry } from '../../../domain/models/time-entry.model';

/**
 * Unit coverage for TASK-0006 AC#1: deleting from the entry modal must push the
 * deleted entry into the UndoStore (so the undo toast appears) before removing
 * it from the TimeEntryStore.
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
    const pushDelete = vi.fn();
    const removeEntry = vi.fn();
    const closeEntryModal = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        TimeEntryModalComponent,
        {
          provide: UiStore,
          useValue: { selectedEntryId, isEntryModalOpen: () => true, closeEntryModal },
        },
        { provide: TimeEntryStore, useValue: { entries: () => entries, removeEntry } },
        { provide: UndoStore, useValue: { pushDelete } },
      ],
    });

    const component = TestBed.inject(TimeEntryModalComponent);
    return { component, pushDelete, removeEntry, closeEntryModal };
  }

  it('pushes the deleted entry into the UndoStore, then removes it and closes the modal', () => {
    const e = entry('e1');
    const { component, pushDelete, removeEntry, closeEntryModal } = setup([e], 'e1');

    component.onDelete();

    expect(pushDelete).toHaveBeenCalledTimes(1);
    expect(pushDelete).toHaveBeenCalledWith([e]);
    expect(removeEntry).toHaveBeenCalledWith('e1');
    expect(closeEntryModal).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no entry is selected', () => {
    const { component, pushDelete, removeEntry, closeEntryModal } = setup([], null);

    component.onDelete();

    expect(pushDelete).not.toHaveBeenCalled();
    expect(removeEntry).not.toHaveBeenCalled();
    expect(closeEntryModal).not.toHaveBeenCalled();
  });
});
