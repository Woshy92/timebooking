import { Component, inject, computed, signal } from '@angular/core';
import { TimeEntryStore } from '../../state/time-entry.store';
import { ProjectStore } from '../../state/project.store';
import { getProjectDisplayName } from '../../domain/models/project.model';
import { RecurringProjectMapping } from '../../domain/models/recurring-mapping.model';

interface RuleDisplay {
  mapping: RecurringProjectMapping;
  projectName: string;
  projectColor: string;
  projectMissing: boolean;
}

@Component({
  selector: 'app-rules',
  standalone: true,
  template: `
    <div class="p-6 max-w-3xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Automatische Zuordnung</h1>
        <p class="text-sm text-gray-500 mt-1">
          Regeln für die automatische Projektzuordnung bei wiederkehrenden Google-Kalender-Terminen
        </p>
      </div>

      @if (rules().length === 0) {
        <div class="text-center py-16 text-gray-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <p class="font-medium">Keine Regeln vorhanden</p>
          <p class="text-sm mt-1">
            Regeln werden erstellt, wenn du beim Import eines wiederkehrenden
            Google-Kalender-Termins „Für alle Termine dieser Serie merken" aktivierst.
          </p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (rule of rules(); track rule.mapping.recurringEventId) {
            <div class="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm group">
              <div class="flex items-center gap-4 min-w-0">
                <!-- Arrow icon -->
                <div class="flex items-center gap-3 min-w-0">
                  <div class="min-w-0">
                    <div class="font-medium text-gray-900 truncate">
                      {{ rule.mapping.eventTitle || 'Unbekannter Termin' }}
                    </div>
                    <div class="text-xs text-gray-400 mt-0.5">Wiederkehrender Termin</div>
                  </div>
                </div>

                <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>

                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-3 h-3 rounded-full flex-shrink-0"
                       [style.background-color]="rule.projectColor"></div>
                  <span class="text-sm font-medium truncate"
                        [class.text-gray-900]="!rule.projectMissing"
                        [class.text-red-500]="rule.projectMissing">
                    {{ rule.projectName }}
                  </span>
                </div>
              </div>

              <button
                (click)="confirmDelete(rule)"
                class="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Regel löschen"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          }
        </div>

        <div class="mt-6 flex items-center justify-between">
          <p class="text-xs text-gray-400">{{ rules().length }} {{ rules().length === 1 ? 'Regel' : 'Regeln' }}</p>
          @if (rules().length > 1) {
            <button
              (click)="confirmDeleteAll()"
              class="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
            >
              Alle Regeln löschen
            </button>
          }
        </div>
      }

      @if (deleteConfirm(); as dc) {
        <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" (click)="deleteConfirm.set(null)">
          <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4" (click)="$event.stopPropagation()">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ dc.title }}</h3>
            <p class="text-sm text-gray-600 mb-5">{{ dc.message }}</p>
            <div class="flex justify-end gap-2">
              <button
                (click)="deleteConfirm.set(null)"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                (click)="dc.action(); deleteConfirm.set(null)"
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class RulesComponent {
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);

  readonly deleteConfirm = signal<{ title: string; message: string; action: () => void } | null>(null);

  readonly rules = computed<RuleDisplay[]>(() => {
    const mappings = this.timeEntryStore.recurringProjectMappings();
    const projectMap = this.projectStore.projectMap();

    return mappings.map(m => {
      const project = projectMap.get(m.projectId);
      return {
        mapping: m,
        projectName: project ? getProjectDisplayName(project) : 'Gelöschtes Projekt',
        projectColor: project?.color ?? '#D1D5DB',
        projectMissing: !project || project.archived,
      };
    }).sort((a, b) => a.mapping.eventTitle.localeCompare(b.mapping.eventTitle));
  });

  confirmDelete(rule: RuleDisplay) {
    this.deleteConfirm.set({
      title: 'Regel löschen',
      message: `Die automatische Zuordnung von „${rule.mapping.eventTitle || 'Unbekannter Termin'}" zu „${rule.projectName}" wird entfernt. Bereits importierte Termine sind nicht betroffen.`,
      action: () => this.timeEntryStore.deleteRecurringProjectMapping(rule.mapping.recurringEventId),
    });
  }

  confirmDeleteAll() {
    const count = this.rules().length;
    this.deleteConfirm.set({
      title: 'Alle Regeln löschen',
      message: `Alle ${count} Regeln für die automatische Zuordnung werden gelöscht. Bereits importierte Termine sind nicht betroffen.`,
      action: () => {
        for (const rule of this.timeEntryStore.recurringProjectMappings()) {
          this.timeEntryStore.deleteRecurringProjectMapping(rule.recurringEventId);
        }
      },
    });
  }
}
