import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ExportPort, ExportOptions } from '../../domain/ports/export.port';
import { getProjectDisplayName } from '../../domain/models/project.model';
import Papa from 'papaparse';
import { format, eachDayOfInterval, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

function formatHoursAsHHMM(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

@Injectable()
export class CsvExportAdapter implements ExportPort {
  readonly format = 'csv';

  export(options: ExportOptions): Observable<Blob> {
    const projectMap = new Map(options.projects.map(p => [p.id, p]));
    const sortedEntries = [...options.entries].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Entscheidung: Pausen-Einträge (pause=true) erscheinen in der Detailtabelle klar als
    // 'Pause' markiert (Transparenz für den Stundenzettel), zählen aber – konsistent zur
    // App-Ansicht (Tages-/Wochensumme filtert mit !e.pause) – NICHT in Summen oder die
    // Zusammenfassung. Daher werden alle Aggregationen auf workEntries (ohne Pausen) berechnet.
    const workEntries = sortedEntries.filter(e => !e.pause);

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

      const usedProjectIds = [...new Set(workEntries.map(e => e.projectId).filter(Boolean))] as string[];
      const summaryRows: Record<string, string>[] = [];
      const dayTotals = new Array(days.length).fill(0);
      let grandTotal = 0;

      for (const projectId of usedProjectIds) {
        const project = projectMap.get(projectId);
        const row: Record<string, string> = { Projekt: project ? getProjectDisplayName(project) : '' };
        let projectTotal = 0;
        days.forEach((day, i) => {
          const hours = workEntries
            .filter(e => e.projectId === projectId && isSameDay(new Date(e.start), day))
            .reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0);
          row[dayHeaders[i]] = hours > 0 ? formatHoursAsHHMM(hours) : '';
          projectTotal += hours;
          dayTotals[i] += hours;
        });
        row['Gesamt'] = formatHoursAsHHMM(projectTotal);
        grandTotal += projectTotal;
        summaryRows.push(row);
      }

      // Entries without project (Pausen sind hier bereits ausgeschlossen, da workEntries genutzt wird)
      const noProjectHours = days.map((day, i) => {
        const hours = workEntries
          .filter(e => !e.projectId && isSameDay(new Date(e.start), day))
          .reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0);
        dayTotals[i] += hours;
        return hours;
      });
      const noProjectTotal = noProjectHours.reduce((a, b) => a + b, 0);
      if (noProjectTotal > 0) {
        const row: Record<string, string> = { Projekt: 'Ohne Projekt' };
        days.forEach((_, i) => {
          row[dayHeaders[i]] = noProjectHours[i] > 0 ? formatHoursAsHHMM(noProjectHours[i]) : '';
        });
        row['Gesamt'] = formatHoursAsHHMM(noProjectTotal);
        grandTotal += noProjectTotal;
        summaryRows.push(row);
      }

      // Totals row
      const totalsRow: Record<string, string> = { Projekt: 'Gesamt' };
      days.forEach((_, i) => {
        totalsRow[dayHeaders[i]] = dayTotals[i] > 0 ? formatHoursAsHHMM(dayTotals[i]) : '';
      });
      totalsRow['Gesamt'] = formatHoursAsHHMM(grandTotal);
      summaryRows.push(totalsRow);

      const summaryCsv = Papa.unparse(summaryRows, { delimiter: ';', columns: ['Projekt', ...dayHeaders, 'Gesamt'] });
      csv += '\r\n\r\nProjektübersicht\r\n' + summaryCsv;
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    return of(blob);
  }
}
