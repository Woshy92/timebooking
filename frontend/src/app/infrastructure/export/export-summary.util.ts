import { TimeEntry } from '../../domain/models/time-entry.model';
import { isSameDay } from 'date-fns';

/**
 * Formats a duration in fractional hours as `H:MM` (e.g. 6.5 → "6:30").
 * Rounds to the nearest minute before splitting into hours/minutes.
 */
export function formatHoursAsHHMM(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Excludes pause entries (`pause === true`) from aggregation.
 *
 * Entscheidung: Pausen-Einträge erscheinen in der Detailtabelle klar als 'Pause'
 * markiert (Transparenz für den Stundenzettel), zählen aber – konsistent zur
 * App-Ansicht (Tages-/Wochensumme filtert mit !e.pause) – NICHT in Summen oder
 * die Zusammenfassung. Daher werden alle Aggregationen auf den Rückgabewert
 * (workEntries, ohne Pausen) berechnet.
 */
export function excludePauses(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter(e => !e.pause);
}

/** Duration of a single entry in fractional hours. */
function entryHours(entry: TimeEntry): number {
  return (new Date(entry.end).getTime() - new Date(entry.start).getTime()) / 3600000;
}

export interface HoursMatrix {
  /** Project IDs that have at least one work entry, in first-seen order of `workEntries`. */
  readonly projectIds: string[];
  /** Per-project hours per day. `projectHours[projectId][dayIndex]`. */
  readonly projectHours: Map<string, number[]>;
  /** Per-project total hours across all days. */
  readonly projectTotals: Map<string, number>;
  /** Hours per day for entries without a project. */
  readonly noProjectHours: number[];
  /** Total hours across all days for entries without a project. */
  readonly noProjectTotal: number;
  /** Per-day totals (sum of all project hours plus no-project hours). */
  readonly dayTotals: number[];
  /** Grand total across every project, the no-project bucket, and all days. */
  readonly grandTotal: number;
}

/**
 * Aggregates work entries into a project × day hours matrix in a single pass.
 *
 * `dayTotals` and `grandTotal` are accumulated here (not via side-effecting
 * `map()` callbacks at the call site), so day totals are guaranteed to equal the
 * sum of all project hours plus the no-project hours for that day.
 *
 * The returned `projectIds` are derived from `workEntries` (first-seen order),
 * matching the order both export adapters rely on for per-row colouring.
 */
export function buildHoursMatrix(workEntries: TimeEntry[], days: Date[]): HoursMatrix {
  const projectIds: string[] = [];
  const projectHours = new Map<string, number[]>();
  const projectTotals = new Map<string, number>();
  const noProjectHours = new Array<number>(days.length).fill(0);
  const dayTotals = new Array<number>(days.length).fill(0);
  let noProjectTotal = 0;
  let grandTotal = 0;

  for (const entry of workEntries) {
    const dayIndex = days.findIndex(day => isSameDay(new Date(entry.start), day));
    if (dayIndex === -1) continue;

    const hours = entryHours(entry);

    if (entry.projectId) {
      let perDay = projectHours.get(entry.projectId);
      if (!perDay) {
        perDay = new Array<number>(days.length).fill(0);
        projectHours.set(entry.projectId, perDay);
        projectTotals.set(entry.projectId, 0);
        projectIds.push(entry.projectId);
      }
      perDay[dayIndex] += hours;
      projectTotals.set(entry.projectId, projectTotals.get(entry.projectId)! + hours);
    } else {
      noProjectHours[dayIndex] += hours;
      noProjectTotal += hours;
    }

    dayTotals[dayIndex] += hours;
    grandTotal += hours;
  }

  return {
    projectIds,
    projectHours,
    projectTotals,
    noProjectHours,
    noProjectTotal,
    dayTotals,
    grandTotal,
  };
}
