import { describe, it, expect } from 'vitest';
import { computeGapFills, findGapSuggestions, EntryAdjustment } from './gap-filler';
import { TimeEntry } from '../../domain/models/time-entry.model';

function entry(id: string, startH: number, startM: number, endH: number, endM: number): TimeEntry {
  const start = new Date(2026, 2, 12, startH, startM, 0, 0);
  const end = new Date(2026, 2, 12, endH, endM, 0, 0);
  return { id, title: `Entry ${id}`, start, end, source: 'manual' };
}

describe('computeGapFills', () => {
  it('returns empty for empty input', () => {
    expect(computeGapFills([])).toEqual([]);
  });

  it('snaps start down within 5 min tolerance', () => {
    // 9:03 should snap down to 9:00 (3 min < 5 min tolerance)
    const result = computeGapFills([entry('a', 9, 3, 10, 0)]);
    const adj = result.find(a => a.id === 'a');
    expect(adj).toBeDefined();
    expect(adj!.start!.getHours()).toBe(9);
    expect(adj!.start!.getMinutes()).toBe(0);
  });

  it('snaps end up within 5 min tolerance', () => {
    // 9:00 - 9:57 should snap end up to 10:00 (3 min < 5 min tolerance)
    const result = computeGapFills([entry('a', 9, 0, 9, 57)]);
    const adj = result.find(a => a.id === 'a');
    expect(adj).toBeDefined();
    expect(adj!.end!.getHours()).toBe(10);
    expect(adj!.end!.getMinutes()).toBe(0);
  });

  it('does not snap beyond tolerance', () => {
    // 9:08 should NOT snap to 9:00 (8 min > 5 min tolerance)
    const result = computeGapFills([entry('a', 9, 8, 10, 0)]);
    const adj = result.find(a => a.id === 'a');
    expect(adj).toBeUndefined();
  });

  it('does not snap start if it would overlap previous entry', () => {
    const entries = [
      entry('a', 9, 0, 9, 14),  // ends at 9:14
      entry('b', 9, 17, 10, 0), // start 9:17 would snap to 9:15, but 9:14 < 9:15 so it should snap
    ];
    const result = computeGapFills(entries);
    const adjB = result.find(a => a.id === 'b');
    expect(adjB).toBeDefined();
    expect(adjB!.start!.getMinutes()).toBe(15);
  });

  it('closes small gaps (< 15 min) by snapping or extending', () => {
    // Entry a: 9:00-9:45 (on grid), Entry b: 9:50-10:30
    // Step 1: 9:50 snaps down to 9:45 (within 5 min tolerance, >= a.end)
    // Step 2: gap is now 0, no further adjustment needed
    // Result: b.start adjusted from 9:50 to 9:45
    const entries = [
      entry('a', 9, 0, 9, 45),
      entry('b', 9, 50, 10, 30),
    ];
    const result = computeGapFills(entries);
    const adjB = result.find(a => a.id === 'b');
    expect(adjB).toBeDefined();
    expect(adjB!.start!.getHours()).toBe(9);
    expect(adjB!.start!.getMinutes()).toBe(45);
  });

  it('closes small gaps via step 2 when snapping cannot help', () => {
    // Entry a: 9:00-9:22 (not near grid), Entry b: 9:30-10:30 (on grid)
    // Step 1: 9:22 cannot snap (8 min > 5 min tolerance)
    // Step 2: gap = 9:30 - 9:22 = 8 min < 15 min
    // a (22 min) < b (60 min), so next.start = current.end → b.start moves to 9:22
    const entries = [
      entry('a', 9, 0, 9, 22),
      entry('b', 9, 30, 10, 30),
    ];
    const result = computeGapFills(entries);
    const adjB = result.find(a => a.id === 'b');
    expect(adjB).toBeDefined();
    expect(adjB!.start!.getHours()).toBe(9);
    expect(adjB!.start!.getMinutes()).toBe(22);
  });

  it('does not close gaps >= 15 min', () => {
    const entries = [
      entry('a', 9, 0, 9, 30),
      entry('b', 9, 45, 10, 30),
    ];
    const result = computeGapFills(entries);
    // No gap-closing adjustments (snap adjustments might still happen)
    const adjA = result.find(a => a.id === 'a');
    const adjB = result.find(a => a.id === 'b');
    // Neither should have start/end changed due to gap closing
    // a: 9:00-9:30 already on grid, b: 9:45-10:30 already on grid
    expect(adjA).toBeUndefined();
    expect(adjB).toBeUndefined();
  });

  it('returns no adjustments when entries are already on grid', () => {
    const entries = [
      entry('a', 9, 0, 10, 0),
      entry('b', 10, 0, 11, 0),
    ];
    expect(computeGapFills(entries)).toEqual([]);
  });

  it('handles unsorted input', () => {
    const entries = [
      entry('b', 10, 3, 11, 0),
      entry('a', 9, 0, 10, 0),
    ];
    const result = computeGapFills(entries);
    const adjB = result.find(a => a.id === 'b');
    expect(adjB).toBeDefined();
    expect(adjB!.start!.getMinutes()).toBe(0); // 10:03 snaps to 10:00
  });
});

