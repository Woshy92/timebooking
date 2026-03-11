import { Injectable, inject } from '@angular/core';
import { PDF_EXPORT_PORT, CSV_EXPORT_PORT, ExportOptions } from '../domain/ports/export.port';
import { TimeEntryStore } from '../state/time-entry.store';
import { ProjectStore } from '../state/project.store';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly pdfPort = inject(PDF_EXPORT_PORT);
  private readonly csvPort = inject(CSV_EXPORT_PORT);
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);

  export(format: 'pdf' | 'csv', dateRange: { from: Date; to: Date }, includeSummary = false): void {
    const entries = this.timeEntryStore.entries().filter(e => {
      const start = new Date(e.start);
      return start >= dateRange.from && start <= dateRange.to;
    });
    const options: ExportOptions = {
      entries,
      projects: this.projectStore.projects(),
      dateRange,
      includeSummary,
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
}
