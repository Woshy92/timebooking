import { Component, inject, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiStore } from '../../../state/ui.store';
import { ExportService } from '../../../application/export.service';
import { format } from 'date-fns';

@Component({
  selector: 'app-export-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (ui.isExportPanelOpen()) {
      <div class="fixed inset-0 z-40" (click)="ui.toggleExportPanel()"></div>
      <div class="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 border-l border-gray-100
                  animate-slide-in flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Export</h2>
          <button (click)="ui.toggleExportPanel()"
                  class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-5 flex-1">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Von</label>
            <input type="date" [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event)"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Bis</label>
            <input type="date" [ngModel]="toDate()" (ngModelChange)="toDate.set($event)"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900" />
          </div>

          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div class="relative">
              <input type="checkbox" [(ngModel)]="includeSummary" class="sr-only peer" />
              <div class="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-indigo-600 transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
            </div>
            <span class="text-sm text-gray-700">Projektübersicht (Projekt × Tag)</span>
          </label>

          <div class="pt-2 space-y-3">
            <button
              (click)="onExport('csv')"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200
                     hover:bg-gray-50 hover:border-gray-300 transition-all text-left"
            >
              <div class="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-900">CSV Export</div>
                <div class="text-xs text-gray-500">Für Excel / Google Sheets</div>
              </div>
            </button>

            <button
              (click)="onExport('pdf')"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200
                     hover:bg-gray-50 hover:border-gray-300 transition-all text-left"
            >
              <div class="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-900">PDF Export</div>
                <div class="text-xs text-gray-500">Formatierter Bericht</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .animate-slide-in { animation: slide-in 0.2s ease-out; }
  `],
})
export class ExportPanelComponent {
  protected readonly ui = inject(UiStore);
  private readonly exportService = inject(ExportService);

  fromDate = signal(format(this.ui.weekStart(), 'yyyy-MM-dd'));
  toDate = signal(format(this.ui.weekEnd(), 'yyyy-MM-dd'));
  includeSummary = true;

  constructor() {
    effect(() => {
      if (this.ui.isExportPanelOpen()) {
        this.fromDate.set(format(this.ui.weekStart(), 'yyyy-MM-dd'));
        this.toDate.set(format(this.ui.weekEnd(), 'yyyy-MM-dd'));
      }
    });
  }

  onExport(fmt: 'pdf' | 'csv') {
    this.exportService.export(fmt, {
      from: new Date(this.fromDate()),
      to: new Date(this.toDate() + 'T23:59:59'),
    }, this.includeSummary);
  }
}