describe('findGapSuggestions', () => {
  it('returns empty for empty input', () => {
    expect(findGapSuggestions([])).toEqual([]);
  });

  it('finds gap before first entry', () => {
    // Work starts at 8:00, first entry at 9:00
    const suggestions = findGapSuggestions([entry('a', 9, 0, 10, 0)]);
    const first = suggestions[0];
    expect(first.start.getHours()).toBe(8);
    expect(first.end.getHours()).toBe(9);
  });

  it('finds gap after last entry', () => {
    // Last entry ends at 17:00, work ends at 18:00
    const suggestions = findGapSuggestions([entry('a', 16, 0, 17, 0)]);
    const last = suggestions[suggestions.length - 1];
    expect(last.start.getHours()).toBe(17);
    expect(last.end.getHours()).toBe(18);
  });

  it('finds gap between entries', () => {
    const suggestions = findGapSuggestions([
      entry('a', 9, 0, 10, 0),
      entry('b', 11, 0, 12, 0),
    ]);
    const mid = suggestions.find(s =>
      s.start.getHours() === 10 && s.end.getHours() === 11
    );
    expect(mid).toBeDefined();
  });

  it('ignores gaps <= 15 min', () => {
    const suggestions = findGapSuggestions([
      entry('a', 9, 0, 9, 50),
      entry('b', 10, 0, 18, 0),
    ]);
    // 10 min gap between 9:50 and 10:00 should be ignored
    const mid = suggestions.find(s =>
      s.start.getHours() === 9 && s.start.getMinutes() === 50
    );
    expect(mid).toBeUndefined();
  });

  it('splits large gaps (> 1 hour) into hourly blocks', () => {
    // Entry from 8:00 to 10:00, then nothing until 18:00
    // Gap: 10:00-18:00 = 8 hours, should be split into ~8 blocks
    const suggestions = findGapSuggestions([entry('a', 8, 0, 10, 0)]);
    const gapBlocks = suggestions.filter(s => s.start.getHours() >= 10);
    expect(gapBlocks.length).toBeGreaterThan(1);
    expect(gapBlocks.length).toBeLessThanOrEqual(8);
  });

  it('clips gaps to work hours (8:00-18:00)', () => {
    // Entry from 7:00-7:30 is outside work hours
    // Entry from 17:30-19:00 extends past work hours
    const suggestions = findGapSuggestions([
      entry('a', 7, 0, 7, 30),
      entry('b', 17, 30, 19, 0),
    ]);
    // All suggestion times should be within 8:00-18:00
    for (const s of suggestions) {
      expect(s.start.getHours()).toBeGreaterThanOrEqual(8);
      expect(s.end.getHours()).toBeLessThanOrEqual(18);
    }
  });
});
