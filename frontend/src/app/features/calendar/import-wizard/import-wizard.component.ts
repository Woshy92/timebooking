import { Component, inject, output, signal, computed, effect } from '@angular/core';
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

type WizardStep = 'loading' | 'assign' | 'gaps' | 'done';
type HistoryAction = { type: 'import'; eventId: string; entryId?: string } | { type: 'dismiss'; eventId: string } | { type: 'skip' };

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [title]="modalTitle()" maxWidth="560px" (closed)="closed.emit()">
      @switch (step()) {
        @case ('loading') {
          <div class="flex flex-col items-center gap-3 py-8">
            <svg class="w-6 h-6 text-indigo-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <div class="text-sm text-gray-500">Google Kalender wird synchronisiert...</div>
          </div>
        }
        @case ('assign') {
          @if (currentEvent(); as ev) {
            <div class="space-y-3">
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
              <div class="bg-gray-50 rounded-xl p-4 flex gap-4">
                <div class="flex-1 min-w-0 space-y-1.5">
                  <div class="font-semibold text-gray-900">{{ ev.title }}</div>
                  <div class="flex items-center gap-2 text-sm text-gray-500">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span>{{ formatDate(ev.start) }}, {{ formatTime(ev.start) }}–{{ formatTime(ev.end) }}</span>
                  </div>
                  @if (ev.description) {
                    <div class="text-xs text-gray-400 line-clamp-2">{{ ev.description }}</div>
                  }
                </div>
                @if (ev.attendees?.length) {
                  <div class="flex-shrink-0 space-y-1 max-w-[140px]">
                    <div class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Teilnehmer</div>
                    <div class="space-y-0.5">
                      @for (a of ev.attendees!.slice(0, 4); track a) {
                        <div class="text-xs text-gray-500 truncate">{{ a }}</div>
                      }
                      @if (ev.attendees!.length > 4) {
                        <div class="text-[10px] text-gray-400">+{{ ev.attendees!.length - 4 }} weitere</div>
                      }
                    </div>
                  </div>
                }
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

              <!-- Project filter + selection -->
              <div class="space-y-2">
                <input
                  type="text"
                  placeholder="Projekt suchen..."
                  [value]="projectFilter()"
                  (input)="projectFilter.set($any($event.target).value)"
                  class="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 outline-none placeholder:text-gray-400"
                />
                <div class="grid gap-1 max-h-48 overflow-y-auto">
                  @for (project of filteredProjects(); track project.id) {
                    <button
                      class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm hover:bg-indigo-50 hover:text-indigo-700"
                      (click)="importWithProject(project.id)"
                    >
                      <div class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
                      <span class="truncate">{{ getDisplayName(project) }}</span>
                    </button>
                  }
                  @if (filteredProjects().length === 0) {
                    <div class="text-xs text-gray-400 px-3 py-2">Kein Projekt gefunden</div>
                  }
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 pt-1">
                @if (currentIndex() > 0) {
                  <button
                    class="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                    (click)="goBack()"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                    Zurück
                  </button>
                }
                <div class="flex-1"></div>
                <button
                  class="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  (click)="importCurrentWithoutProject()"
                >
                  Ohne Projekt
                </button>
                <button
                  class="px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  (click)="dismissCurrent()"
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
  applyToSeries = signal(true);
  importedCount = signal(0);
  autoImportedCount = signal(0);
  gapsFilled = signal(false);
  projectFilter = signal('');

  private history: HistoryAction[] = [];

  readonly activeProjects = computed(() => this.projectStore.activeProjects());

  readonly filteredProjects = computed(() => {
    const q = this.projectFilter().toLowerCase().trim();
    if (!q) return this.activeProjects();
    return this.activeProjects().filter(p =>
      getProjectDisplayName(p).toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    );
  });

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
    const mappings = this.timeEntryStore.recurringMappingMap();
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
      case 'loading': return 'Google Kalender';
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

  private initialized = false;

  constructor() {
    afterInit(() => {
      // If no events loaded yet, trigger a sync first
      if (this.calendarStore.events().length === 0 && this.calendarStore.authenticated()) {
        this.step.set('loading');
        this.timeEntryStore.clearDismissedGoogleEventIds();
        this.calendarStore.fetchEvents(this.uiStore.weekStart(), this.uiStore.weekEnd());
      } else {
        this.startImport();
      }
    });

    // Watch for loading to finish, then start import
    effect(() => {
      const loading = this.calendarStore.loading();
      if (!loading && this.step() === 'loading' && !this.initialized) {
        this.startImport();
      }
    });
  }

  private startImport() {
    this.initialized = true;
    const mappings = this.timeEntryStore.recurringMappingMap();
    const autoEvents = this.visibleEvents().filter(ev =>
      ev.recurringEventId && mappings.has(ev.recurringEventId)
    );
    for (const ev of autoEvents) {
      this.calendarSyncService.importEvent(ev);
    }
    this.autoImportedCount.set(autoEvents.length);
    this.importedCount.set(autoEvents.length);

    if (this.manualEvents().length === 0) {
      this.step.set(this.importedCount() > 0 ? 'gaps' : 'done');
    } else {
      this.step.set('assign');
    }
  }

  importWithProject(projectId: string) {
    const ev = this.currentEvent();
    if (!ev) return;

    if (ev.recurringEventId && this.applyToSeries() && projectId) {
      this.timeEntryStore.setRecurringProjectMapping(ev.recurringEventId, projectId, ev.title);
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

    this.history.push({ type: 'import', eventId: ev.id });
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

    this.history.push({ type: 'import', eventId: ev.id });
    this.importedCount.update(c => c + 1);
    this.advance();
  }

  dismissCurrent() {
    const ev = this.currentEvent();
    if (!ev) return;
    this.timeEntryStore.dismissGoogleEvent(ev.id);
    this.history.push({ type: 'dismiss', eventId: ev.id });
    this.advance();
  }

  goBack() {
    if (this.currentIndex() === 0) return;
    const lastAction = this.history.pop();
    if (!lastAction) return;

    // Undo last action
    if (lastAction.type === 'import') {
      // Find the entry by googleEventId and remove it
      const entry = this.timeEntryStore.entries().find(e => e.googleEventId === lastAction.eventId);
      if (entry) {
        this.timeEntryStore.removeEntry(entry.id);
        this.importedCount.update(c => c - 1);
      }
    } else if (lastAction.type === 'dismiss') {
      this.timeEntryStore.undismissGoogleEvent(lastAction.eventId);
    }

    this.currentIndex.update(i => i - 1);
    this.projectFilter.set('');
    this.applyToSeries.set(true);
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
      this.projectFilter.set('');
      this.applyToSeries.set(true);
    }
  }
}

function afterInit(fn: () => void) {
  queueMicrotask(fn);
}
