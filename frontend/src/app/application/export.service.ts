import { Injectable, inject } from '@angular/core';
import { PDF_EXPORT_PORT, CSV_EXPORT_PORT, ExportOptions } from '../domain/ports/export.port';
import { TimeEntryStore } from '../state/time-entry.store';
import { ProjectStore } from '../state/project.store';
import { mergeConsecutiveEntries } from '../shared/utils/merge-entries';
import { format } from 'date-fns';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly pdfPort = inject(PDF_EXPORT_PORT);
  private readonly csvPort = inject(CSV_EXPORT_PORT);
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);

  export(fmt: 'pdf' | 'csv', dateRange: { from: Date; to: Date }, includeSummary = false, mergeConsecutive = false): void {
    let entries = this.timeEntryStore.entries().filter(e => {
      const start = new Date(e.start);
      return start >= dateRange.from && start <= dateRange.to;
    });

    if (mergeConsecutive) {
      entries = mergeConsecutiveEntries(entries);
    }

    const options: ExportOptions = {
      entries,
      projects: this.projectStore.projects(),
      dateRange,
      includeSummary,
      mergeConsecutive,
    };

    const port = fmt === 'pdf' ? this.pdfPort : this.csvPort;
    const extension = fmt === 'pdf' ? 'pdf' : 'csv';

    const from = format(dateRange.from, 'yyyy-MM-dd');
    const to = format(dateRange.to, 'yyyy-MM-dd');
    const filename = `Zeiterfassung_${from}_${to}.${extension}`;

    port.export(options).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

}

