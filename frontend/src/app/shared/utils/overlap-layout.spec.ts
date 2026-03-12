import { describe, it, expect } from 'vitest';
import { computeOverlapLayout, getEntryLeft, getEntryWidth, OverlapInfo, OverlapItem } from './overlap-layout';

function item(id: string, startH: number, endH: number): OverlapItem {
  return {
    id,
    start: new Date(2026, 2, 12, startH, 0),
    end: new Date(2026, 2, 12, endH, 0),
  };
}

describe('computeOverlapLayout', () => {
  it('handles empty input', () => {
    const result = new Map<string, OverlapInfo>();
    computeOverlapLayout([], result);
    expect(result.size).toBe(0);
  });

  it('single entry gets col 0, total 1', () => {
    const result = new Map<string, OverlapInfo>();
    computeOverlapLayout([item('a', 9, 10)], result);
    expect(result.get('a')).toEqual({ col: 0, total: 1 });
  });

  it('non-overlapping entries get separate clusters', () => {
    const result = new Map<string, OverlapInfo>();
    computeOverlapLayout([
      item('a', 9, 10),
      item('b', 11, 12),
    ], result);
    expect(result.get('a')).toEqual({ col: 0, total: 1 });
    expect(result.get('b')).toEqual({ col: 0, total: 1 });
  });

  it('overlapping entries share a cluster with different columns', () => {
    const result = new Map<string, OverlapInfo>();
    computeOverlapLayout([
      item('a', 9, 11),
      item('b', 10, 12),
    ], result);
    expect(result.get('a')!.col).toBe(0);
    expect(result.get('b')!.col).toBe(1);
    expect(result.get('a')!.total).toBe(2);
    expect(result.get('b')!.total).toBe(2);
  });

  it('three overlapping entries get 3 columns', () => {
    const result = new Map<string, OverlapInfo>();
    computeOverlapLayout([
      item('a', 9, 12),
      item('b', 10, 13),
      item('c', 11, 14),
    ], result);
    expect(result.get('a')!.total).toBe(3);
    expect(result.get('b')!.total).toBe(3);
    expect(result.get('c')!.total).toBe(3);
    const cols = new Set([
      result.get('a')!.col,
      result.get('b')!.col,
      result.get('c')!.col,
    ]);
    expect(cols.size).toBe(3);
  });

  it('reuses columns for non-overlapping items within a cluster', () => {
    const result = new Map<string, OverlapInfo>();
    // a: 9-10, b: 9-11 (overlaps a), c: 10-11 (overlaps b, but a is done)
    computeOverlapLayout([
      item('a', 9, 10),
      item('b', 9, 11),
      item('c', 10, 11),
    ], result);
    // c can reuse a's column since a ends at 10 and c starts at 10
    expect(result.get('c')!.col).toBe(result.get('a')!.col);
  });
});

describe('getEntryLeft', () => {
  it('returns padding for single entry', () => {
    const layout = new Map<string, OverlapInfo>();
    layout.set('a', { col: 0, total: 1 });
    expect(getEntryLeft(layout, 'a', 4)).toBe('4px');
  });

  it('returns padding for unknown entry', () => {
    const layout = new Map<string, OverlapInfo>();
    expect(getEntryLeft(layout, 'x', 4)).toBe('4px');
  });

  it('returns calc expression for overlapping entries', () => {
    const layout = new Map<string, OverlapInfo>();
    layout.set('a', { col: 0, total: 2 });
    layout.set('b', { col: 1, total: 2 });
    const leftA = getEntryLeft(layout, 'a', 4);
    const leftB = getEntryLeft(layout, 'b', 4);
    expect(leftA).toContain('calc(');
    expect(leftB).toContain('calc(');
    expect(leftA).not.toBe(leftB);
  });
});

describe('getEntryWidth', () => {
  it('returns full width for single entry', () => {
    const layout = new Map<string, OverlapInfo>();
    layout.set('a', { col: 0, total: 1 });
    expect(getEntryWidth(layout, 'a', 8, 2)).toBe('calc(100% - 8px)');
  });

  it('returns fraction for overlapping entries', () => {
    const layout = new Map<string, OverlapInfo>();
    layout.set('a', { col: 0, total: 2 });
    const width = getEntryWidth(layout, 'a', 8, 2);
    expect(width).toContain('50.00%');
  });
});
