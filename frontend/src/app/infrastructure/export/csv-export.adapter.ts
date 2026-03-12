import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ExportPort, ExportOptions } from '../../domain/ports/export.port';
import { getProjectDisplayName } from '../../domain/models/project.model';
import Papa from 'papaparse';
import { format } from 'date-fns';

@Injectable()
export class CsvExportAdapter implements ExportPort {
  readonly format = 'csv';

  export(options: ExportOptions): Observable<Blob> {
    const projectMap = new Map(options.projects.map(p => [p.id, p]));

    const rows = options.entries.map(entry => ({
      Datum: format(entry.start, 'dd.MM.yyyy'),
      Von: format(entry.start, 'HH:mm'),
      Bis: format(entry.end, 'HH:mm'),
      'Dauer (h)': ((entry.end.getTime() - entry.start.getTime()) / 3600000).toFixed(2),
      Projekt: entry.projectId ? (projectMap.get(entry.projectId) ? getProjectDisplayName(projectMap.get(entry.projectId)!) : '') : '',
      Beschreibung: entry.title,
      Notizen: entry.notes ?? '',
    }));

    const csv = Papa.unparse(rows, { delimiter: ';' });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    return of(blob);
  }
}
