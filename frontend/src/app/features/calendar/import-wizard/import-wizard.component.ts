import { Component, inject, output, signal, computed } from '@angular/core';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { CalendarSyncService } from '../../../application/calendar-sync.service';
import { CalendarEvent } from '../../../domain/models/calendar-event.model';
import { getProjectDisplayName } from '../../../domain/models/project.model';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { formatTime } from '../../../shared/utils/time-helpers';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type WizardStep = 'assign' | 'gaps' | 'done';

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [title]="modalTitle()" maxWidth="520px" (closed)="closed.emit()">
      @switch (step()) {
        @case ('assign') {
          @if (currentEvent(); as ev) {
            <div class="space-y-4">
              <!-- Progress -->
              <div class="flex items-center justify-between text-xs text-gray-400">
                <span>Termin {{ currentIndex() + 1 }} von {{ manualEvents().length }}</span>
                @if (autoImportedCount() > 0) {
                  <span>{{ autoImportedCount() }} automatisch importiert</span>
                }
              </div>
              <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full transition-all duration-300"
                     [style.width.%]="((currentIndex()) / manualEvents().length) * 100"></div>
              </div>

              <!-- Event details -->
              <div class="bg-gray-50 rounded-xl p-4 space-y-2">
                <div class="font-semibold text-gray-900">{{ ev.title }}</div>
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <span>{{ formatDate(ev.start) }}</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>{{ formatTime(ev.start) }} – {{ formatTime(ev.end) }}</span>
                </div>
                @if (ev.description) {
                  <div class="text-xs text-gray-400 line-clamp-2">{{ ev.description }}</div>
                }
              </div>

              <!-- Project selection -->
              <div class="space-y-2">
                <div class="text-sm font-medium text-gray-700">Projekt zuweisen</div>
                <div class="grid gap-1.5 max-h-48 overflow-y-auto">
                  @for (project of activeProjects(); track project.id) {
                    <button
                      class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm"
                      [class]="selectedProjectId() === project.id
                        ? 'bg-indigo-50 ring-1 ring-indigo-300 text-indigo-700'
                        : 'hover:bg-gray-50 text-gray-700'"
                      (click)="selectedProjectId.set(project.id)"
                    >
                      <div class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
                      <span class="truncate">{{ getDisplayName(project) }}</span>
                    </button>
                  }
                </div>
              </div>

              <!-- Recurring mapping checkbox -->
              @if (ev.recurringEventId) {
                <label class="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" [checked]="applyToSeries()"
                         (change)="applyToSeries.set(!applyToSeries())"
                         class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  Für alle Termine dieser Serie merken
                </label>
              }

              <!-- Actions -->
              <div class="flex items-center gap-2 pt-2">
                <button
                  class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                         bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  [disabled]="!selectedProjectId()"
                  (click)="importCurrent()"
                >
                  Importieren
                </button>
                <button
                  class="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  (click)="importCurrentWithoutProject()"
                >
                  Ohne Projekt
                </button>
                <button
                  class="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  (click)="dismissCurrent()"
                  title="Termin ausblenden"
                >
                  Löschen
                </button>
              </div>
            </div>
          }
        }

        @case ('gaps') {
          <div class="space-y-4">
            <div class="text-sm text-gray-600">
              {{ importedCount() }} Termine wurden importiert.
            </div>
            <div class="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
              <svg class="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div class="text-sm text-amber-800">
                Sollen die Lücken zwischen den Terminen automatisch geschlossen werden?
                Dabei werden Start- und Endzeiten auf Viertelstunden gerundet und kleine Lücken geschlossen.
              </div>
            </div>
            <div class="flex items-center gap-2 pt-2">
              <button
                class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                       bg-indigo-600 text-white hover:bg-indigo-700"
                (click)="fillGaps()"
              >
                Lücken füllen
              </button>
              <button
                class="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                (click)="step.set('done')"
              >
                Nein, danke
              </button>
            </div>
          </div>
        }

        @case ('done') {
          <div class="space-y-4 text-center py-4">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div class="text-sm text-gray-600">
              {{ importedCount() }} Termine importiert{{ gapsFilled() ? ', Lücken geschlossen' : '' }}.
            </div>
            <button
              class="px-6 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              (click)="closed.emit()"
            >
              Fertig
            </button>
          </div>
        }
      }
    </app-modal>
  `,
})
export class ImportWizardComponent {
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);
  private readonly uiStore = inject(UiStore);
  private readonly calendarSyncService = inject(CalendarSyncService);

  closed = output<void>();

  step = signal<WizardStep>('assign');
  currentIndex = signal(0);
  selectedProjectId = signal<string | null>(null);
  applyToSeries = signal(false);
  importedCount = signal(0);
  autoImportedCount = signal(0);
  gapsFilled = signal(false);

  readonly activeProjects = computed(() => this.projectStore.activeProjects());

  /** All visible Google events (not yet imported, not dismissed) */
  private readonly visibleEvents = computed(() => {
    const allEvents = this.calendarStore.events();
    const bookedIds = new Set(
      this.timeEntryStore.entries().filter(e => e.googleEventId).map(e => e.googleEventId)
    );
    const dismissedIds = new Set(this.timeEntryStore.dismissedGoogleEventIds());
    return allEvents.filter(e => !bookedIds.has(e.id) && !dismissedIds.has(e.id));
  });

  /** Events that need manual project assignment */
  readonly manualEvents = computed(() => {
    const mappings = this.timeEntryStore.recurringProjectMappings();
    return this.visibleEvents().filter(ev =>
      !ev.recurringEventId || !mappings.has(ev.recurringEventId)
    );
  });

  readonly currentEvent = computed(() => {
    const idx = this.currentIndex();
    const events = this.manualEvents();
    return idx < events.length ? events[idx] : null;
  });

  readonly modalTitle = computed(() => {
    switch (this.step()) {
      case 'assign': return 'Google Termine importieren';
      case 'gaps': return 'Lücken füllen?';
      case 'done': return 'Import abgeschlossen';
    }
  });

  getDisplayName = getProjectDisplayName;
  formatTime = formatTime;

  formatDate(date: Date): string {
    return format(date, 'EEEE, d. MMMM', { locale: de });
  }

  constructor() {
    // Auto-import recurring events with known mappings
    afterInit(() => {
      const mappings = this.timeEntryStore.recurringProjectMappings();
      const autoEvents = this.visibleEvents().filter(ev =>
        ev.recurringEventId && mappings.has(ev.recurringEventId)
      );
      for (const ev of autoEvents) {
        this.calendarSyncService.importEvent(ev);
      }
      this.autoImportedCount.set(autoEvents.length);
      this.importedCount.set(autoEvents.length);

      // Pre-select default project
      const defaultPid = this.uiStore.defaultProjectId();
      if (defaultPid) {
        this.selectedProjectId.set(defaultPid);
      }

      // If no manual events, skip directly to gaps step
      if (this.manualEvents().length === 0) {
        this.step.set(this.importedCount() > 0 ? 'gaps' : 'done');
      }
    });
  }

  importCurrent() {
    const ev = this.currentEvent();
    if (!ev) return;

    const projectId = this.selectedProjectId() ?? undefined;

    // If recurring and "apply to series" checked, save the mapping
    if (ev.recurringEventId && this.applyToSeries() && projectId) {
      this.timeEntryStore.setRecurringProjectMapping(ev.recurringEventId, projectId);
    }

    this.timeEntryStore.addEntry({
      title: ev.title,
      start: ev.start,
      end: ev.end,
      projectId,
      source: 'google',
      googleEventId: ev.id,
      recurringEventId: ev.recurringEventId,
      description: ev.description || undefined,
      attendees: ev.attendees?.length ? ev.attendees : undefined,
    });

    this.importedCount.update(c => c + 1);
    this.advance();
  }

  importCurrentWithoutProject() {
    const ev = this.currentEvent();
    if (!ev) return;

    this.timeEntryStore.addEntry({
      title: ev.title,
      start: ev.start,
      end: ev.end,
      projectId: undefined,
      source: 'google',
      googleEventId: ev.id,
      recurringEventId: ev.recurringEventId,
      description: ev.description || undefined,
      attendees: ev.attendees?.length ? ev.attendees : undefined,
    });
    this.importedCount.update(c => c + 1);
    this.advance();
  }

  dismissCurrent() {
    const ev = this.currentEvent();
    if (!ev) return;
    this.timeEntryStore.dismissGoogleEvent(ev.id);
    this.advance();
  }

  skipCurrent() {
    this.advance();
  }

  fillGaps() {
    this.timeEntryStore.fillGaps();
    this.gapsFilled.set(true);
    this.step.set('done');
  }

  private advance() {
    const nextIndex = this.currentIndex() + 1;
    if (nextIndex >= this.manualEvents().length) {
      this.step.set(this.importedCount() > 0 ? 'gaps' : 'done');
    } else {
      this.currentIndex.set(nextIndex);
      this.applyToSeries.set(false);
    }
  }
}

function afterInit(fn: () => void) {
  queueMicrotask(fn);
}
