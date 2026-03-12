import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { TimeEntry } from '../models/time-entry.model';
import { Project } from '../models/project.model';

export interface ExportOptions {
  entries: TimeEntry[];
  projects: Project[];
  dateRange: { from: Date; to: Date };
  filename?: string;
  includeSummary?: boolean;
  mergeConsecutive?: boolean;
}

export interface ExportPort {
  readonly format: string;
  export(options: ExportOptions): Observable<Blob>;
}

export const PDF_EXPORT_PORT = new InjectionToken<ExportPort>('PdfExportPort');
export const CSV_EXPORT_PORT = new InjectionToken<ExportPort>('CsvExportPort');
