import { describe, it, expect } from 'vitest';
import { formatHoursAsHHMM, excludePauses, buildHoursMatrix } from './export-summary.util';
import { TimeEntry } from '../../domain/models/time-entry.model';

function entry(id: string, startH: number, endH: number, projectId?: string, day = 12): TimeEntry {
  return {
    id,
    title: id,
    start: new Date(2026, 2, day, startH, 0),
    end: new Date(2026, 2, day, endH, 0),
    source: 'manual',
    projectId,
  };
}

function pauseEntry(id: string, startH: number, endH: number, day = 12): TimeEntry {
  return { ...entry(id, startH, endH, undefined, day), pause: true };
}

describe('formatHoursAsHHMM', () => {
  it('formats whole hours', () => {
    expect(formatHoursAsHHMM(6)).toBe('6:00');
  });

  it('formats half hours with zero-padded minutes', () => {
    expect(formatHoursAsHHMM(6.5)).toBe('6:30');
  });

  it('rounds to the nearest minute', () => {
    // 1.504h = 90.24 min -> rounds to 90 min -> 1:30
    expect(formatHoursAsHHMM(1.504)).toBe('1:30');
    // 1.5083h = 90.5 min -> rounds to 91 min -> 1:31
    expect(formatHoursAsHHMM(90.5 / 60)).toBe('1:31');
  });

  it('handles zero', () => {
    expect(formatHoursAsHHMM(0)).toBe('0:00');
  });
});

describe('excludePauses', () => {
  it('removes entries flagged as pause', () => {
    const entries = [entry('a', 9, 12, 'p1'), pauseEntry('b', 12, 13), entry('c', 13, 15, 'p1')];
    const result = excludePauses(entries);
    expect(result.map(e => e.id)).toEqual(['a', 'c']);
  });

  it('returns all entries when none are pauses', () => {
    const entries = [entry('a', 9, 12, 'p1')];
    expect(excludePauses(entries)).toHaveLength(1);
  });

  it('returns empty for all-pause input', () => {
    expect(excludePauses([pauseEntry('a', 12, 13)])).toEqual([]);
  });
});

describe('buildHoursMatrix', () => {
  const day12 = new Date(2026, 2, 12);
  const day13 = new Date(2026, 2, 13);

  it('aggregates per-project hours per day', () => {
    const work = excludePauses([
      entry('a', 9, 12, 'p1', 12), // 3h, p1, day12
      entry('b', 13, 15, 'p1', 12), // 2h, p1, day12
      entry('c', 9, 11, 'p1', 13), // 2h, p1, day13
      entry('d', 9, 13, 'p2', 12), // 4h, p2, day12
    ]);
    const matrix = buildHoursMatrix(work, [day12, day13]);

    expect(matrix.projectIds).toEqual(['p1', 'p2']);
    expect(matrix.projectHours.get('p1')).toEqual([5, 2]);
    expect(matrix.projectHours.get('p2')).toEqual([4, 0]);
    expect(matrix.projectTotals.get('p1')).toBe(7);
    expect(matrix.projectTotals.get('p2')).toBe(4);
  });

  it('excludes pauses from the aggregation', () => {
    const work = excludePauses([
      entry('a', 9, 15, 'p1', 12), // 6h work
      pauseEntry('b', 12, 13, 12), // 1h pause -> excluded
    ]);
    const matrix = buildHoursMatrix(work, [day12]);

    expect(matrix.projectHours.get('p1')).toEqual([6]);
    expect(matrix.grandTotal).toBe(6);
    // Pause has no projectId; must NOT appear under no-project bucket
    expect(matrix.noProjectTotal).toBe(0);
    expect(matrix.noProjectHours).toEqual([0]);
  });

  it('collects entries without a project in the no-project bucket', () => {
    const work = excludePauses([
      entry('a', 9, 12, undefined, 12), // 3h, no project
      entry('b', 13, 14, undefined, 13), // 1h, no project, day13
    ]);
    const matrix = buildHoursMatrix(work, [day12, day13]);

    expect(matrix.projectIds).toEqual([]);
    expect(matrix.noProjectHours).toEqual([3, 1]);
    expect(matrix.noProjectTotal).toBe(4);
  });

  it('day totals equal the sum of project hours plus no-project hours per day', () => {
    const work = excludePauses([
      entry('a', 9, 12, 'p1', 12), // 3h p1
      entry('b', 13, 15, 'p2', 12), // 2h p2
      entry('c', 16, 18, undefined, 12), // 2h no-project
      entry('d', 9, 14, 'p1', 13), // 5h p1, day13
    ]);
    const matrix = buildHoursMatrix(work, [day12, day13]);

    // day12: 3 + 2 + 2 = 7 ; day13: 5
    expect(matrix.dayTotals).toEqual([7, 5]);

    // dayTotals must equal column-wise sum of all project rows + no-project row
    matrix.dayTotals.forEach((total, i) => {
      let expected = matrix.noProjectHours[i];
      for (const pid of matrix.projectIds) {
        expected += matrix.projectHours.get(pid)![i];
      }
      expect(total).toBe(expected);
    });
  });

  it('grand total equals the sum of all day totals and all project + no-project totals', () => {
    const work = excludePauses([
      entry('a', 9, 12, 'p1', 12), // 3h
      entry('b', 13, 15, 'p2', 12), // 2h
      entry('c', 16, 18, undefined, 12), // 2h
      entry('d', 9, 14, 'p1', 13), // 5h
    ]);
    const matrix = buildHoursMatrix(work, [day12, day13]);

    expect(matrix.grandTotal).toBe(12);
    expect(matrix.dayTotals.reduce((a, b) => a + b, 0)).toBe(matrix.grandTotal);

    const projectSum = matrix.projectIds.reduce((s, pid) => s + matrix.projectTotals.get(pid)!, 0);
    expect(projectSum + matrix.noProjectTotal).toBe(matrix.grandTotal);
  });

  it('ignores entries outside the given day range', () => {
    const work = excludePauses([
      entry('a', 9, 12, 'p1', 12),
      entry('b', 9, 12, 'p1', 20), // day 20 not in range
    ]);
    const matrix = buildHoursMatrix(work, [day12, day13]);

    expect(matrix.projectTotals.get('p1')).toBe(3);
    expect(matrix.grandTotal).toBe(3);
  });

  it('derives projectIds in first-seen order of work entries', () => {
    const work = excludePauses([
      entry('a', 9, 10, 'p2', 12),
      entry('b', 10, 11, 'p1', 12),
      entry('c', 11, 12, 'p2', 12),
    ]);
    const matrix = buildHoursMatrix(work, [day12]);
    expect(matrix.projectIds).toEqual(['p2', 'p1']);
  });
});
