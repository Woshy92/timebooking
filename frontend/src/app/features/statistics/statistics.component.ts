import {
  Component, computed, effect, ElementRef, inject, OnDestroy, signal, viewChild,
} from '@angular/core';
import { STORAGE_PORT } from '../../domain/ports/storage.port';
import { ProjectStore } from '../../state/project.store';
import { TimeEntry } from '../../domain/models/time-entry.model';
import { Project, getProjectDisplayName } from '../../domain/models/project.model';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  endOfDay, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  getISOWeek, differenceInDays,
} from 'date-fns';
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

type ChartType = 'bar' | 'line' | 'doughnut';
type Granularity = 'day' | 'week' | 'month';
type QuickRange = 'week' | 'month' | 'year' | null;
type ViewMode = 'project' | 'billable';

interface SummaryRow {
  projectId: string;
  name: string;
  color: string;
  hours: number;
  percentage: number;
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  template: `
    <div class="h-full flex flex-col p-6 gap-6 overflow-auto">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Date range -->
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-600">Von</label>
          <input type="date"
            [value]="rangeFrom()"
            (input)="setFromDate($any($event.target).value)"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-600">Bis</label>
          <input type="date"
            [value]="rangeTo()"
            (input)="setToDate($any($event.target).value)"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
        </div>

        <!-- Quick ranges -->
        <div class="flex gap-1">
          @for (qr of quickRanges; track qr.value) {
            <button (click)="setQuickRange(qr.value)"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
              [class.bg-indigo-50]="quickRange() === qr.value"
              [class.border-indigo-300]="quickRange() === qr.value"
              [class.text-indigo-700]="quickRange() === qr.value"
              [class.border-gray-300]="quickRange() !== qr.value"
              [class.text-gray-600]="quickRange() !== qr.value"
              [class.hover:bg-gray-50]="quickRange() !== qr.value">
              {{ qr.label }}
            </button>
          }
        </div>

        <!-- View mode -->
        <div class="flex bg-gray-100 rounded-lg p-0.5">
          @for (vm of viewModes; track vm.value) {
            <button (click)="viewMode.set(vm.value)"
              class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
              [class.bg-white]="viewMode() === vm.value"
              [class.shadow-sm]="viewMode() === vm.value"
              [class.text-gray-900]="viewMode() === vm.value"
              [class.text-gray-500]="viewMode() !== vm.value">
              {{ vm.label }}
            </button>
          }
        </div>

        <div class="flex-1"></div>

        <!-- Granularity (for bar/line) -->
        @if (chartType() !== 'doughnut') {
          <div class="flex items-center gap-1.5">
            <div class="flex bg-gray-100 rounded-lg p-0.5">
              @for (g of granularities; track g.value) {
                <button (click)="setGranularity(g.value)"
                  class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
                  [class.bg-white]="granularity() === g.value"
                  [class.shadow-sm]="granularity() === g.value"
                  [class.text-gray-900]="granularity() === g.value"
                  [class.text-gray-500]="granularity() !== g.value">
                  {{ g.label }}
                </button>
              }
            </div>
            @if (granularityOverride() !== null) {
              <button (click)="granularityOverride.set(null)"
                class="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                title="Automatische Granularität verwenden">
                Auto
              </button>
            }
          </div>
        }

        <!-- Chart type -->
        <div class="flex bg-gray-100 rounded-lg p-0.5">
          @for (ct of chartTypes; track ct.value) {
            <button (click)="chartType.set(ct.value)"
              class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
              [class.bg-white]="chartType() === ct.value"
              [class.shadow-sm]="chartType() === ct.value"
              [class.text-gray-900]="chartType() === ct.value"
              [class.text-gray-500]="chartType() !== ct.value">
              {{ ct.label }}
            </button>
          }
        </div>
      </div>

      <!-- Chart -->
      <div class="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px] relative">
        @if (loading()) {
          <div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            Laden...
          </div>
        }
        @if (entries().length === 0 && !loading()) {
          <div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            Keine Einträge im gewählten Zeitraum
          </div>
        }
        <canvas #chartCanvas [class.invisible]="loading() || entries().length === 0"></canvas>
      </div>

      <!-- Summary table -->
      @if (summaryData().length > 0) {
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-3 font-medium text-gray-600">Projekt</th>
                <th class="text-right px-4 py-3 font-medium text-gray-600">Stunden</th>
                <th class="text-right px-4 py-3 font-medium text-gray-600">Anteil</th>
              </tr>
            </thead>
            <tbody>
              @for (row of summaryData(); track row.projectId) {
                <tr class="border-b border-gray-100 last:border-b-0">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full inline-block shrink-0"
                            [style.background-color]="row.color"></span>
                      {{ row.name }}
                    </div>
                  </td>
                  <td class="text-right px-4 py-3 tabular-nums">{{ row.hours.toFixed(1) }}h</td>
                  <td class="text-right px-4 py-3 tabular-nums text-gray-500">{{ row.percentage.toFixed(1) }}%</td>
                </tr>
              }
              <tr class="bg-gray-50 font-medium">
                <td class="px-4 py-3">Gesamt</td>
                <td class="text-right px-4 py-3 tabular-nums">{{ totalHours().toFixed(1) }}h</td>
                <td class="text-right px-4 py-3 tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
})
export class StatisticsComponent implements OnDestroy {
  private readonly storage = inject(STORAGE_PORT);
  private readonly projectStore = inject(ProjectStore);

  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  // State
  readonly rangeFrom = signal(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  readonly rangeTo = signal(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  readonly chartType = signal<ChartType>('line');
  readonly granularityOverride = signal<Granularity | null>(null);
  readonly quickRange = signal<QuickRange>('month');
  readonly entries = signal<TimeEntry[]>([]);
  readonly loading = signal(false);
  readonly viewMode = signal<ViewMode>('project');

  // Auto-granularity: <14 Tage → Tag, <6 Monate → Woche, sonst → Monat
  readonly autoGranularity = computed<Granularity>(() => {
    const days = differenceInDays(new Date(this.rangeTo()), new Date(this.rangeFrom()));
    if (days < 14) return 'day';
    if (days < 180) return 'week';
    return 'month';
  });

  readonly granularity = computed<Granularity>(() =>
    this.granularityOverride() ?? this.autoGranularity()
  );

  // Constants
  readonly chartTypes: { value: ChartType; label: string }[] = [
    { value: 'line', label: 'Linie' },
    { value: 'bar', label: 'Balken' },
    { value: 'doughnut', label: 'Kreis' },
  ];
  readonly granularities: { value: Granularity; label: string }[] = [
    { value: 'day', label: 'Tag' },
    { value: 'week', label: 'Woche' },
    { value: 'month', label: 'Monat' },
  ];
  readonly quickRanges: { value: 'week' | 'month' | 'year'; label: string }[] = [
    { value: 'week', label: 'Diese Woche' },
    { value: 'month', label: 'Dieser Monat' },
    { value: 'year', label: 'Dieses Jahr' },
  ];
  readonly viewModes: { value: ViewMode; label: string }[] = [
    { value: 'project', label: 'Projekte' },
    { value: 'billable', label: 'Abrechenbar' },
  ];

  // Computed
  readonly totalHours = computed(() =>
    this.entries().reduce((sum, e) => sum + (e.end.getTime() - e.start.getTime()) / 3600000, 0)
  );

  readonly summaryData = computed<SummaryRow[]>(() => {
    const entries = this.entries();
    const projectMap = this.projectStore.projectMap();
    const total = this.totalHours();
    if (total === 0) return [];

    const hoursByGroup = new Map<string, number>();
    for (const e of entries) {
      const key = this.getGroupKey(e, projectMap);
      hoursByGroup.set(
        key,
        (hoursByGroup.get(key) ?? 0) + (e.end.getTime() - e.start.getTime()) / 3600000,
      );
    }

    return [...hoursByGroup.entries()]
      .map(([groupKey, hours]) => {
        const meta = this.getGroupMeta(groupKey, projectMap);
        return {
          projectId: groupKey,
          name: meta.name,
          color: meta.color,
          hours,
          percentage: (hours / total) * 100,
        };
      })
      .sort((a, b) => b.hours - a.hours);
  });

  private chart: Chart | null = null;
  private currentBuckets: { start: Date; end: Date; label: string }[] = [];

  constructor() {
    // Load data when date range changes
    effect(() => {
      const from = new Date(this.rangeFrom());
      const to = endOfDay(new Date(this.rangeTo()));
      this.loadData(from, to);
    });

    // Render chart when dependencies change
    effect(() => {
      const canvas = this.chartCanvas();
      if (!canvas) return;
      const entries = this.entries();
      if (entries.length === 0) {
        this.chart?.destroy();
        this.chart = null;
        return;
      }
      const type = this.chartType();
      const granularity = this.granularity();
      const projectMap = this.projectStore.projectMap();
      this.viewMode(); // track view mode changes
      this.renderChart(canvas.nativeElement, entries, type, granularity, projectMap);
    });
  }

  setFromDate(value: string) {
    this.rangeFrom.set(value);
    this.quickRange.set(null);
    this.granularityOverride.set(null);
  }

  setToDate(value: string) {
    this.rangeTo.set(value);
    this.quickRange.set(null);
    this.granularityOverride.set(null);
  }

  setGranularity(value: Granularity) {
    this.granularityOverride.set(value);
  }

  setQuickRange(range: 'week' | 'month' | 'year') {
    const now = new Date();
    this.quickRange.set(range);
    this.granularityOverride.set(null);
    switch (range) {
      case 'week':
        this.rangeFrom.set(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        this.rangeTo.set(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'month':
        this.rangeFrom.set(format(startOfMonth(now), 'yyyy-MM-dd'));
        this.rangeTo.set(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'year':
        this.rangeFrom.set(format(startOfYear(now), 'yyyy-MM-dd'));
        this.rangeTo.set(format(endOfYear(now), 'yyyy-MM-dd'));
        break;
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private loadData(from: Date, to: Date) {
    this.loading.set(true);
    this.storage.getEntries(from, to).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private renderChart(
    canvas: HTMLCanvasElement,
    entries: TimeEntry[],
    type: ChartType,
    granularity: Granularity,
    projectMap: Map<string, Project>,
  ) {
    this.chart?.destroy();

    if (type === 'doughnut') {
      this.renderDoughnutChart(canvas, entries, projectMap);
    } else {
      this.renderTimeSeriesChart(canvas, entries, type, granularity, projectMap);
    }
  }

  private renderDoughnutChart(
    canvas: HTMLCanvasElement,
    entries: TimeEntry[],
    projectMap: Map<string, Project>,
  ) {
    const hoursByGroup = new Map<string, number>();
    for (const e of entries) {
      const key = this.getGroupKey(e, projectMap);
      hoursByGroup.set(
        key,
        (hoursByGroup.get(key) ?? 0) + (e.end.getTime() - e.start.getTime()) / 3600000,
      );
    }

    const sorted = [...hoursByGroup.entries()].sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([id]) => this.getGroupMeta(id, projectMap).name);
    const data = sorted.map(([, h]) => Math.round(h * 10) / 10);
    const colors = sorted.map(([id]) => this.getGroupMeta(id, projectMap).color);

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { padding: 16, usePointStyle: true, pointStyleWidth: 12, font: { size: 13 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}h`,
            },
          },
        },
      },
    });
  }

  private renderTimeSeriesChart(
    canvas: HTMLCanvasElement,
    entries: TimeEntry[],
    type: 'bar' | 'line',
    granularity: Granularity,
    projectMap: Map<string, Project>,
  ) {
    const from = new Date(this.rangeFrom());
    const to = endOfDay(new Date(this.rangeTo()));
    const interval = { start: from, end: to };

    const buckets = this.generateBuckets(interval, granularity);
    this.currentBuckets = buckets;
    const groupKeys = [...new Set(entries.map(e => this.getGroupKey(e, projectMap)))];

    const datasets = groupKeys.map(groupKey => {
      const meta = this.getGroupMeta(groupKey, projectMap);

      const data = buckets.map(bucket => {
        const bucketEntries = entries.filter(e =>
          this.getGroupKey(e, projectMap) === groupKey &&
          e.start >= bucket.start && e.start < bucket.end
        );
        return Math.round(
          bucketEntries.reduce((sum, e) => sum + (e.end.getTime() - e.start.getTime()) / 3600000, 0) * 10
        ) / 10;
      });

      return {
        label: meta.name,
        data,
        backgroundColor: type === 'bar' ? meta.color : meta.color + '20',
        borderColor: meta.color,
        borderWidth: type === 'line' ? 2 : 0,
        fill: type === 'line',
        tension: 0.3,
        pointRadius: type === 'line' ? 3 : 0,
        pointHoverRadius: type === 'line' ? 5 : 0,
      };
    });

    this.chart = new Chart(canvas, {
      type,
      data: { labels: buckets.map(b => b.label), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            stacked: type === 'bar',
            grid: { display: false },
            ticks: { font: { size: 11 } },
          },
          y: {
            stacked: type === 'bar',
            beginAtZero: true,
            title: { display: true, text: 'Stunden', font: { size: 12 } },
            ticks: { font: { size: 11 } },
          },
        },
        plugins: {
          legend: {
            labels: { usePointStyle: true, pointStyleWidth: 12, padding: 16, font: { size: 13 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}h`,
            },
          },
          zoom: {
            zoom: {
              drag: {
                enabled: true,
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderColor: 'rgba(79, 70, 229, 0.4)',
                borderWidth: 1,
              },
              mode: 'x',
              onZoomComplete: ({ chart }) => {
                const min = Math.round(chart.scales['x'].min);
                const max = Math.round(chart.scales['x'].max);
                const buckets = this.currentBuckets;
                if (buckets.length === 0) return;
                const fromBucket = buckets[Math.max(0, min)];
                const toBucket = buckets[Math.min(buckets.length - 1, max)];
                if (fromBucket && toBucket) {
                  this.rangeFrom.set(format(fromBucket.start, 'yyyy-MM-dd'));
                  this.rangeTo.set(format(toBucket.end, 'yyyy-MM-dd'));
                  this.quickRange.set(null);
                  this.granularityOverride.set(null);
                }
              },
            },
          },
        },
      },
    });
  }

  private getGroupKey(entry: TimeEntry, projectMap: Map<string, Project>): string {
    if (this.viewMode() === 'billable') {
      const project = entry.projectId ? projectMap.get(entry.projectId) : null;
      return project?.billable ? '__billable' : '__non-billable';
    }
    return entry.projectId ?? 'unassigned';
  }

  private getGroupMeta(key: string, projectMap: Map<string, Project>): { name: string; color: string } {
    if (key === '__billable') return { name: 'Abrechenbar', color: '#10b981' };
    if (key === '__non-billable') return { name: 'Nicht abrechenbar', color: '#94a3b8' };
    const project = projectMap.get(key);
    return {
      name: project ? getProjectDisplayName(project) : 'Ohne Projekt',
      color: project?.color ?? '#94a3b8',
    };
  }

  private generateBuckets(interval: { start: Date; end: Date }, granularity: Granularity) {
    switch (granularity) {
      case 'day':
        return eachDayOfInterval(interval).map(d => ({
          start: d,
          end: endOfDay(d),
          label: format(d, 'dd.MM.'),
        }));
      case 'week':
        return eachWeekOfInterval(interval, { weekStartsOn: 1 }).map(d => ({
          start: d,
          end: endOfDay(endOfWeek(d, { weekStartsOn: 1 })),
          label: `KW ${getISOWeek(d)}`,
        }));
      case 'month':
        return eachMonthOfInterval(interval).map(d => ({
          start: d,
          end: endOfDay(endOfMonth(d)),
          label: format(d, 'MM/yyyy'),
        }));
    }
  }
}
