import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ExportPort, ExportOptions } from '../../domain/ports/export.port';
import { getProjectDisplayName } from '../../domain/models/project.model';
import { formatHoursAsHHMM, excludePauses, buildHoursMatrix } from './export-summary.util';
import Papa from 'papaparse';
import { format, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';

@Injectable()
export class CsvExportAdapter implements ExportPort {
  readonly format = 'csv';

  export(options: ExportOptions): Observable<Blob> {
    const projectMap = new Map(options.projects.map(p => [p.id, p]));
    const sortedEntries = [...options.entries].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Pausen-Einträge erscheinen in der Detailtabelle als 'Pause', zählen aber nicht in
    // Summen/Zusammenfassung (siehe excludePauses). Aggregationen nutzen workEntries.
    const workEntries = excludePauses(sortedEntries);

    const detailRows = sortedEntries.map(entry => ({
      Datum: format(entry.start, 'dd.MM.yyyy'),
      Von: format(entry.start, 'HH:mm'),
      Bis: format(entry.end, 'HH:mm'),
      'Dauer (h)': ((entry.end.getTime() - entry.start.getTime()) / 3600000).toFixed(2),
      Projekt: entry.pause ? 'Pause' : (entry.projectId ? (projectMap.get(entry.projectId) ? getProjectDisplayName(projectMap.get(entry.projectId)!) : '') : ''),
      Beschreibung: entry.title,
      Notizen: entry.notes ?? '',
    }));

    let csv = Papa.unparse(detailRows, { delimiter: ';' });

    if (options.includeSummary) {
      const days = eachDayOfInterval({ start: options.dateRange.from, end: options.dateRange.to });
      const dayHeaders = days.map(d => format(d, 'EEE dd.MM.', { locale: de }));

      const matrix = buildHoursMatrix(workEntries, days);
      const summaryRows: Record<string, string>[] = [];

      for (const projectId of matrix.projectIds) {
        const project = projectMap.get(projectId);
        const row: Record<string, string> = { Projekt: project ? getProjectDisplayName(project) : '' };
        const perDay = matrix.projectHours.get(projectId)!;
        days.forEach((_, i) => {
          row[dayHeaders[i]] = perDay[i] > 0 ? formatHoursAsHHMM(perDay[i]) : '';
        });
        row['Gesamt'] = formatHoursAsHHMM(matrix.projectTotals.get(projectId)!);
        summaryRows.push(row);
      }

      // Entries without project (Pausen sind hier bereits ausgeschlossen, da workEntries genutzt wird)
      if (matrix.noProjectTotal > 0) {
        const row: Record<string, string> = { Projekt: 'Ohne Projekt' };
        days.forEach((_, i) => {
          row[dayHeaders[i]] = matrix.noProjectHours[i] > 0 ? formatHoursAsHHMM(matrix.noProjectHours[i]) : '';
        });
        row['Gesamt'] = formatHoursAsHHMM(matrix.noProjectTotal);
        summaryRows.push(row);
      }

      // Totals row
      const totalsRow: Record<string, string> = { Projekt: 'Gesamt' };
      days.forEach((_, i) => {
        totalsRow[dayHeaders[i]] = matrix.dayTotals[i] > 0 ? formatHoursAsHHMM(matrix.dayTotals[i]) : '';
      });
      totalsRow['Gesamt'] = formatHoursAsHHMM(matrix.grandTotal);
      summaryRows.push(totalsRow);

      const summaryCsv = Papa.unparse(summaryRows, { delimiter: ';', columns: ['Projekt', ...dayHeaders, 'Gesamt'] });
      csv += '\r\n\r\nProjektübersicht\r\n' + summaryCsv;
    }

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    return of(blob);
  }
}
