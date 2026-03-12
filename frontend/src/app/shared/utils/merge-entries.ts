import { TimeEntry } from '../../domain/models/time-entry.model';

export function mergeConsecutiveEntries(entries: TimeEntry[]): TimeEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const groups: { entry: TimeEntry; titles: string[] }[] = [
    { entry: { ...sorted[0] }, titles: [sorted[0].title] },
  ];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const current = groups[groups.length - 1];
    if (
      next.projectId &&
      current.entry.projectId &&
      next.projectId === current.entry.projectId &&
      new Date(next.start).getTime() <= new Date(current.entry.end).getTime()
    ) {
      current.entry = {
        ...current.entry,
        end: new Date(Math.max(new Date(current.entry.end).getTime(), new Date(next.end).getTime())),
      };
      if (!current.titles.includes(next.title)) {
        current.titles.push(next.title);
      }
    } else {
      groups.push({ entry: { ...next }, titles: [next.title] });
    }
  }

  return groups.map(g => ({
    ...g.entry,
    title: g.titles.join('; '),
  }));
}
