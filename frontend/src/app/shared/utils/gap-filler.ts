import { TimeEntry } from '../../domain/models/time-entry.model';

const QUARTER_MS = 15 * 60_000;
const TOLERANCE_MS = 5 * 60_000;
const SMALL_GAP_MS = 15 * 60_000;

export interface EntryAdjustment {
  id: string;
  start?: Date;
  end?: Date;
}

function dayStartMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function snapDown(date: Date): Date {
  const ds = dayStartMs(date);
  const ms = date.getTime() - ds;
  return new Date(ds + Math.floor(ms / QUARTER_MS) * QUARTER_MS);
}

function snapUp(date: Date): Date {
  const ds = dayStartMs(date);
  const ms = date.getTime() - ds;
  return new Date(ds + Math.ceil(ms / QUARTER_MS) * QUARTER_MS);
}

export function computeGapFills(entries: TimeEntry[]): EntryAdjustment[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const items = sorted.map(e => ({
    id: e.id,
    start: new Date(e.start),
    end: new Date(e.end),
    origStart: new Date(e.start).getTime(),
    origEnd: new Date(e.end).getTime(),
  }));

  // Step 1: Snap start down / end up (within 5 min tolerance, no overlaps)
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    const snappedStart = snapDown(item.start);
    const startDiff = item.start.getTime() - snappedStart.getTime();
    if (startDiff > 0 && startDiff <= TOLERANCE_MS) {
      const prev = i > 0 ? items[i - 1] : null;
      if (!prev || snappedStart.getTime() >= prev.end.getTime()) {
        item.start = snappedStart;
      }
    }

    const snappedEnd = snapUp(item.end);
    const endDiff = snappedEnd.getTime() - item.end.getTime();
    if (endDiff > 0 && endDiff <= TOLERANCE_MS) {
      const next = i < items.length - 1 ? items[i + 1] : null;
      if (!next || snappedEnd.getTime() <= next.start.getTime()) {
        item.end = snappedEnd;
      }
    }
  }

  // Step 2: Close gaps under 15 minutes
  for (let i = 0; i < items.length - 1; i++) {
    const current = items[i];
    const next = items[i + 1];
    const gap = next.start.getTime() - current.end.getTime();

    if (gap > 0 && gap < SMALL_GAP_MS) {
      const currentDuration = current.end.getTime() - current.start.getTime();
      const nextDuration = next.end.getTime() - next.start.getTime();

      if (currentDuration >= nextDuration) {
        current.end = new Date(next.start.getTime());
      } else {
        next.start = new Date(current.end.getTime());
      }
    }
  }

  const adjustments: EntryAdjustment[] = [];
  for (const item of items) {
    const startChanged = item.start.getTime() !== item.origStart;
    const endChanged = item.end.getTime() !== item.origEnd;
    if (startChanged || endChanged) {
      const adj: EntryAdjustment = { id: item.id };
      if (startChanged) adj.start = item.start;
      if (endChanged) adj.end = item.end;
      adjustments.push(adj);
    }
  }

  return adjustments;
}

// ─── Gap Suggestions ──────────────────────────────────────

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const MIN_GAP_MS = 15 * 60_000;
const SPLIT_THRESHOLD_MS = 60 * 60_000;

export interface GapSuggestion {
  id: string;
  start: Date;
  end: Date;
}

export function findGapSuggestions(entries: TimeEntry[]): GapSuggestion[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const dayDate = new Date(sorted[0].start);
  const workStart = new Date(dayDate);
  workStart.setHours(WORK_START_HOUR, 0, 0, 0);
  const workEnd = new Date(dayDate);
  workEnd.setHours(WORK_END_HOUR, 0, 0, 0);

  const rawGaps: { start: Date; end: Date }[] = [];

  // Gap before first entry
  const firstStart = new Date(sorted[0].start);
  if (firstStart.getTime() > workStart.getTime()) {
    rawGaps.push({ start: new Date(workStart), end: firstStart });
  }

  // Gaps between entries
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = new Date(sorted[i].end);
    const nextStart = new Date(sorted[i + 1].start);
    if (nextStart.getTime() > currentEnd.getTime()) {
      rawGaps.push({ start: currentEnd, end: nextStart });
    }
  }

  // Gap after last entry
  const lastEnd = new Date(sorted[sorted.length - 1].end);
  if (lastEnd.getTime() < workEnd.getTime()) {
    rawGaps.push({ start: lastEnd, end: new Date(workEnd) });
  }

  const suggestions: GapSuggestion[] = [];
  let idx = 0;

  for (const gap of rawGaps) {
    const clippedStart = new Date(Math.max(gap.start.getTime(), workStart.getTime()));
    const clippedEnd = new Date(Math.min(gap.end.getTime(), workEnd.getTime()));
    if (clippedEnd.getTime() - clippedStart.getTime() <= MIN_GAP_MS) continue;

    const blocks = splitGap(clippedStart, clippedEnd);
    for (const block of blocks) {
      suggestions.push({ id: `gap-${idx++}`, start: block.start, end: block.end });
    }
  }

  return suggestions;
}

function splitGap(start: Date, end: Date): { start: Date; end: Date }[] {
  const gapMs = end.getTime() - start.getTime();
  if (gapMs < SPLIT_THRESHOLD_MS) {
    return [{ start, end }];
  }

  const blocks: { start: Date; end: Date }[] = [];
  let current = new Date(start);

  while (current.getTime() < end.getTime()) {
    const nextHour = new Date(current);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);

    const blockEnd = nextHour.getTime() < end.getTime() ? nextHour : new Date(end);
    if (blockEnd.getTime() - current.getTime() > MIN_GAP_MS) {
      blocks.push({ start: new Date(current), end: blockEnd });
    }
    current = blockEnd;
  }

  return blocks;
}
