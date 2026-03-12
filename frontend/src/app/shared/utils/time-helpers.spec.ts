import { describe, it, expect } from 'vitest';
import { snapToHalfHour, snapToGrid, hourToStr, formatTime } from './time-helpers';

describe('snapToHalfHour', () => {
  it('rounds to nearest 0.5', () => {
    expect(snapToHalfHour(9.0)).toBe(9.0);
    expect(snapToHalfHour(9.1)).toBe(9.0);
    expect(snapToHalfHour(9.25)).toBe(9.5);
    expect(snapToHalfHour(9.3)).toBe(9.5);
    expect(snapToHalfHour(9.7)).toBe(9.5);
    expect(snapToHalfHour(9.75)).toBe(10.0);
    expect(snapToHalfHour(9.9)).toBe(10.0);
  });

  it('handles 0 and 24', () => {
    expect(snapToHalfHour(0)).toBe(0);
    expect(snapToHalfHour(24)).toBe(24);
  });
});

describe('snapToGrid', () => {
  it('snaps to 15-minute grid', () => {
    expect(snapToGrid(9.1, 15)).toBe(9.0);
    expect(snapToGrid(9.2, 15)).toBe(9.25);
    expect(snapToGrid(9.3, 15)).toBe(9.25);
    expect(snapToGrid(9.4, 15)).toBe(9.5);
  });

  it('snaps to 30-minute grid', () => {
    expect(snapToGrid(9.1, 30)).toBe(9.0);
    expect(snapToGrid(9.3, 30)).toBe(9.5);
    expect(snapToGrid(9.7, 30)).toBe(9.5);
    expect(snapToGrid(9.8, 30)).toBe(10.0);
  });

  it('snaps to 5-minute grid', () => {
    const step = 5 / 60;
    expect(snapToGrid(9.0, 5)).toBeCloseTo(9.0);
    expect(snapToGrid(9.0 + step / 2, 5)).toBeCloseTo(9.0 + step);
  });
});

describe('hourToStr', () => {
  it('formats whole hours', () => {
    expect(hourToStr(9)).toBe('09:00');
    expect(hourToStr(14)).toBe('14:00');
    expect(hourToStr(0)).toBe('00:00');
  });

  it('formats half hours', () => {
    expect(hourToStr(9.5)).toBe('09:30');
    expect(hourToStr(14.5)).toBe('14:30');
  });

  it('formats quarter hours', () => {
    expect(hourToStr(9.25)).toBe('09:15');
    expect(hourToStr(9.75)).toBe('09:45');
  });

  it('pads single-digit hours', () => {
    expect(hourToStr(1)).toBe('01:00');
    expect(hourToStr(8.5)).toBe('08:30');
  });
});

describe('formatTime', () => {
  it('formats a Date to HH:mm', () => {
    expect(formatTime(new Date(2026, 2, 12, 9, 30))).toBe('09:30');
    expect(formatTime(new Date(2026, 2, 12, 14, 5))).toBe('14:05');
    expect(formatTime(new Date(2026, 2, 12, 0, 0))).toBe('00:00');
  });
});
