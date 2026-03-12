export interface OverlapInfo {
  col: number;
  total: number;
}

export interface OverlapItem {
  id: string;
  start: Date | string;
  end: Date | string;
}

export function computeOverlapLayout(
  items: OverlapItem[],
  result: Map<string, OverlapInfo>,
): void {
  if (items.length === 0) return;
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime() ||
      new Date(b.end).getTime() - new Date(a.end).getTime(),
  );
  const clusters: OverlapItem[][] = [];
  let cluster: OverlapItem[] = [];
  let clusterEnd = 0;
  for (const item of sorted) {
    const s = new Date(item.start).getTime();
    const e = new Date(item.end).getTime();
    if (cluster.length === 0 || s < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, e);
    } else {
      clusters.push(cluster);
      cluster = [item];
      clusterEnd = e;
    }
  }
  if (cluster.length > 0) clusters.push(cluster);
  for (const c of clusters) {
    const colEnds: number[] = [];
    for (const item of c) {
      const s = new Date(item.start).getTime();
      let col = colEnds.findIndex(end => end <= s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(0);
      }
      colEnds[col] = new Date(item.end).getTime();
      result.set(item.id, { col, total: 0 });
    }
    for (const item of c) {
      result.get(item.id)!.total = colEnds.length;
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
