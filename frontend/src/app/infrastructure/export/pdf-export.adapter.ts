import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ExportPort, ExportOptions } from '../../domain/ports/export.port';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, eachDayOfInterval, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

function formatHoursAsHHMM(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(color);
  if (!match) return null;
  const hex = match[1];
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

@Injectable()
export class PdfExportAdapter implements ExportPort {
  readonly format = 'pdf';

  export(options: ExportOptions): Observable<Blob> {
    const doc = new jsPDF({ orientation: 'landscape' });
    const projectMap = new Map(options.projects.map(p => [p.id, p]));

    doc.setFontSize(18);
    doc.text('Zeiterfassung', 14, 22);

    doc.setFontSize(11);
    doc.text(
      `${format(options.dateRange.from, 'dd.MM.yyyy', { locale: de })} - ${format(options.dateRange.to, 'dd.MM.yyyy', { locale: de })}`,
      14, 32
    );

    const sortedEntries = options.entries
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const rows = sortedEntries.map(entry => [
      format(entry.start, 'dd.MM.yyyy'),
      format(entry.start, 'HH:mm'),
      format(entry.end, 'HH:mm'),
      formatHoursAsHHMM((entry.end.getTime() - entry.start.getTime()) / 3600000),
      entry.projectId ? (projectMap.get(entry.projectId)?.name ?? '') : '',
      entry.title,
    ]);

    const totalHours = options.entries.reduce(
      (sum, e) => sum + (e.end.getTime() - e.start.getTime()) / 3600000, 0
    );

    autoTable(doc, {
      startY: 40,
      head: [['Datum', 'Von', 'Bis', 'Dauer', 'Projekt', 'Beschreibung']],
      body: rows,
      foot: [['', '', '', formatHoursAsHHMM(totalHours), '', 'Gesamt']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 4: { cellPadding: { top: 2, bottom: 2, left: 6, right: 2 } } },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const entry = sortedEntries[data.row.index];
          if (entry?.projectId) {
            const project = projectMap.get(entry.projectId);
            const rgb = project?.color ? parseHexColor(project.color) : null;
            if (rgb) {
              const [r, g, b] = rgb;
              data.cell.styles.fillColor = [
                Math.round(r + (255 - r) * 0.88),
                Math.round(g + (255 - g) * 0.88),
                Math.round(b + (255 - b) * 0.88),
              ];
            }
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const entry = sortedEntries[data.row.index];
          if (entry?.projectId) {
            const project = projectMap.get(entry.projectId);
            const rgb = project?.color ? parseHexColor(project.color) : null;
            if (rgb) {
              const [r, g, b] = rgb;
              doc.setFillColor(r, g, b);
              doc.circle(data.cell.x + 3.5, data.cell.y + data.cell.height / 2, 1.5, 'F');
            }
          }
        }
      },
    });

    if (options.includeSummary) {
      doc.addPage();

      doc.setFontSize(18);
      doc.text('Projektübersicht', 14, 22);

      doc.setFontSize(11);
      doc.text(
        `${format(options.dateRange.from, 'dd.MM.yyyy', { locale: de })} - ${format(options.dateRange.to, 'dd.MM.yyyy', { locale: de })}`,
        14, 32
      );

      const days = eachDayOfInterval({ start: options.dateRange.from, end: options.dateRange.to });
      const usedProjectIds = [...new Set(sortedEntries.map(e => e.projectId).filter(Boolean))] as string[];

      const summaryHead = ['Projekt', ...days.map(d => format(d, 'EEE dd.MM.', { locale: de })), 'Gesamt'];
      const summaryBody: (string | number)[][] = [];
      const dayTotals = new Array(days.length).fill(0);
      let grandTotal = 0;

      for (const projectId of usedProjectIds) {
        const project = projectMap.get(projectId);
        const row: (string | number)[] = [project?.name ?? ''];
        let projectTotal = 0;
        days.forEach((day, i) => {
          const hours = sortedEntries
            .filter(e => e.projectId === projectId && isSameDay(new Date(e.start), day))
            .reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0);
          row.push(hours > 0 ? formatHoursAsHHMM(hours) : '');
          projectTotal += hours;
          dayTotals[i] += hours;
        });
        row.push(formatHoursAsHHMM(projectTotal));
        grandTotal += projectTotal;
        summaryBody.push(row);
      }

      // Entries without project
      const noProjectHours = days.map((day, i) => {
        const hours = sortedEntries
          .filter(e => !e.projectId && isSameDay(new Date(e.start), day))
          .reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0);
        dayTotals[i] += hours;
        return hours;
      });
      const noProjectTotal = noProjectHours.reduce((a, b) => a + b, 0);
      if (noProjectTotal > 0) {
        grandTotal += noProjectTotal;
        summaryBody.push(['Ohne Projekt', ...noProjectHours.map(h => h > 0 ? formatHoursAsHHMM(h) : ''), formatHoursAsHHMM(noProjectTotal)]);
      }

      const summaryFoot = ['Gesamt', ...dayTotals.map(h => h > 0 ? formatHoursAsHHMM(h) : ''), formatHoursAsHHMM(grandTotal)];

      autoTable(doc, {
        startY: 40,
        head: [summaryHead],
        body: summaryBody,
        foot: [summaryFoot],
        styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [79, 70, 229] },
        footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', cellPadding: { top: 2, bottom: 2, left: 6, right: 2 } } },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const pId = usedProjectIds[data.row.index] ?? null;
            const project = pId ? projectMap.get(pId) : null;
            const rgb = project?.color ? parseHexColor(project.color) : null;
            if (rgb) {
              const [r, g, b] = rgb;
              data.cell.styles.fillColor = [
                Math.round(r + (255 - r) * 0.88),
                Math.round(g + (255 - g) * 0.88),
                Math.round(b + (255 - b) * 0.88),
              ];
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const pId = usedProjectIds[data.row.index] ?? null;
            const project = pId ? projectMap.get(pId) : null;
            const rgb = project?.color ? parseHexColor(project.color) : null;
            if (rgb) {
              const [r, g, b] = rgb;
              doc.setFillColor(r, g, b);
              doc.circle(data.cell.x + 3.5, data.cell.y + data.cell.height / 2, 1.5, 'F');
            }
          }
        },
      });
    }

    const blob = doc.output('blob');
    return of(blob);
  }
}
