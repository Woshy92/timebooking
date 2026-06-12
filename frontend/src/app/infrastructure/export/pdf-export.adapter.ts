import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ExportPort, ExportOptions } from '../../domain/ports/export.port';
import { Project, getProjectDisplayName } from '../../domain/models/project.model';
import { formatHoursAsHHMM, excludePauses, buildHoursMatrix } from './export-summary.util';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';

type Rgb = [number, number, number];

// Tint factors used to lighten a project colour towards white for table backgrounds.
// Higher factor → lighter background. Centralised here so every table uses the same scale.
const HEADER_TINT = 0.82; // grouped-view project header rows
const SUMMARY_ROW_TINT = 0.88; // detail + summary table body rows
const ENTRY_ROW_TINT = 0.93; // grouped-view entry rows

function parseHexColor(color: string): Rgb | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(color);
  if (!match) return null;
  const hex = match[1];
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

/** Lightens an RGB colour towards white by `factor` (0 = unchanged, 1 = white). */
function tint([r, g, b]: Rgb, factor: number): Rgb {
  return [
    Math.round(r + (255 - r) * factor),
    Math.round(g + (255 - g) * factor),
    Math.round(b + (255 - b) * factor),
  ];
}

interface ProjectColors {
  /** Full-strength project colour (used for the colour dot). */
  readonly rgb: Rgb;
  /** Background tint for grouped-view header rows. */
  readonly headerTint: Rgb;
  /** Background tint for detail/summary body rows. */
  readonly rowTint: Rgb;
  /** Background tint for grouped-view entry rows. */
  readonly entryTint: Rgb;
}

/**
 * Pre-computes per-project colour variants once, so the per-cell autoTable hooks
 * (didParseCell/didDrawCell) only look up a Map instead of re-parsing the hex
 * colour and recomputing tints for every cell.
 */
function buildProjectColorMap(projects: Project[]): Map<string, ProjectColors> {
  const map = new Map<string, ProjectColors>();
  for (const project of projects) {
    const rgb = project.color ? parseHexColor(project.color) : null;
    if (!rgb) continue;
    map.set(project.id, {
      rgb,
      headerTint: tint(rgb, HEADER_TINT),
      rowTint: tint(rgb, SUMMARY_ROW_TINT),
      entryTint: tint(rgb, ENTRY_ROW_TINT),
    });
  }
  return map;
}

@Injectable()
export class PdfExportAdapter implements ExportPort {
  readonly format = 'pdf';

