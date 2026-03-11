import { TimeEntry } from '../../domain/models/time-entry.model';

export interface OverlapInfo {
  col: number;
  total: number;
}

export function computeOverlapLayout(
  entries: TimeEntry[],
  result: Map<string, OverlapInfo>,
): void {
  if (entries.length === 0) return;
  const sorted = [...entries].sort(
    (a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime() ||
      new Date(b.end).getTime() - new Date(a.end).getTime(),
  );
  const clusters: TimeEntry[][] = [];
  let cluster: TimeEntry[] = [];
  let clusterEnd = 0;
  for (const entry of sorted) {
    const s = new Date(entry.start).getTime();
    const e = new Date(entry.end).getTime();
    if (cluster.length === 0 || s < clusterEnd) {
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, e);
    } else {
      clusters.push(cluster);
      cluster = [entry];
      clusterEnd = e;
    }
  }
  if (cluster.length > 0) clusters.push(cluster);
  for (const c of clusters) {
    const colEnds: number[] = [];
    for (const entry of c) {
      const s = new Date(entry.start).getTime();
      let col = colEnds.findIndex(end => end <= s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(0);
      }
      colEnds[col] = new Date(entry.end).getTime();
      result.set(entry.id, { col, total: 0 });
    }
    for (const entry of c) {
      result.get(entry.id)!.total = colEnds.length;
    }
  }
}

export function getEntryLeft(
  layout: Map<string, OverlapInfo>,
  entryId: string,
  padding: number,
): string {
  const l = layout.get(entryId);
  if (!l || l.total <= 1) return `${padding}px`;
  const pct = l.col / l.total;
  return `calc(${(padding - pct * padding * 2).toFixed(2)}px + ${(pct * 100).toFixed(2)}%)`;
}

export function getEntryWidth(
  layout: Map<string, OverlapInfo>,
  entryId: string,
  totalPadding: number,
  gap: number,
): string {
  const l = layout.get(entryId);
  if (!l || l.total <= 1) return `calc(100% - ${totalPadding}px)`;
  const frac = 1 / l.total;
  return `calc(${(frac * 100).toFixed(2)}% - ${(frac * totalPadding + gap).toFixed(2)}px)`;
}
