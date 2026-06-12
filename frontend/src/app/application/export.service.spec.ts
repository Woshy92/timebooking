import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { firstValueFrom, of, throwError, Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { mergeConsecutiveEntries } from '../shared/utils/merge-entries';
import { TimeEntry } from '../domain/models/time-entry.model';
import { Project } from '../domain/models/project.model';
import { CsvExportAdapter } from '../infrastructure/export/csv-export.adapter';
import { PdfExportAdapter } from '../infrastructure/export/pdf-export.adapter';
import { ExportOptions, ExportPort, PDF_EXPORT_PORT, CSV_EXPORT_PORT } from '../domain/ports/export.port';
import { ExportService } from './export.service';
import { TimeEntryStore } from '../state/time-entry.store';
import { ProjectStore } from '../state/project.store';
import { CalendarStore } from '../state/calendar.store';

function entry(id: string, title: string, startH: number, endH: number, projectId?: string): TimeEntry {
  return {
    id,
    title,
    start: new Date(2026, 2, 12, startH, 0),
    end: new Date(2026, 2, 12, endH, 0),
    source: 'manual',
    projectId,
  };
}

function pauseEntry(id: string, title: string, startH: number, endH: number, projectId?: string): TimeEntry {
  return { ...entry(id, title, startH, endH, projectId), pause: true };
}

function project(id: string, name: string): Project {
  return {
    id,
    name,
    rate: '',
    color: '#FF0000',
    archived: false,
    favorite: false,
    ignored: false,
    billable: true,
    order: 0,
  };
}

function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function csvText(options: ExportOptions): Promise<string> {
  const blob = await firstValueFrom(new CsvExportAdapter().export(options));
  return blobToText(blob);
}

describe('mergeConsecutiveEntries', () => {
  it('returns empty for empty input', () => {
    expect(mergeConsecutiveEntries([])).toEqual([]);
  });

  it('returns single entry unchanged', () => {
    const entries = [entry('a', 'Task A', 9, 10, 'p1')];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task A');
  });

  it('merges consecutive entries with same project', () => {
    const entries = [
      entry('a', 'Task A', 9, 10, 'p1'),
      entry('b', 'Task B', 10, 11, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task A; Task B');
    expect(new Date(result[0].start).getHours()).toBe(9);
    expect(new Date(result[0].end).getHours()).toBe(11);
  });

  it('merges overlapping entries with same project', () => {
    const entries = [
      entry('a', 'Task A', 9, 11, 'p1'),
      entry('b', 'Task B', 10, 12, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(new Date(result[0].end).getHours()).toBe(12);
  });

  it('does not merge entries with different projects', () => {
    const entries = [
      entry('a', 'Task A', 9, 10, 'p1'),
      entry('b', 'Task B', 10, 11, 'p2'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(2);
  });

  it('does not merge entries without projectId', () => {
    const entries = [
      entry('a', 'Task A', 9, 10),
      entry('b', 'Task B', 10, 11),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(2);
  });

  it('does not merge entries with a gap', () => {
    const entries = [
      entry('a', 'Task A', 9, 10, 'p1'),
      entry('b', 'Task B', 11, 12, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(2);
  });

  it('deduplicates titles when merging', () => {
    const entries = [
      entry('a', 'Meeting', 9, 10, 'p1'),
      entry('b', 'Meeting', 10, 11, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Meeting');
  });

  it('sorts unsorted input before merging', () => {
    const entries = [
      entry('b', 'Task B', 10, 11, 'p1'),
      entry('a', 'Task A', 9, 10, 'p1'),
    ];
    const result = mergeConsecutiveEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task A; Task B');
  });
});

const DATE_RANGE = { from: new Date(2026, 2, 12, 0, 0), to: new Date(2026, 2, 12, 23, 59) };

describe('CsvExportAdapter – Pausen', () => {
  it('schließt Pausen aus der Gesamtsumme aus (6h Arbeit + 1h Pause = 6:00)', async () => {
    const csv = await csvText({
      entries: [entry('a', 'Arbeit', 9, 15, 'p1'), pauseEntry('b', 'Mittag', 12, 13)],
      projects: [project('p1', 'Projekt 1')],
      dateRange: DATE_RANGE,
      includeSummary: true,
    });

    // Gesamtsumme der Projektübersicht = 6:00, nicht 7:00
    expect(csv).toContain('Gesamt;6:00');
    expect(csv).not.toContain('7:00');
  });

  it('markiert Pausen-Zeilen in der Detailtabelle als "Pause"', async () => {
    const csv = await csvText({
      entries: [entry('a', 'Arbeit', 9, 15, 'p1'), pauseEntry('b', 'Mittag', 12, 13)],
      projects: [project('p1', 'Projekt 1')],
      dateRange: DATE_RANGE,
    });

    const detailLines = csv.split('\r\n');
    const pauseLine = detailLines.find(l => l.includes('Mittag'));
    expect(pauseLine).toBeDefined();
    // Projekt-Spalte (5. Feld) der Pausen-Zeile ist "Pause"
    expect(pauseLine!.split(';')[4]).toBe('Pause');
  });

  it('zählt Pausen nicht unter "Ohne Projekt" in der Zusammenfassung', async () => {
    const csv = await csvText({
      entries: [entry('a', 'Arbeit', 9, 15, 'p1'), pauseEntry('b', 'Mittag', 12, 13)],
      projects: [project('p1', 'Projekt 1')],
      dateRange: DATE_RANGE,
      includeSummary: true,
    });

    // Pause hat keine projectId -> dürfte ohne Filter unter "Ohne Projekt" auftauchen
    expect(csv).not.toContain('Ohne Projekt');
  });

  it('zeigt Pausen-Dauer weiterhin in der Detailtabelle (Transparenz)', async () => {
    const csv = await csvText({
      entries: [pauseEntry('b', 'Mittag', 12, 13)],
      projects: [],
      dateRange: DATE_RANGE,
    });

    const pauseLine = csv.split('\r\n').find(l => l.includes('Mittag'));
    expect(pauseLine).toBeDefined();
    // Dauer (4. Feld) = 1.00h, bleibt in der Detailansicht sichtbar
    expect(pauseLine!.split(';')[3]).toBe('1.00');
  });
});

describe('PdfExportAdapter – Pausen', () => {
  it('erzeugt ein PDF-Blob auch mit Pausen-Einträgen (Smoke)', async () => {
    const options: ExportOptions = {
      entries: [entry('a', 'Arbeit', 9, 15, 'p1'), pauseEntry('b', 'Mittag', 12, 13)],
      projects: [project('p1', 'Projekt 1')],
      dateRange: DATE_RANGE,
      includeSummary: true,
    };
    const blob = await firstValueFrom(new PdfExportAdapter().export(options));
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('pdf');
  });
});

describe('ExportService – Fehlerbehandlung & Busy-State', () => {
  beforeAll(() => {
    // No global Angular test setup file exists in this project; initialize it here.
    // initTestEnvironment throws if already initialized, which is harmless for this suite.
    try {
      TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch {
      // already initialized by another spec
    }
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    // jsdom does not implement createObjectURL; stub it so the success path can run.
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:stub'), revokeObjectURL: vi.fn() });
    // Prevent the synthesized <a>.click() from triggering any navigation noise.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  function setup(pdfPort: Partial<ExportPort>, csvPort: Partial<ExportPort> = pdfPort) {
    const setError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ExportService,
        { provide: PDF_EXPORT_PORT, useValue: pdfPort },
        { provide: CSV_EXPORT_PORT, useValue: csvPort },
        { provide: TimeEntryStore, useValue: { entries: () => [] } },
        { provide: ProjectStore, useValue: { projects: () => [] } },
        { provide: CalendarStore, useValue: { setError } },
      ],
    });
    const service = TestBed.inject(ExportService);
    return { service, setError };
  }

  const RANGE = { from: new Date(2026, 2, 12, 0, 0), to: new Date(2026, 2, 12, 23, 59) };

  it('meldet einen Port-Fehler über setError statt ihn zu verschlucken', () => {
    const { service, setError } = setup({
      format: 'pdf',
      export: () => throwError(() => new Error('boom')),
    });

    service.export('pdf', RANGE);

    expect(setError).toHaveBeenCalledWith('Export fehlgeschlagen');
  });

  it('setzt busy nach einem Fehler wieder auf false zurück', () => {
    const { service } = setup({
      format: 'pdf',
      export: () => throwError(() => new Error('boom')),
    });

    expect(service.busy()).toBe(false);
    service.export('pdf', RANGE);
    expect(service.busy()).toBe(false);
  });

  it('setzt busy nach erfolgreichem Export wieder auf false zurück', () => {
    const { service, setError } = setup({
      format: 'pdf',
      export: () => of(new Blob(['ok'], { type: 'application/pdf' })),
    });

    service.export('pdf', RANGE);

    expect(service.busy()).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it('hält busy auf true, solange der Export läuft', () => {
    const subject = new Subject<Blob>();
    const { service } = setup({
      format: 'pdf',
      export: () => subject.asObservable(),
    });

    service.export('pdf', RANGE);
    expect(service.busy()).toBe(true);

    subject.next(new Blob(['ok'], { type: 'application/pdf' }));
    subject.complete();
    expect(service.busy()).toBe(false);
  });

  it('verhindert einen zweiten parallelen Export (Doppelklick-Schutz)', () => {
    const exportFn = vi.fn(() => new Subject<Blob>().asObservable());
    const { service } = setup({ format: 'pdf', export: exportFn });

    service.export('pdf', RANGE);
    service.export('pdf', RANGE);

    expect(exportFn).toHaveBeenCalledTimes(1);
  });
});
