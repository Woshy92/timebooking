import { describe, it, expect } from 'vitest';
import { mergeConsecutiveEntries } from '../shared/utils/merge-entries';
import { TimeEntry } from '../domain/models/time-entry.model';

function entry(id: string, title: string, startH: number, endH: number, projectId?: string): TimeEntry {
  return {
    id,
    title,
    start: new Date(2026, 2, 12, startH, 0),
    end: new Date(2026, 2, 12, endH, 0),
    source: 'manual',
    projectId,
  };
}

describe('mergeConsecutiveEntries', () => {
  it('returns empty for empty input', () => {
    expect(mergeConsecutiveEntries([])).toEqual([]);
  });

  it('returns single entry unchanged', () => {
    const entries = [entry('a', 'Task A', 9, 10, 'p1')];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task A');
  });

  it('merges consecutive entries with same project', () => {
    const entries = [
      entry('a', 'Task A', 9, 10, 'p1'),
      entry('b', 'Task B', 10, 11, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task A; Task B');
    expect(new Date(result[0].start).getHours()).toBe(9);
    expect(new Date(result[0].end).getHours()).toBe(11);
  });

  it('merges overlapping entries with same project', () => {
    const entries = [
      entry('a', 'Task A', 9, 11, 'p1'),
      entry('b', 'Task B', 10, 12, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(new Date(result[0].end).getHours()).toBe(12);
  });

  it('does not merge entries with different projects', () => {
    const entries = [
      entry('a', 'Task A', 9, 10, 'p1'),
      entry('b', 'Task B', 10, 11, 'p2'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(2);
  });

  it('does not merge entries without projectId', () => {
    const entries = [
      entry('a', 'Task A', 9, 10),
      entry('b', 'Task B', 10, 11),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(2);
  });

  it('does not merge entries with a gap', () => {
    const entries = [
      entry('a', 'Task A', 9, 10, 'p1'),
      entry('b', 'Task B', 11, 12, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(2);
  });

  it('deduplicates titles when merging', () => {
    const entries = [
      entry('a', 'Meeting', 9, 10, 'p1'),
      entry('b', 'Meeting', 10, 11, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Meeting');
  });

  it('sorts unsorted input before merging', () => {
    const entries = [
      entry('b', 'Task B', 10, 11, 'p1'),
      entry('a', 'Task A', 9, 10, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task A; Task B');
  });
});
