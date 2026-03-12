import { Component, inject, computed, ElementRef, viewChild, afterNextRender, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { UndoStore } from '../../../state/undo.store';
import { VacationStore } from '../../../state/vacation.store';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { TimeEntry } from '../../../domain/models/time-entry.model';
import { getProjectDisplayName } from '../../../domain/models/project.model';
import { SNAP_MINUTES } from '../../../shared/models/calendar-view.models';
import { ProjectPillsBarComponent } from '../../../shared/components/project-pills-bar/project-pills-bar.component';
import { ClearConfirmPopoverComponent } from '../../../shared/components/clear-confirm-popover/clear-confirm-popover.component';
import { ProjectPopoverComponent } from '../../../shared/components/project-popover/project-popover.component';
import { RecurringConfirmComponent } from '../../../shared/components/recurring-confirm/recurring-confirm.component';
import { computeOverlapLayout, getEntryLeft as calcEntryLeft, getEntryWidth as calcEntryWidth } from '../../../shared/utils/overlap-layout';
import { snapToHalfHour, snapToGrid, formatTime } from '../../../shared/utils/time-helpers';
import { startAutoScroll } from '../../../shared/utils/auto-scroll';
import { findGapSuggestions, GapSuggestion } from '../../../shared/utils/gap-filler';
import { CalendarInteractionService } from '../../../shared/services/calendar-interaction.service';

const HOUR_HEIGHT = 72;
const MIN_BLOCK_HEIGHT = 34;

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [DurationPipe, FormsModule, ProjectPillsBarComponent, ClearConfirmPopoverComponent, ProjectPopoverComponent, RecurringConfirmComponent],
  template: `
    <div class="flex flex-col h-full bg-white">
      <!-- Day header -->
      <div class="flex items-center gap-4 px-6 py-3 border-b border-gray-200/80 bg-white sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <button (click)="ui.navigateDay('prev')" class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <div class="text-base font-semibold text-gray-900">{{ dayLabel() }}</div>
          <div class="text-xs tabular-nums" [class.text-gray-400]="!isVacation()" [class.text-amber-500]="isVacation()">
            @if (isVacation()) { Urlaub } @else { {{ totalLabel() }} }
          </div>
        </div>
        <button
          class="px-2 py-1 rounded-md text-xs font-medium transition-colors"
          [class.bg-amber-100]="isVacation()"
          [class.text-amber-700]="isVacation()"
          [class.hover:bg-amber-200]="isVacation()"
          [class.bg-gray-100]="!isVacation()"
          [class.text-gray-500]="!isVacation()"
          [class.hover:bg-gray-200]="!isVacation()"
          (click)="toggleVacation()">
          {{ isVacation() ? 'Urlaub entfernen' : 'Urlaub' }}
        </button>
        <button (click)="ui.navigateDay('next')" class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        <app-project-pills-bar class="ml-auto flex-1 min-w-0 max-w-md" />
        <app-clear-confirm-popover
          [entryCount]="dayEntryCount()"
          [googleEventCount]="googleEvents().length"
          label="dieses Tages"
          title="Tag leeren"
          (confirm)="clearView()"
        />
      </div>

      <!-- Time grid -->
      <div class="flex flex-1 overflow-y-auto" #scrollContainer>
        <div class="w-[60px] flex-shrink-0 border-r border-gray-100 bg-gray-50/30">
          @for (hour of hours(); track hour) {
            <div class="relative" [style.height.px]="hourHeight">
              <span class="absolute -top-[9px] right-3 text-[10px] font-medium text-gray-400 tabular-nums select-none">
                {{ hour < 10 ? '0' + hour : hour }}:00
              </span>
            </div>
          }
        </div>

        <div class="flex-1 relative select-none"
             [class.bg-gray-200/70]="isVacation()"
             (mousedown)="onGridMouseDown($event)">
          @for (hour of hours(); track hour) {
            <div class="border-b border-gray-100/50" [style.height.px]="hourHeight">
              <div class="border-b border-dashed border-gray-100/30 h-1/2"></div>
            </div>
          }

          <!-- Vacation overlay -->
          @if (isVacation()) {
            <div class="absolute inset-0 bg-gray-300/30 z-[2] pointer-events-none flex items-center justify-center">
              <span class="text-gray-400/70 text-2xl font-bold -rotate-12 select-none">Urlaub</span>
            </div>
          }

          <!-- Now indicator -->
          @if (isActiveToday()) {
            <div class="absolute left-0 right-0 z-10 pointer-events-none" [style.top.px]="nowPosition()">
              <div class="flex items-center">
                <div class="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shadow-sm"></div>
                <div class="flex-1 h-[2px] bg-red-500/70"></div>
              </div>
            </div>
          }

          <!-- Gap suggestions -->
          @if (ui.highlightGaps()) {
            @for (gap of gapSuggestions(); track gap.id) {
              <div
                class="absolute left-3 right-3 rounded-lg px-3 py-2 cursor-pointer z-[3]
                       bg-amber-50/80 border border-dashed border-amber-300 hover:border-amber-500
                       hover:shadow-md transition-all group"
                [style.top.px]="getTopPosition(gap.start)"
                [style.height.px]="getBlockHeight(gap.start, gap.end)"
                [style.min-height.px]="34"
                (mousedown)="$event.stopPropagation()"
                (click)="onGapClick(gap)"
              >
                <div class="flex items-start gap-2 h-full overflow-hidden">
                  <svg class="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600 mt-[1px] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-amber-600 group-hover:text-amber-700 transition-colors">{{ interaction.getGapMinutes(gap) }} Min verfügbar</div>
                    <div class="text-amber-400 text-xs tabular-nums">{{ formatTime(gap.start) }}–{{ formatTime(gap.end) }}</div>
                  </div>
                  <button
                    class="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded text-[11px] font-medium
                           bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700 transition-all flex-shrink-0"
                    title="Als Pause markieren"
                    (click)="interaction.onGapPause($event, gap)"
                  >
                    Pause
                  </button>
                </div>
              </div>
            }
          }

          @for (event of googleEvents(); track event.id) {
            <div
              class="absolute rounded-lg px-3 py-2 cursor-pointer z-[5]
                     bg-white border border-dashed border-gray-300 hover:border-indigo-400
                     hover:shadow-md transition-all group"
              [style.top.px]="getTopPosition(event.start)"
              [style.height.px]="getBlockHeight(event.start, event.end)"
              [style.min-height.px]="34"
              [style.left]="getEntryLeft(event.id)"
              [style.width]="getEntryWidth(event.id)"
              (mousedown)="$event.stopPropagation()"
              (click)="interaction.onGoogleEventClick($event, event)"
            >
              <div class="flex items-start gap-2">
                <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 mt-[1px] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <div class="min-w-0 flex-1">
                  <div class="font-medium text-gray-500 group-hover:text-indigo-600 transition-colors">{{ event.title }}</div>
                  <div class="text-gray-400 text-xs tabular-nums">{{ formatTime(event.start) }}–{{ formatTime(event.end) }} · Importieren</div>
                </div>
                <button
                  class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all flex-shrink-0"
                  title="Ausblenden"
                  (click)="interaction.dismissGoogleEvent($event, event.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          }

          @for (entry of entries(); track entry.id) {
            @if (entry.pause) {
              <!-- Pause block -->
              <div
                class="absolute rounded-lg cursor-pointer z-[5] border border-dashed border-gray-300
                       hover:border-gray-400 transition-all group"
                style="background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(156,163,175,0.08) 5px, rgba(156,163,175,0.08) 10px)"
                [style.top.px]="getTopPosition(interaction.getEffectiveStart(entry))"
                [style.height.px]="getBlockHeight(interaction.getEffectiveStart(entry), interaction.getEffectiveEnd(entry))"
                [style.min-height.px]="34"
                [style.left]="getEntryLeft(entry.id)"
                [style.width]="getEntryWidth(entry.id)"
                [class.ring-2]="interaction.selectedEntryIds().has(entry.id)"
                [class.ring-gray-400]="interaction.selectedEntryIds().has(entry.id)"
                [class.opacity-60]="interaction.dragOverride()?.entryId === entry.id"
                [class.!z-50]="interaction.dragOverride()?.entryId === entry.id"
                (mousedown)="onEntryMouseDown($event, entry)"
                (click)="interaction.onEntryClick($event, entry)"
                (dblclick)="interaction.onEntryDblClick($event, entry)"
              >
                <div class="px-3 py-2 h-full flex flex-col overflow-hidden">
                  <div class="flex items-center gap-1.5 text-gray-400">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
                    </svg>
                    <div class="text-sm font-medium truncate">Pause</div>
                  </div>
                  <div class="text-xs tabular-nums mt-0.5 text-gray-400" style="opacity: 0.6">
                    {{ formatTime(interaction.getEffectiveStart(entry)) }}–{{ formatTime(interaction.getEffectiveEnd(entry)) }} · {{ getDurationMinutes(entry) | duration }}
                  </div>
                </div>
                <!-- Top resize handle -->
                <div
                  class="absolute top-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  (mousedown)="onResizeTopStart($event, entry)"
                >
                  <div class="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-gray-400" style="opacity: 0.4"></div>
                </div>
                <!-- Bottom resize handle -->
                <div
                  class="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  (mousedown)="onResizeStart($event, entry)"
                >
                  <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-gray-400" style="opacity: 0.4"></div>
                </div>
              </div>
            } @else {
              <!-- Regular entry block -->
              <div
                class="absolute rounded-lg cursor-pointer z-[6]
                       shadow-sm hover:shadow-lg transition-all group"
                [style.top.px]="getTopPosition(interaction.getEffectiveStart(entry))"
                [style.height.px]="getBlockHeight(interaction.getEffectiveStart(entry), interaction.getEffectiveEnd(entry))"
                [style.min-height.px]="34"
                [style.left]="getEntryLeft(entry.id)"
                [style.width]="getEntryWidth(entry.id)"
                [style.background-color]="interaction.getEntryColor(entry) + '15'"
                [style.border-left]="'4px solid ' + interaction.getEntryColor(entry)"
                [class.ring-2]="interaction.selectedEntryIds().has(entry.id)"
                [class.ring-indigo-400]="interaction.selectedEntryIds().has(entry.id)"
                [class.opacity-60]="interaction.dragOverride()?.entryId === entry.id"
                [class.shadow-xl]="interaction.dragOverride()?.entryId === entry.id"
                [class.!z-50]="interaction.dragOverride()?.entryId === entry.id"
                (mousedown)="onEntryMouseDown($event, entry)"
                (click)="interaction.onEntryClick($event, entry)"
                (dblclick)="interaction.onEntryDblClick($event, entry)"
              >
                <div class="px-3 py-2 h-full flex flex-col overflow-hidden">
                  <div class="flex items-center gap-1.5">
                    <div class="text-sm font-semibold truncate" [style.color]="interaction.getEntryColor(entry)">{{ entry.title || 'Ohne Beschreibung' }}</div>
                    @if (entry.source === 'google') {
                      <svg class="w-3 h-3 flex-shrink-0 opacity-50" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    }
                  </div>
                  <div class="text-xs tabular-nums mt-0.5" [style.color]="interaction.getEntryColor(entry)" style="opacity: 0.6">
                    {{ formatTime(interaction.getEffectiveStart(entry)) }}–{{ formatTime(interaction.getEffectiveEnd(entry)) }} · {{ getDurationMinutes(entry) | duration }}
                  </div>
                  @if (interaction.getProject(entry); as p) {
                    <div class="text-[10px] font-bold mt-auto truncate uppercase tracking-wider" [style.color]="interaction.getEntryColor(entry)" style="opacity: 0.5">{{ getDisplayName(p) }}</div>
                  }
                </div>
                <!-- Top resize handle -->
                <div
                  class="absolute top-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  (mousedown)="onResizeTopStart($event, entry)"
                >
                  <div class="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="interaction.getEntryColor(entry)" style="opacity: 0.4"></div>
                </div>
                <!-- Bottom resize handle -->
                <div
                  class="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  (mousedown)="onResizeStart($event, entry)"
                >
                  <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="interaction.getEntryColor(entry)" style="opacity: 0.4"></div>
                </div>
              </div>
            }
          }

          <!-- Draft block -->
          @if (interaction.draft()) {
            <div
              class="absolute left-3 right-3 rounded-lg z-30 border-2 border-dashed"
              [style.top.px]="interaction.getDraftTop(viewStart(), hourHeight)"
              [style.height.px]="interaction.getDraftHeight(hourHeight, 34)"
              [style.min-height.px]="34"
              [style.border-color]="draftColor()"
              [style.background-color]="draftColor() + '0A'"
            >
              <div class="px-3 py-2 h-full flex flex-col">
                <input
                  #draftInput
                  class="bg-transparent text-sm font-semibold placeholder:opacity-40 outline-none w-full"
                  [style.color]="draftColor()"
                  placeholder="Beschreibung eingeben..."
                  [ngModel]="interaction.draft()!.title"
                  (ngModelChange)="interaction.updateDraftTitle($event)"
                  (keydown.enter)="interaction.saveDraft(hourHeight)"
                  (keydown.escape)="interaction.cancelDraft()"
                />
                <div class="text-xs tabular-nums mt-auto" [style.color]="draftColor()" style="opacity: 0.5">{{ interaction.formatDraftTime() }}</div>
              </div>
              <div class="absolute top-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="interaction.onDraftResizeTopStart($event, hourHeight, viewStart())">
                <div class="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
              </div>
              <div class="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="interaction.onDraftResizeStart($event, hourHeight)">
                <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Project popover -->
    @if (interaction.popover(); as pop) {
      <app-project-popover
        [x]="pop.x"
        [y]="pop.y"
        [selectedCount]="interaction.selectedEntryIds().size"
        [commonProjectId]="commonProjectId()"
        [entryTimeLabel]="entryTimeLabel()"
        (assign)="interaction.assignProject($event)"
        (openDetails)="interaction.openEntryDetails()"
        (delete)="interaction.deleteEntries()"
        (close)="interaction.closePopover()"
      />
    }

    <app-recurring-confirm
      [state]="interaction.recurringConfirm()"
      (confirm)="interaction.confirmRecurringProject()"
      (dismiss)="interaction.dismissRecurringConfirm()"
    />

  `,
  styles: [`:host { display: flex; flex-direction: column; height: 100%; }`],
})
export class DayViewComponent {
  protected readonly ui = inject(UiStore);
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);
  private readonly undoStore = inject(UndoStore);
  protected readonly vacationStore = inject(VacationStore);
  protected readonly interaction = inject(CalendarInteractionService);

  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  readonly draftInput = viewChild<ElementRef>('draftInput');

  readonly viewStart = computed(() => this.ui.viewStartHour());
  private readonly viewEnd = computed(() => this.ui.viewEndHour());
  readonly hourHeight = HOUR_HEIGHT;
  readonly hours = computed(() =>
    Array.from({ length: this.viewEnd() - this.viewStart() }, (_, i) => this.viewStart() + i)
  );

  readonly dayEntryCount = computed(() => this.entries().length);

  readonly defaultProject = computed(() => {
    const id = this.ui.defaultProjectId();
    if (id) return this.projectStore.projectMap().get(id) ?? null;
    return this.projectStore.activeProjects()[0] ?? null;
  });

  readonly draftColor = computed(() => this.defaultProject()?.color ?? '#6366F1');

  readonly entryLayout = computed(() => {
    const result = new Map<string, { col: number; total: number }>();
    computeOverlapLayout([...this.entries(), ...this.googleEvents()], result);
    return result;
  });

  readonly entryTimeLabel = computed(() => {
    const ids = this.interaction.selectedEntryIds();
    if (ids.size !== 1) return '';
    const entry = this.entries().find(e => ids.has(e.id));
    if (!entry) return '';
    return `${formatTime(entry.start)}–${formatTime(entry.end)}`;
  });

  constructor() {
    afterNextRender(() => {
      const container = this.scrollContainer()?.nativeElement;
      const scrollTo = (8 - this.viewStart()) * HOUR_HEIGHT;
      if (container && scrollTo > 0) container.scrollTop = scrollTo;
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.interaction.popover()) this.interaction.closePopover();
    else if (this.interaction.draft()) this.interaction.cancelDraft();
  }

  readonly isActiveToday = computed(() => isSameDay(this.ui.activeDate(), new Date()));
  readonly isVacation = computed(() => this.vacationStore.isVacation(this.ui.activeDate()));
  readonly nowPosition = computed(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60 - this.viewStart()) * HOUR_HEIGHT;
  });

  readonly entries = computed(() =>
    this.timeEntryStore.entries().filter(e => isSameDay(new Date(e.start), this.ui.activeDate()))
  );
  readonly gapSuggestions = computed(() =>
    this.isVacation() ? [] : findGapSuggestions(this.entries())
  );
  readonly googleEvents = computed(() => {
    const bookedIds = new Set(this.timeEntryStore.entries().filter(e => e.googleEventId).map(e => e.googleEventId));
    const dismissedIds = new Set(this.timeEntryStore.dismissedGoogleEventIds());
    return this.calendarStore.events()
      .filter(e => isSameDay(new Date(e.start), this.ui.activeDate()))
      .filter(e => !bookedIds.has(e.id))
      .filter(e => !dismissedIds.has(e.id));
  });
  readonly dayLabel = computed(() => format(this.ui.activeDate(), 'EEEE, dd. MMMM yyyy', { locale: de }));
  readonly totalLabel = computed(() => {
    const h = this.entries().filter(e => !e.pause).reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0);
    return `${h.toFixed(1)}h gebucht`;
  });

  readonly commonProjectId = computed((): string | undefined | null => {
    const ids = this.interaction.selectedEntryIds();
    if (ids.size === 0) return null;
    const entries = this.timeEntryStore.entries().filter(e => ids.has(e.id));
    if (entries.length === 0) return null;
    const first = entries[0].projectId;
    return entries.every(e => e.projectId === first) ? first : null;
  });

  private getYInGrid(event: MouseEvent): number {
    const scrollEl = this.scrollContainer()?.nativeElement;
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const scrollRect = scrollEl ? scrollEl.getBoundingClientRect() : { top: 0 };
    return event.clientY - scrollRect.top + scrollTop;
  }

  // ─── View-specific: grid mouse down ─────────────────
  onGridMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('input')) return;

    if (this.interaction.draft()?.title?.trim()) { this.interaction.saveDraft(HOUR_HEIGHT); }

    const y = this.getYInGrid(event);
    const hour = snapToHalfHour(this.viewStart() + y / HOUR_HEIGHT);

    this.interaction.draft.set({ date: this.ui.activeDate(), startHour: hour, endHour: hour + 0.5, title: '' });
    setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);

    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    const stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;

    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const curY = this.getYInGrid(e);
      const curHour = snapToGrid(this.viewStart() + curY / HOUR_HEIGHT, SNAP_MINUTES);
      const d = this.interaction.draft()!;
      this.interaction.draft.set({ ...d, endHour: Math.min(Math.max(curHour, d.startHour + 0.25), this.viewEnd()) });
    };
    const onUp = () => {
      stopScroll?.();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ─── View-specific: entry drag (single-day) ─────────
  onEntryMouseDown(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation();
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.cursor-ns-resize')) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const THRESHOLD = 5;
    let dragStarted = false;

    const entryStart = new Date(entry.start);
    const entryEnd = new Date(entry.end);
    const durationMs = entryEnd.getTime() - entryStart.getTime();
    const startHour = entryStart.getHours() + entryStart.getMinutes() / 60;

    const yInGrid = this.getYInGrid(event);
    const clickOffsetHour = (this.viewStart() + yInGrid / HOUR_HEIGHT) - startHour;

    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    let stopScroll: (() => void) | null = null;

    const onMove = (e: MouseEvent) => {
      if (!dragStarted) {
        if (Math.abs(e.clientX - startX) < THRESHOLD && Math.abs(e.clientY - startY) < THRESHOLD) return;
        dragStarted = true;
        this.interaction.isDragging = true;
        this.interaction.clearClickTimer();
        this.interaction.closePopover();
        this.interaction.dismissEmptyDraft();
        stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      lastClientY = e.clientY;
      const yInG = this.getYInGrid(e);
      const rawHour = this.viewStart() + yInG / HOUR_HEIGHT - clickOffsetHour;
      const snappedHour = snapToGrid(rawHour, SNAP_MINUTES);
      const clampedHour = Math.max(this.viewStart(), Math.min(snappedHour, this.viewEnd() - durationMs / 3600000));

      const newStart = new Date(this.ui.activeDate());
      newStart.setHours(Math.floor(clampedHour), Math.round((clampedHour % 1) * 60), 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMs);

      this.interaction.dragOverride.set({ entryId: entry.id, start: newStart, end: newEnd });
    };

    const onUp = () => {
      stopScroll?.();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (dragStarted) {
        const override = this.interaction.dragOverride();
        if (override) {
          this.timeEntryStore.updateEntry(override.entryId, { start: override.start, end: override.end });
          this.interaction.dragOverride.set(null);
        }
        setTimeout(() => { this.interaction.isDragging = false; }, 0);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ─── Delegated methods with view-specific params ────
  onResizeTopStart(event: MouseEvent, entry: TimeEntry) {
    this.interaction.onResizeTopStart(event, entry, HOUR_HEIGHT, this.viewStart(), this.scrollContainer()?.nativeElement ?? null);
  }

  onResizeStart(event: MouseEvent, entry: TimeEntry) {
    this.interaction.onResizeStart(event, entry, HOUR_HEIGHT, this.scrollContainer()?.nativeElement ?? null);
  }

  onGapClick(gap: GapSuggestion) {
    this.interaction.onGapClick(gap, this.ui.activeDate(), () => this.draftInput()?.nativeElement?.focus());
  }

  getDurationMinutes(entry: TimeEntry) {
    const start = this.interaction.getEffectiveStart(entry);
    const end = this.interaction.getEffectiveEnd(entry);
    return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  }

  getTopPosition(start: Date) { return this.interaction.getTopPosition(start, this.viewStart(), HOUR_HEIGHT); }
  getBlockHeight(start: Date, end: Date) { return this.interaction.getBlockHeight(start, end, HOUR_HEIGHT, MIN_BLOCK_HEIGHT); }
  getDisplayName = getProjectDisplayName;
  formatTime = formatTime;

  // ─── View-specific: clearView, toggleVacation ───────
  clearView() {
    this.interaction.dismissEmptyDraft();
    const entries = this.entries();
    if (entries.length > 0) {
      this.undoStore.pushDelete(entries);
      this.timeEntryStore.removeEntries(entries.map(e => e.id));
    }
    for (const event of this.googleEvents()) {
      this.timeEntryStore.dismissGoogleEvent(event.id);
    }
  }

  toggleVacation() {
    this.interaction.dismissEmptyDraft();
    if (!this.isVacation()) {
      const entries = this.entries();
      if (entries.length > 0) {
        this.undoStore.pushDelete(entries);
        this.timeEntryStore.removeEntries(entries.map(e => e.id));
      }
    }
    this.vacationStore.toggleDay(this.ui.activeDate());
  }

  getEntryLeft(entryId: string): string {
    return calcEntryLeft(this.entryLayout(), entryId, 12);
  }

  getEntryWidth(entryId: string): string {
    return calcEntryWidth(this.entryLayout(), entryId, 24, 2);
  }
}
