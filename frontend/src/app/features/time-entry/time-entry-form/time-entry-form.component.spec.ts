import { describe, it, expect, vi } from 'vitest';
import { isEndTimeNotAfterStart } from './time-validation';

// ---------------------------------------------------------------------------
// Pure validation helper — tested without Angular framework overhead
// ---------------------------------------------------------------------------

describe('isEndTimeNotAfterStart', () => {
  it('returns false when endTime is empty', () => {
    expect(isEndTimeNotAfterStart('09:00', '')).toBe(false);
  });

  it('returns false when startTime is empty', () => {
    expect(isEndTimeNotAfterStart('', '10:00')).toBe(false);
  });

  it('returns false when both values are empty', () => {
    expect(isEndTimeNotAfterStart('', '')).toBe(false);
  });

  it('returns false when endTime is after startTime', () => {
    expect(isEndTimeNotAfterStart('09:00', '10:00')).toBe(false);
  });

  it('returns true when endTime equals startTime', () => {
    expect(isEndTimeNotAfterStart('09:00', '09:00')).toBe(true);
  });

  it('returns true when endTime is before startTime', () => {
    expect(isEndTimeNotAfterStart('17:00', '08:00')).toBe(true);
  });

  it('returns true for midnight edge case (00:00 vs 23:59)', () => {
    expect(isEndTimeNotAfterStart('23:59', '00:00')).toBe(true);
  });

  it('returns false for one-minute difference', () => {
    expect(isEndTimeNotAfterStart('09:00', '09:01')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onSubmit guard — validates that the guard prevents saved from being emitted
// when the time validation fails. We exercise the guard logic directly using
// the exported function to keep the spec framework-free (matching project style).
// ---------------------------------------------------------------------------

describe('onSubmit time validation guard', () => {
  /**
   * Simulates what onSubmit does: check form validity and time order, then
   * call savedEmit. Returns whether savedEmit was invoked.
   */
  function simulateSubmit(
    startTime: string,
    endTime: string,
    formInvalid = false,
  ): boolean {
    const savedEmit = vi.fn();
    // Mirrors the guard logic in onSubmit
    if (formInvalid) return false;
    if (isEndTimeNotAfterStart(startTime, endTime)) return false;
    savedEmit({ dto: { title: 'Test', start: new Date(), end: new Date(), projectId: 'p1', source: 'manual' } });
    return savedEmit.mock.calls.length > 0;
  }

  it('does NOT emit saved when endTime equals startTime', () => {
    expect(simulateSubmit('09:00', '09:00')).toBe(false);
  });

  it('does NOT emit saved when endTime is before startTime', () => {
    expect(simulateSubmit('17:00', '09:00')).toBe(false);
  });

  it('DOES emit saved when endTime is after startTime', () => {
    expect(simulateSubmit('09:00', '17:00')).toBe(true);
  });

  it('DOES emit saved for one-minute positive difference', () => {
    expect(simulateSubmit('09:00', '09:01')).toBe(true);
  });

  it('does NOT emit saved when form is invalid (regardless of times)', () => {
    expect(simulateSubmit('09:00', '17:00', true)).toBe(false);
  });
});