  export(options: ExportOptions): Observable<Blob> {
    const doc = new jsPDF({ orientation: 'landscape' });
    const projectMap = new Map(options.projects.map(p => [p.id, p]));
    const colorMap = buildProjectColorMap(options.projects);

    doc.setFontSize(18);
    doc.text('Zeiterfassung', 14, 22);

    doc.setFontSize(11);
    doc.text(
      `${format(options.dateRange.from, 'dd.MM.yyyy', { locale: de })} - ${format(options.dateRange.to, 'dd.MM.yyyy', { locale: de })}`,
      14, 32
    );

    const sortedEntries = options.entries
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Pausen-Einträge erscheinen in der Detailtabelle als 'Pause', zählen aber nicht in
    // Summen/Zusammenfassung/Projektgruppierung (siehe excludePauses).
    const workEntries = excludePauses(sortedEntries);

    const rows = sortedEntries.map(entry => [
      format(entry.start, 'dd.MM.yyyy'),
      format(entry.start, 'HH:mm'),
      format(entry.end, 'HH:mm'),
      formatHoursAsHHMM((entry.end.getTime() - entry.start.getTime()) / 3600000),
      entry.pause ? 'Pause' : (entry.projectId ? (projectMap.get(entry.projectId) ? getProjectDisplayName(projectMap.get(entry.projectId)!) : '') : ''),
      entry.title,
    ]);

    const totalHours = workEntries.reduce(
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
          if (entry && !entry.pause && entry.projectId) {
            const colors = colorMap.get(entry.projectId);
            if (colors) {
              data.cell.styles.fillColor = colors.rowTint;
            }
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const entry = sortedEntries[data.row.index];
          if (entry && !entry.pause && entry.projectId) {
            const colors = colorMap.get(entry.projectId);
            if (colors) {
              const [r, g, b] = colors.rgb;
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
      const matrix = buildHoursMatrix(workEntries, days);
      const usedProjectIds = matrix.projectIds;

      const summaryHead = ['Projekt', ...days.map(d => format(d, 'EEE dd.MM.', { locale: de })), 'Gesamt'];
      const summaryBody: (string | number)[][] = [];

      for (const projectId of usedProjectIds) {
        const project = projectMap.get(projectId);
        const perDay = matrix.projectHours.get(projectId)!;
        const row: (string | number)[] = [project ? getProjectDisplayName(project) : ''];
        days.forEach((_, i) => row.push(perDay[i] > 0 ? formatHoursAsHHMM(perDay[i]) : ''));
        row.push(formatHoursAsHHMM(matrix.projectTotals.get(projectId)!));
        summaryBody.push(row);
      }

      // Entries without project (Pausen sind hier bereits ausgeschlossen, da workEntries genutzt wird)
      if (matrix.noProjectTotal > 0) {
        summaryBody.push(['Ohne Projekt', ...matrix.noProjectHours.map(h => h > 0 ? formatHoursAsHHMM(h) : ''), formatHoursAsHHMM(matrix.noProjectTotal)]);
      }

      const summaryFoot = ['Gesamt', ...matrix.dayTotals.map(h => h > 0 ? formatHoursAsHHMM(h) : ''), formatHoursAsHHMM(matrix.grandTotal)];

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
            const colors = pId ? colorMap.get(pId) : null;
            if (colors) {
              data.cell.styles.fillColor = colors.rowTint;
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const pId = usedProjectIds[data.row.index] ?? null;
            const colors = pId ? colorMap.get(pId) : null;
            if (colors) {
              const [r, g, b] = colors.rgb;
              doc.setFillColor(r, g, b);
              doc.circle(data.cell.x + 3.5, data.cell.y + data.cell.height / 2, 1.5, 'F');
            }
          }
        },
      });

      // ─── Grouped detail view (entries grouped by project) ───
      doc.addPage();

      doc.setFontSize(18);
      doc.text('Zeitübersicht nach Projekt', 14, 22);

      doc.setFontSize(11);
      doc.text(
        `${format(options.dateRange.from, 'dd.MM.yyyy', { locale: de })} - ${format(options.dateRange.to, 'dd.MM.yyyy', { locale: de })}`,
        14, 32
      );

      // Build grouped rows: project header → entries → subtotal
      type RowType = 'header' | 'entry' | 'subtotal';
      const groupedRows: { type: RowType; projectId?: string; data: string[] }[] = [];

      const allProjectIds = [...usedProjectIds];
      const hasNoProject = workEntries.some(e => !e.projectId);
      if (hasNoProject) allProjectIds.push('__none__');

      for (const pid of allProjectIds) {
        const project = pid === '__none__' ? null : projectMap.get(pid);
        const projectName = project ? getProjectDisplayName(project) : 'Ohne Projekt';
        const projectEntries = workEntries.filter(e =>
          pid === '__none__' ? !e.projectId : e.projectId === pid
        );
        if (projectEntries.length === 0) continue;

        const projectHours = projectEntries.reduce(
          (sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0
        );

        groupedRows.push({
          type: 'header',
          projectId: pid,
          data: [projectName, '', '', formatHoursAsHHMM(projectHours), ''],
        });

        for (const entry of projectEntries) {
          groupedRows.push({
            type: 'entry',
            projectId: pid,
            data: [
              format(entry.start, 'dd.MM.yyyy'),
              format(entry.start, 'HH:mm'),
              format(entry.end, 'HH:mm'),
              formatHoursAsHHMM((entry.end.getTime() - entry.start.getTime()) / 3600000),
              entry.title,
            ],
          });
        }
      }

      autoTable(doc, {
        startY: 40,
        head: [['Datum / Projekt', 'Von', 'Bis', 'Dauer', 'Beschreibung']],
        body: groupedRows.map(r => r.data),
        foot: [['', '', '', formatHoursAsHHMM(totalHours), 'Gesamt']],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [79, 70, 229] },
        footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 0: { cellPadding: { top: 2, bottom: 2, left: 6, right: 2 } } },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const row = groupedRows[data.row.index];
          if (!row) return;

          const colors = row.projectId && row.projectId !== '__none__' ? colorMap.get(row.projectId) : null;
          if (row.type === 'header') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 10;
            data.cell.styles.fillColor = colors ? colors.headerTint : [235, 235, 235];
          } else if (row.type === 'entry') {
            if (colors) {
              data.cell.styles.fillColor = colors.entryTint;
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 0) return;
          const row = groupedRows[data.row.index];
          if (row?.type === 'header') {
            const colors = row.projectId && row.projectId !== '__none__' ? colorMap.get(row.projectId) : null;
            if (colors) {
              const [r, g, b] = colors.rgb;
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
