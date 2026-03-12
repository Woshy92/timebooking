import { describe, it, expect } from 'vitest';
import { safeParse } from './local-storage.adapter';

describe('safeParse', () => {
  it('returns fallback for null', () => {
    expect(safeParse(null, [])).toEqual([]);
    expect(safeParse(null, 'default')).toBe('default');
  });

  it('returns fallback for empty string', () => {
    expect(safeParse('', 42)).toBe(42);
  });

  it('parses valid JSON', () => {
    expect(safeParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    expect(safeParse('"hello"', '')).toBe('hello');
    expect(safeParse('42', 0)).toBe(42);
    expect(safeParse('true', false)).toBe(true);
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeParse('{broken', {})).toEqual({});
    expect(safeParse('not json', '')).toBe('');
    expect(safeParse('{', [])).toEqual([]);
  });

  it('returns fallback for undefined-like strings', () => {
    expect(safeParse('undefined', 'fallback')).toBe('fallback');
  });
});
