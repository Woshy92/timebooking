import { Injectable, inject, signal } from '@angular/core';
import { PDF_EXPORT_PORT, CSV_EXPORT_PORT, ExportOptions } from '../domain/ports/export.port';
import { TimeEntryStore } from '../state/time-entry.store';
import { ProjectStore } from '../state/project.store';
import { CalendarStore } from '../state/calendar.store';
import { mergeConsecutiveEntries } from '../shared/utils/merge-entries';
import { format } from 'date-fns';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly pdfPort = inject(PDF_EXPORT_PORT);
  private readonly csvPort = inject(CSV_EXPORT_PORT);
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);

  private readonly _busy = signal(false);
  readonly busy = this._busy.asReadonly();

  export(fmt: 'pdf' | 'csv', dateRange: { from: Date; to: Date }, includeSummary = false, mergeConsecutive = false): void {
    if (this._busy()) {
      return;
    }

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

    this._busy.set(true);
    port.export(options).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      },
      error: () => {
        this._busy.set(false);
        this.calendarStore.setError('Export fehlgeschlagen');
      },
      complete: () => {
        this._busy.set(false);
      },
    });
  }

}

