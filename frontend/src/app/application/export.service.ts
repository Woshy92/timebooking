import { Injectable, inject } from '@angular/core';
import { PDF_EXPORT_PORT, CSV_EXPORT_PORT, ExportOptions } from '../domain/ports/export.port';
import { TimeEntryStore } from '../state/time-entry.store';
import { ProjectStore } from '../state/project.store';
import { TimeEntry } from '../domain/models/time-entry.model';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly pdfPort = inject(PDF_EXPORT_PORT);
  private readonly csvPort = inject(CSV_EXPORT_PORT);
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);

  export(format: 'pdf' | 'csv', dateRange: { from: Date; to: Date }, includeSummary = false, mergeConsecutive = false): void {
    let entries = this.timeEntryStore.entries().filter(e => {
      const start = new Date(e.start);
      return start >= dateRange.from && start <= dateRange.to;
    });

    if (mergeConsecutive) {
      entries = this.mergeConsecutiveEntries(entries);
    }

    const options: ExportOptions = {
      entries,
      projects: this.projectStore.projects(),
      dateRange,
      includeSummary,
      mergeConsecutive,
    };

    const port = format === 'pdf' ? this.pdfPort : this.csvPort;
    const extension = format === 'pdf' ? 'pdf' : 'csv';
    const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';

    port.export(options).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zeiterfassung.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  private mergeConsecutiveEntries(entries: TimeEntry[]): TimeEntry[] {
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
}
