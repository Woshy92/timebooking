import { Component, inject, computed, signal, ElementRef, viewChild, afterNextRender, HostListener, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { CalendarSyncService } from '../../../application/calendar-sync.service';
import { UndoStore } from '../../../state/undo.store';
import { VacationStore } from '../../../state/vacation.store';
import { format, eachDayOfInterval, isSameDay, startOfDay, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { TimeEntry } from '../../../domain/models/time-entry.model';
import { Project, getProjectDisplayName } from '../../../domain/models/project.model';
import { CalendarEvent } from '../../../domain/models/calendar-event.model';
import { ProjectPillsBarComponent } from '../../../shared/components/project-pills-bar/project-pills-bar.component';
import { ClearConfirmPopoverComponent } from '../../../shared/components/clear-confirm-popover/clear-confirm-popover.component';
import { ProjectPopoverComponent } from '../../../shared/components/project-popover/project-popover.component';
import { DraftEntry, PopoverState, DragOverride, START_HOUR, END_HOUR, SNAP_MINUTES } from '../../../shared/models/calendar-view.models';
import { computeOverlapLayout, getEntryLeft as calcEntryLeft, getEntryWidth as calcEntryWidth } from '../../../shared/utils/overlap-layout';
import { snapToHalfHour, snapToGrid, hourToStr, formatTime } from '../../../shared/utils/time-helpers';
import { getEntryColor as calcEntryColor, getEntryBg as calcEntryBg, getEntryTextColor as calcEntryTextColor, getProject as calcProject } from '../../../shared/utils/entry-styling';
import { startAutoScroll } from '../../../shared/utils/auto-scroll';
import { findGapSuggestions, GapSuggestion } from '../../../shared/utils/gap-filler';

const HOUR_HEIGHT = 64;

@Component({
  selector: 'app-week-view',
  standalone: true,
  imports: [FormsModule, ProjectPillsBarComponent, ClearConfirmPopoverComponent, ProjectPopoverComponent],
  template: `
    <div class="flex flex-col h-full bg-white">
      <!-- Default project bar -->
      <div class="flex items-center gap-3 px-4 py-1.5 border-b border-gray-100 bg-gray-50/40">
        <app-project-pills-bar class="flex-1 min-w-0" />
        <button (click)="toggleFitToScreen()"
          class="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          [class.text-indigo-500]="fitToScreen()"
          [class.bg-indigo-50]="fitToScreen()"
          [class.text-gray-400]="!fitToScreen()"
          title="An Bildschirmhöhe anpassen">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>
          </svg>
        </button>
        <app-clear-confirm-popover
          [entryCount]="weekEntryCount()"
          [googleEventCount]="weekGoogleEventCount()"
          label="dieser Woche"
          title="Woche leeren"
          (confirm)="clearView()"
        />
      </div>

      <!-- Weekly project summary -->
      @if (weekTotalHours() > 0) {
        <div class="flex items-center gap-3 px-4 py-1 border-b border-gray-100 bg-gray-50/20 overflow-x-auto">
          <span class="text-[10px] font-bold text-gray-400 tabular-nums whitespace-nowrap">
            {{ formatHM(weekTotalHours()) }}
          </span>
          <div class="flex items-center gap-2 min-w-0">
            @for (ps of weekProjectSummary(); track ps.pid) {
              <div class="flex items-center gap-1 whitespace-nowrap">
                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" [style.background-color]="ps.color"></div>
                <span class="text-[10px] text-gray-500">{{ ps.name }}</span>
                <span class="text-[10px] font-semibold tabular-nums" [style.color]="ps.color">{{ formatHM(ps.hours) }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Day headers -->
      <div class="flex border-b border-gray-200/80 bg-white sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="w-[52px] flex-shrink-0 border-r border-gray-100"></div>
        @for (day of days(); track day.date.toISOString()) {
          <div class="flex-1 text-center py-2.5 border-l border-gray-100/60 relative group/dh"
               [class.bg-indigo-50/40]="day.isToday && !day.isVacation"
               [class.bg-amber-50/60]="day.isVacation">
            <div class="text-[11px] font-semibold tracking-wider uppercase"
                 [class.text-indigo-500]="day.isToday && !day.isVacation"
                 [class.text-amber-500]="day.isVacation"
                 [class.text-gray-400]="!day.isToday && !day.isVacation">{{ day.dayName }}</div>
            <div class="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                 [class.bg-indigo-600]="day.isToday && !day.isVacation"
                 [class.text-white]="day.isToday && !day.isVacation"
                 [class.bg-amber-200]="day.isVacation"
                 [class.text-amber-700]="day.isVacation"
                 [class.text-gray-800]="!day.isToday && !day.isVacation">{{ day.dayNumber }}</div>
            @if (day.isVacation) {
              <div class="text-[10px] font-medium mt-0.5 text-amber-500">Urlaub</div>
            } @else if (day.totalHours > 0) {
              <div class="text-[10px] font-medium mt-0.5"
                   [class.text-indigo-500]="day.isToday"
                   [class.text-gray-400]="!day.isToday">{{ formatHM(day.totalHours) }}</div>
              @if ((dayProjectSummary().get(day.date.toISOString()) ?? []).length) {
                <div class="flex mx-auto mt-1 h-1 rounded-full overflow-hidden" style="width: 60%">
                  @for (ps of dayProjectSummary().get(day.date.toISOString()) ?? []; track ps.pid) {
                    <div class="h-full" [style.background-color]="ps.color"
                         [style.flex-basis.%]="ps.hours / day.totalHours * 100"></div>
                  }
                </div>
              }
            }
            <button
              class="absolute top-1 right-1 w-5 h-5 rounded-full text-[9px] font-bold leading-none
                     transition-all flex items-center justify-center"
              [class.opacity-100]="day.isVacation"
              [class.opacity-30]="!day.isVacation"
              [class.hover:opacity-80]="!day.isVacation"
              [class.bg-amber-100]="day.isVacation"
              [class.text-amber-600]="day.isVacation"
              [class.hover:bg-amber-200]="day.isVacation"
              [class.bg-gray-100]="!day.isVacation"
              [class.text-gray-400]="!day.isVacation"
              [class.hover:bg-gray-200]="!day.isVacation"
              (click)="toggleVacation(day)"
              [title]="day.isVacation ? 'Urlaub entfernen' : 'Als Urlaub markieren'">U</button>
          </div>
        }
      </div>

      <!-- Scrollable time grid -->
      <div class="flex flex-1 overflow-x-hidden"
           [class.overflow-y-auto]="!fitToScreen()"
           [class.overflow-y-hidden]="fitToScreen()"
           #scrollContainer>
        <!-- Hour gutter -->
        <div class="w-[52px] flex-shrink-0 border-r border-gray-100 bg-gray-50/30">
          @for (hour of hours; track hour) {
            <div class="relative" [style.height.px]="hourHeight()">
              <span class="absolute -top-[9px] right-2 text-[10px] font-medium text-gray-400 tabular-nums select-none">
                {{ hour < 10 ? '0' + hour : hour }}:00
              </span>
            </div>
          }
        </div>

        <!-- Day columns -->
        @for (day of days(); track day.date.toISOString(); let dayIdx = $index) {
          <div
            class="flex-1 border-l border-gray-100/60 relative select-none"
            [class.bg-indigo-50/20]="day.isToday && !day.isVacation"
            [class.bg-gray-200/70]="day.isVacation"
            (mousedown)="onGridMouseDown($event, day.date, dayIdx)"
          >
            @for (hour of hours; track hour) {
              <div class="border-b border-gray-100/50" [style.height.px]="hourHeight()">
                <div class="border-b border-dashed border-gray-100/30 h-1/2"></div>
              </div>
            }

            <!-- Vacation overlay -->
            @if (day.isVacation) {
              <div class="absolute inset-0 bg-gray-300/30 z-[2] pointer-events-none flex items-center justify-center">
                <span class="text-gray-400/70 text-sm font-bold -rotate-12 select-none">Urlaub</span>
              </div>
            }

            <!-- Now indicator -->
            @if (day.isToday) {
              <div class="absolute left-0 right-0 z-10 pointer-events-none" [style.top.px]="nowPosition()">
                <div class="flex items-center">
                  <div class="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shadow-sm"></div>
                  <div class="flex-1 h-[2px] bg-red-500/70"></div>
                </div>
              </div>
            }

            <!-- Gap suggestions -->
            @if (uiStore.highlightGaps()) {
              @for (gap of day.gapSuggestions; track gap.id) {
                <div
                  class="absolute left-1.5 right-1.5 rounded-md px-2 py-1 text-[11px] cursor-pointer z-[3]
                         bg-amber-50/80 border border-dashed border-amber-300 hover:border-amber-500
                         hover:shadow-md transition-all group"
                  [style.top.px]="getTopPosition(gap.start)"
                  [style.height.px]="getBlockHeight(gap.start, gap.end)"
                  [style.min-height.px]="26"
                  (mousedown)="$event.stopPropagation()"
                  (click)="onGapClick(gap)"
                >
                  <div class="flex items-start gap-1 h-full overflow-hidden">
                    <svg class="w-3 h-3 text-amber-400 group-hover:text-amber-600 mt-[1px] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    <div class="min-w-0 flex flex-col overflow-hidden flex-1">
                      <div class="font-medium text-amber-600 group-hover:text-amber-700 truncate flex-shrink-0 transition-colors">{{ getGapMinutes(gap) }} Min</div>
                      <div class="text-amber-400 text-[10px] tabular-nums flex-shrink overflow-hidden leading-tight">{{ formatTime(gap.start) }}–{{ formatTime(gap.end) }}</div>
                    </div>
                    <button
                      class="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-medium
                             bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700 transition-all flex-shrink-0"
                      title="Als Pause markieren"
                      (click)="onGapPause($event, gap)"
                    >
                      Pause
                    </button>
                  </div>
                </div>
              }
            }

            <!-- Google Calendar events -->
            @for (event of day.googleEvents; track event.id) {
              <div
                class="absolute rounded-md px-2 py-1 text-[11px] cursor-pointer z-[5]
                       bg-white border border-dashed border-gray-300 hover:border-indigo-400
                       hover:shadow-md transition-all group"
                [style.top.px]="getTopPosition(event.start)"
                [style.height.px]="getBlockHeight(event.start, event.end)"
                [style.min-height.px]="26"
                [style.left]="getEntryLeft(event.id)"
                [style.width]="getEntryWidth(event.id)"
                (mousedown)="$event.stopPropagation()"
                (click)="onGoogleEventClick($event, event)"
              >
                <div class="flex items-start gap-1 h-full overflow-hidden">
                  <svg class="w-3 h-3 text-gray-400 group-hover:text-indigo-500 mt-[1px] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  <div class="min-w-0 flex flex-col overflow-hidden flex-1">
                    <div class="font-medium text-gray-500 group-hover:text-indigo-600 truncate flex-shrink-0 transition-colors">{{ event.title }}</div>
                    <div class="text-gray-400 text-[10px] tabular-nums flex-shrink overflow-hidden leading-tight">{{ formatTime(event.start) }}–{{ formatTime(event.end) }}</div>
                  </div>
                  <button
                    class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all flex-shrink-0"
                    title="Ausblenden"
                    (click)="dismissGoogleEvent($event, event.id)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            }

            <!-- Saved time entries -->
            @for (entry of day.entries; track entry.id) {
              <div
                class="absolute rounded-md cursor-pointer z-[6]
                       shadow-sm hover:shadow-lg transition-all group"
                [style.top.px]="getTopPosition(getEffectiveStart(entry))"
                [style.height.px]="getBlockHeight(getEffectiveStart(entry), getEffectiveEnd(entry))"
                [style.min-height.px]="26"
                [style.left]="getEntryLeft(entry.id)"
                [style.width]="getEntryWidth(entry.id)"
                [style.background-color]="getEntryBg(entry)"
                [style.border-left]="'3px solid ' + getEntryColor(entry)"
                [class.ring-2]="selectedEntryIds().has(entry.id)"
                [class.ring-indigo-400]="selectedEntryIds().has(entry.id)"
                [class.opacity-60]="dragOverride()?.entryId === entry.id"
                [class.shadow-xl]="dragOverride()?.entryId === entry.id"
                [class.!z-50]="dragOverride()?.entryId === entry.id"
                (mousedown)="onEntryMouseDown($event, entry, dayIdx)"
                (click)="onEntryClick($event, entry)"
                (dblclick)="onEntryDblClick($event, entry)"
              >
                <div class="px-2 py-1 h-full flex flex-col overflow-hidden">
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <div class="text-[11px] font-semibold truncate" [style.color]="getEntryTextColor(entry)">
                      {{ entry.title || 'Ohne Beschreibung' }}
                    </div>
                    @if (entry.source === 'google') {
                      <svg class="w-2.5 h-2.5 flex-shrink-0 opacity-50" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    }
                  </div>
                  <div class="text-[10px] tabular-nums flex-shrink overflow-hidden leading-tight" [style.color]="getEntryColor(entry)" style="opacity: 0.7">
                    {{ formatTime(getEffectiveStart(entry)) }}–{{ formatTime(getEffectiveEnd(entry)) }}
                  </div>
                  @if (getProject(entry); as p) {
                    <div class="text-[9px] font-semibold mt-auto truncate uppercase tracking-wide flex-shrink overflow-hidden" [style.color]="getEntryColor(entry)" style="opacity: 0.6">{{ getDisplayName(p) }}</div>
                  }
                </div>
                <!-- Top resize handle -->
                <div
                  class="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  [style.background]="'linear-gradient(' + getEntryColor(entry) + '30, transparent)'"
                  (mousedown)="onResizeTopStart($event, entry)"
                >
                  <div class="absolute top-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="getEntryColor(entry)" style="opacity: 0.5"></div>
                </div>
                <!-- Bottom resize handle -->
                <div
                  class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  [style.background]="'linear-gradient(transparent, ' + getEntryColor(entry) + '30)'"
                  (mousedown)="onResizeStart($event, entry)"
                >
                  <div class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="getEntryColor(entry)" style="opacity: 0.5"></div>
                </div>
              </div>
            }

            <!-- Draft block -->
            @if (draft() && isDraftOnDay(day.date)) {
              <div
                class="absolute left-1.5 right-1.5 rounded-md z-30 border-2 border-dashed"
                [style.top.px]="getDraftTop()"
                [style.height.px]="getDraftHeight()"
                [style.min-height.px]="26"
                [style.border-color]="draftColor()"
                [style.background-color]="draftColor() + '0A'"
              >
                <div class="px-2 py-1 h-full flex flex-col">
                  <input
                    #draftInput
                    class="bg-transparent text-[11px] font-semibold placeholder:opacity-40 outline-none w-full"
                    [style.color]="draftColor()"
                    placeholder="Beschreibung eingeben..."
                    [ngModel]="draft()!.title"
                    (ngModelChange)="updateDraftTitle($event)"
                    (keydown.enter)="saveDraft()"
                    (keydown.escape)="cancelDraft()"
                  />
                  <div class="text-[10px] tabular-nums mt-auto" [style.color]="draftColor()" style="opacity: 0.5">
                    {{ formatDraftTime() }}
                  </div>
                </div>
                <div class="absolute top-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="onDraftResizeTopStart($event)">
                  <div class="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
                </div>
                <div class="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="onDraftResizeStart($event)">
                  <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Project popover -->
    @if (popover(); as pop) {
      <app-project-popover
        [x]="pop.x"
        [y]="pop.y"
        [selectedCount]="selectedEntryIds().size"
        [commonProjectId]="commonProjectId()"
        [projectHours]="projectHoursMap()"
        (assign)="assignProject($event)"
        (openDetails)="openEntryDetails()"
        (delete)="deleteEntries()"
        (close)="closePopover()"
      />
    }
  `,
  styles: [`:host { display: flex; flex-direction: column; height: 100%; }`],
})
export class WeekViewComponent {
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);
  protected readonly uiStore = inject(UiStore);
  private readonly calendarSyncService = inject(CalendarSyncService);
  private readonly undoStore = inject(UndoStore);
  protected readonly vacationStore = inject(VacationStore);

  private readonly destroyRef = inject(DestroyRef);

  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  readonly draftInput = viewChild<ElementRef>('draftInput');

  readonly hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  draft = signal<DraftEntry | null>(null);
  popover = signal<PopoverState | null>(null);
  selectedEntryIds = signal<Set<string>>(new Set());
  fitToScreen = signal(true);
  private containerHeight = signal(0);

  readonly hourHeight = computed(() => {
    if (this.fitToScreen()) {
      const h = this.containerHeight();
      return h > 0 ? h / this.hours.length : HOUR_HEIGHT;
    }
    return HOUR_HEIGHT;
  });

  readonly defaultProject = computed(() => {
    const id = this.uiStore.defaultProjectId();
    if (id) return this.projectStore.projectMap().get(id) ?? null;
    return this.projectStore.activeProjects()[0] ?? null;
  });

  readonly draftColor = computed(() => this.defaultProject()?.color ?? '#6366F1');

  private resizingDraft = false;
  private resizeStartY = 0;
  private resizeStartEndHour = 0;
  resizeOverride = signal<{ entryId: string; end: Date } | null>(null);
  resizeTopOverride = signal<{ entryId: string; start: Date } | null>(null);
  dragOverride = signal<DragOverride | null>(null);
  private dragging = false;

  constructor() {
    afterNextRender(() => {
      const container = this.scrollContainer()?.nativeElement;
      if (!container) return;
      if (!this.fitToScreen()) {
        container.scrollTop = (8 - START_HOUR) * HOUR_HEIGHT;
      }
      const ro = new ResizeObserver(entries => {
        this.containerHeight.set(entries[0].contentRect.height);
      });
      ro.observe(container);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.popover()) this.closePopover();
    else if (this.draft()) this.cancelDraft();
  }

  readonly nowPosition = computed(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60 - START_HOUR) * this.hourHeight();
  });

  readonly days = computed(() => {
    const interval = { start: this.uiStore.weekStart(), end: this.uiStore.weekEnd() };
    const allDays = eachDayOfInterval(interval).filter(d => !isWeekend(d));
    const entries = this.timeEntryStore.entries();
    const googleEvents = this.calendarStore.events();
    const bookedGoogleIds = new Set(entries.filter(e => e.googleEventId).map(e => e.googleEventId));
    const dismissedGoogleIds = new Set(this.timeEntryStore.dismissedGoogleEventIds());
    const today = startOfDay(new Date());

    const vacationSet = this.vacationStore.daySet();

    return allDays.map(date => {
      const dayEntries = entries.filter(e => isSameDay(new Date(e.start), date));
      const dayGoogleEvents = googleEvents
        .filter(e => isSameDay(new Date(e.start), date))
        .filter(e => !bookedGoogleIds.has(e.id))
        .filter(e => !dismissedGoogleIds.has(e.id));
      const totalHours = dayEntries.reduce(
        (sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0
      );
      const isVacation = vacationSet.has(format(date, 'yyyy-MM-dd'));
      const gapSuggestions = isVacation ? [] : findGapSuggestions(dayEntries);
      return {
        date, dayName: format(date, 'EEE', { locale: de }), dayNumber: format(date, 'd'),
        isToday: isSameDay(date, today), entries: dayEntries, googleEvents: dayGoogleEvents, totalHours, isVacation, gapSuggestions,
      };
    });
  });

  // ─── Overlap layout ────────────────────────────────────
  readonly entryLayout = computed(() => {
    const result = new Map<string, { col: number; total: number }>();
    for (const day of this.days()) {
      computeOverlapLayout([...day.entries, ...day.googleEvents], result);
    }
    return result;
  });

  getEntryLeft(entryId: string): string {
    return calcEntryLeft(this.entryLayout(), entryId, 6);
  }

  getEntryWidth(entryId: string): string {
    return calcEntryWidth(this.entryLayout(), entryId, 12, 1);
  }

  // ─── Multi-select & Popover ─────────────────────────────
  readonly commonProjectId = computed((): string | undefined | null => {
    const ids = this.selectedEntryIds();
    if (ids.size === 0) return null;
    const entries = this.timeEntryStore.entries().filter(e => ids.has(e.id));
    if (entries.length === 0) return null;
    const first = entries[0].projectId;
    return entries.every(e => e.projectId === first) ? first : null;
  });

  assignProject(projectId: string | undefined) {
    for (const entryId of this.selectedEntryIds()) {
      this.timeEntryStore.assignProject(entryId, projectId);
    }
    this.closePopover();
  }

  deleteEntries() {
    const ids = [...this.selectedEntryIds()];
    const entries = this.timeEntryStore.entries().filter(e => ids.includes(e.id));
    if (entries.length > 0) {
      this.undoStore.pushDelete(entries);
      this.timeEntryStore.removeEntries(ids);
    }
    this.closePopover();
  }

  openEntryDetails() {
    const id = [...this.selectedEntryIds()][0];
    if (id) this.uiStore.selectEntry(id);
    this.closePopover();
  }

  closePopover() {
    this.popover.set(null);
    this.selectedEntryIds.set(new Set());
  }

  // ─── Dismiss empty draft on outside click ──────────────
  protected dismissEmptyDraft() {
    if (this.draft() && !this.draft()!.title?.trim()) {
      this.draft.set(null);
    }
  }

  // ─── Grid interaction ──────────────────────────────────
  private getYInColumn(event: MouseEvent): number {
    const scrollEl = this.scrollContainer()?.nativeElement;
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const scrollRect = scrollEl ? scrollEl.getBoundingClientRect() : { top: 0 };
    return event.clientY - scrollRect.top + scrollTop;
  }

  onGridMouseDown(event: MouseEvent, date: Date, _dayIdx: number) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('input')) return;

    // Close popover on background click
    if (this.popover()) { this.closePopover(); return; }

    // Save existing draft if it has a title
    if (this.draft()?.title?.trim()) { this.saveDraft(); }

    const y = this.getYInColumn(event);
    const hour = snapToHalfHour(START_HOUR + y / this.hourHeight());

    this.draft.set({ date, startHour: hour, endHour: hour + 0.5, title: '' });
    setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);

    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    const stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;

    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const currentY = this.getYInColumn(e);
      const currentHour = snapToGrid(START_HOUR + currentY / this.hourHeight(), SNAP_MINUTES);
      const d = this.draft();
      if (d) {
        const newEnd = Math.max(currentHour, d.startHour + 0.25);
        this.draft.set({ ...d, endHour: Math.min(newEnd, END_HOUR) });
      }
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

  // ─── Entry click → popover (delayed for dblclick) ──────
  private clickTimer: ReturnType<typeof setTimeout> | null = null;

  onEntryClick(event: MouseEvent, entry: TimeEntry) {
    if (this.dragging) return;
    event.stopPropagation();
    this.dismissEmptyDraft();
    const x = Math.min(event.clientX, window.innerWidth - 220);
    const y = Math.min(event.clientY, window.innerHeight - 300);

    if (event.metaKey) {
      const current = new Set(this.selectedEntryIds());
      if (current.has(entry.id)) {
        current.delete(entry.id);
      } else {
        current.add(entry.id);
      }
      this.selectedEntryIds.set(current);
      if (current.size > 0) {
        this.popover.set({ x, y });
      } else {
        this.popover.set(null);
      }
      return;
    }

    if (this.clickTimer) clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
      this.selectedEntryIds.set(new Set([entry.id]));
      this.popover.set({ x, y });
    }, 250);
  }

  onEntryDblClick(event: MouseEvent, entry: TimeEntry) {
    if (this.dragging) return;
    event.stopPropagation();
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
    this.dismissEmptyDraft();
    this.closePopover();
    this.uiStore.selectEntry(entry.id);
  }

  onGoogleEventClick(event: MouseEvent, calEvent: CalendarEvent) {
    event.stopPropagation();
    this.dismissEmptyDraft();
    this.calendarSyncService.importEvent(calEvent);
  }

  dismissGoogleEvent(event: MouseEvent, eventId: string) {
    event.stopPropagation();
    this.dismissEmptyDraft();
    this.timeEntryStore.dismissGoogleEvent(eventId);
  }

  // ─── Gap suggestions ──────────────────────────────────
  onGapClick(gap: GapSuggestion) {
    if (this.draft()?.title?.trim()) { this.saveDraft(); }
    const start = new Date(gap.start);
    const end = new Date(gap.end);
    this.draft.set({
      date: start,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
      title: '',
    });
    setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);
  }

  onGapPause(event: MouseEvent, gap: GapSuggestion) {
    event.stopPropagation();
    this.timeEntryStore.addEntry({
      title: 'Pause',
      start: gap.start,
      end: gap.end,
      source: 'manual',
      pause: true,
    });
  }

  getGapMinutes(gap: GapSuggestion): number {
    return Math.round((new Date(gap.end).getTime() - new Date(gap.start).getTime()) / 60000);
  }

  // ─── Entry drag ──────────────────────────────────────
  onEntryMouseDown(event: MouseEvent, entry: TimeEntry, dayIdx: number) {
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

    const yInColumn = this.getYInColumn(event);
    const clickOffsetHour = (START_HOUR + yInColumn / this.hourHeight()) - startHour;

    const dayColumns = this.getDayColumnRects();
    let currentDayIdx = dayIdx;

    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    let stopScroll: (() => void) | null = null;

    const onMove = (e: MouseEvent) => {
      if (!dragStarted) {
        if (Math.abs(e.clientX - startX) < THRESHOLD && Math.abs(e.clientY - startY) < THRESHOLD) return;
        dragStarted = true;
        this.dragging = true;
        if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
        this.closePopover();
        this.dismissEmptyDraft();
        stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      lastClientY = e.clientY;

      currentDayIdx = this.getDayIdxFromX(e.clientX, dayColumns, currentDayIdx);
      const targetDate = this.days()[currentDayIdx].date;

      const yInCol = this.getYInColumn(e);
      const rawHour = START_HOUR + yInCol / this.hourHeight() - clickOffsetHour;
      const snappedHour = snapToGrid(rawHour, SNAP_MINUTES);
      const clampedHour = Math.max(START_HOUR, Math.min(snappedHour, END_HOUR - durationMs / 3600000));

      const newStart = new Date(targetDate);
      newStart.setHours(Math.floor(clampedHour), Math.round((clampedHour % 1) * 60), 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMs);

      this.dragOverride.set({ entryId: entry.id, start: newStart, end: newEnd });
    };

    const onUp = () => {
      stopScroll?.();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (dragStarted) {
        const override = this.dragOverride();
        if (override) {
          this.timeEntryStore.updateEntry(override.entryId, { start: override.start, end: override.end });
          this.dragOverride.set(null);
        }
        setTimeout(() => { this.dragging = false; }, 0);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private getDayColumnRects(): DOMRect[] {
    const container = this.scrollContainer()?.nativeElement;
    if (!container) return [];
    const children = Array.from(container.children) as HTMLElement[];
    return children.slice(1).map(el => el.getBoundingClientRect());
  }

  private getDayIdxFromX(clientX: number, columns: DOMRect[], fallback: number): number {
    for (let i = 0; i < columns.length; i++) {
      if (clientX >= columns[i].left && clientX < columns[i].right) return i;
    }
    if (columns.length > 0 && clientX >= columns[columns.length - 1].right) return columns.length - 1;
    if (columns.length > 0 && clientX < columns[0].left) return 0;
    return fallback;
  }

  // ─── Draft ─────────────────────────────────────────────
  isDraftOnDay(date: Date): boolean { return !!this.draft() && isSameDay(this.draft()!.date, date); }
  getDraftTop(): number { return (this.draft()!.startHour - START_HOUR) * this.hourHeight(); }
  getDraftHeight(): number { const d = this.draft()!; return Math.max((d.endHour - d.startHour) * this.hourHeight(), 26); }
  formatDraftTime(): string { const d = this.draft()!; return `${hourToStr(d.startHour)}–${hourToStr(d.endHour)}`; }
  updateDraftTitle(title: string) { const d = this.draft(); if (d) this.draft.set({ ...d, title }); }

  saveDraft() {
    const d = this.draft(); if (!d) return;
    const start = new Date(d.date); start.setHours(Math.floor(d.startHour), (d.startHour % 1) * 60, 0, 0);
    const end = new Date(d.date); end.setHours(Math.floor(d.endHour), (d.endHour % 1) * 60, 0, 0);
    const projectId = this.uiStore.defaultProjectId() ?? undefined;
    this.timeEntryStore.addEntry({ title: d.title || 'Ohne Beschreibung', start, end, source: 'manual', projectId });
    this.draft.set(null);
  }

  cancelDraft() { this.draft.set(null); }

  onDraftResizeTopStart(event: MouseEvent) {
    event.stopPropagation(); event.preventDefault();
    this.resizingDraft = true;
    this.resizeStartY = event.clientY;
    const startStartHour = this.draft()!.startHour;
    const onMove = (e: MouseEvent) => {
      const d = this.draft()!;
      const newStart = snapToGrid(startStartHour + (e.clientY - this.resizeStartY) / this.hourHeight(), SNAP_MINUTES);
      this.draft.set({ ...d, startHour: Math.min(Math.max(newStart, START_HOUR), d.endHour - 0.25) });
    };
    const onUp = () => { this.resizingDraft = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  onDraftResizeStart(event: MouseEvent) {
    event.stopPropagation(); event.preventDefault();
    this.resizingDraft = true;
    this.resizeStartY = event.clientY;
    this.resizeStartEndHour = this.draft()!.endHour;
    const onMove = (e: MouseEvent) => {
      const d = this.draft()!;
      const newEnd = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / this.hourHeight(), SNAP_MINUTES);
      this.draft.set({ ...d, endHour: Math.max(newEnd, d.startHour + 0.25) });
    };
    const onUp = () => { this.resizingDraft = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  // ─── Entry resize ──────────────────────────────────────
  onResizeStart(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const endDate = new Date(entry.end);
    this.resizeStartEndHour = endDate.getHours() + endDate.getMinutes() / 60;
    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    const stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;
    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const startDate = new Date(entry.start);
      const startHour = startDate.getHours() + startDate.getMinutes() / 60;
      const newEndHour = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / this.hourHeight(), SNAP_MINUTES);
      const clampedEnd = Math.max(newEndHour, startHour + 0.25);
      const newEnd = new Date(entry.end); newEnd.setHours(Math.floor(clampedEnd), (clampedEnd % 1) * 60, 0, 0);
      this.resizeOverride.set({ entryId: entry.id, end: newEnd });
    };
    const onUp = () => {
      stopScroll?.();
      const override = this.resizeOverride();
      if (override) {
        this.timeEntryStore.updateEntry(override.entryId, { end: override.end });
        this.resizeOverride.set(null);
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  // ─── Entry resize top ─────────────────────────────────
  private resizeStartStartHour = 0;

  onResizeTopStart(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const startDate = new Date(entry.start);
    this.resizeStartStartHour = startDate.getHours() + startDate.getMinutes() / 60;
    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    const stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;
    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const endDate = new Date(entry.end);
      const endHour = endDate.getHours() + endDate.getMinutes() / 60;
      const newStartHour = snapToGrid(this.resizeStartStartHour + (e.clientY - this.resizeStartY) / this.hourHeight(), SNAP_MINUTES);
      const clampedStart = Math.min(Math.max(newStartHour, START_HOUR), endHour - 0.25);
      const newStart = new Date(entry.start); newStart.setHours(Math.floor(clampedStart), (clampedStart % 1) * 60, 0, 0);
      this.resizeTopOverride.set({ entryId: entry.id, start: newStart });
    };
    const onUp = () => {
      stopScroll?.();
      const override = this.resizeTopOverride();
      if (override) {
        this.timeEntryStore.updateEntry(override.entryId, { start: override.start });
        this.resizeTopOverride.set(null);
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  // ─── Positioning & Styling ─────────────────────────────
  getTopPosition(start: Date): number { const d = new Date(start); return (d.getHours() + d.getMinutes() / 60 - START_HOUR) * this.hourHeight(); }
  getBlockHeight(start: Date, end: Date): number { return Math.max((new Date(end).getTime() - new Date(start).getTime()) / 3600000 * this.hourHeight(), 26); }
  getEffectiveStart(entry: TimeEntry): Date {
    const drag = this.dragOverride();
    if (drag && drag.entryId === entry.id) return drag.start;
    const override = this.resizeTopOverride();
    return override && override.entryId === entry.id ? override.start : entry.start;
  }
  getEffectiveEnd(entry: TimeEntry): Date {
    const drag = this.dragOverride();
    if (drag && drag.entryId === entry.id) return drag.end;
    const override = this.resizeOverride();
    return override && override.entryId === entry.id ? override.end : entry.end;
  }
  getEntryColor(entry: TimeEntry): string { return calcEntryColor(entry, this.projectStore.projectMap()); }
  getEntryBg(entry: TimeEntry): string { return calcEntryBg(entry, this.projectStore.projectMap()); }
  getEntryTextColor(entry: TimeEntry): string { return calcEntryTextColor(entry, this.projectStore.projectMap()); }
  getProject(entry: TimeEntry): Project | null { return calcProject(entry, this.projectStore.projectMap()); }
  getDisplayName = getProjectDisplayName;
  formatTime = formatTime;

  toggleFitToScreen() {
    this.dismissEmptyDraft();
    this.fitToScreen.update(v => !v);
    if (!this.fitToScreen()) {
      setTimeout(() => {
        const container = this.scrollContainer()?.nativeElement;
        if (container) container.scrollTop = (8 - START_HOUR) * this.hourHeight();
      }, 0);
    }
  }

  readonly weekEntryCount = computed(() =>
    this.days().reduce((sum, day) => sum + day.entries.length, 0)
  );

  readonly weekGoogleEventCount = computed(() =>
    this.days().reduce((sum, day) => sum + day.googleEvents.length, 0)
  );

  readonly weekProjectSummary = computed(() => {
    const entries = this.days().flatMap(d => d.entries);
    const map = new Map<string, number>();
    for (const e of entries) {
      const pid = e.projectId ?? '__none__';
      map.set(pid, (map.get(pid) ?? 0) + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000);
    }
    const projectMap = this.projectStore.projectMap();
    const result: { pid: string; name: string; color: string; hours: number }[] = [];
    for (const [pid, hours] of map) {
      if (pid === '__none__') {
        result.push({ pid, name: 'Ohne Projekt', color: '#9CA3AF', hours });
      } else {
        const p = projectMap.get(pid);
        if (p) result.push({ pid, name: getProjectDisplayName(p), color: p.color, hours });
      }
    }
    result.sort((a, b) => b.hours - a.hours);
    return result;
  });

  readonly weekTotalHours = computed(() =>
    this.weekProjectSummary().reduce((sum, p) => sum + p.hours, 0)
  );

  readonly projectHoursMap = computed(() => {
    const map = new Map<string, number>();
    for (const ps of this.weekProjectSummary()) {
      if (ps.pid !== '__none__') map.set(ps.pid, ps.hours);
    }
    return map;
  });

  readonly dayProjectSummary = computed(() => {
    const projectMap = this.projectStore.projectMap();
    const result = new Map<string, { pid: string; name: string; color: string; hours: number }[]>();

    for (const day of this.days()) {
      if (day.entries.length === 0) continue;
      const hoursByProject = new Map<string, number>();
      for (const e of day.entries) {
        const pid = e.projectId ?? '__none__';
        hoursByProject.set(pid, (hoursByProject.get(pid) ?? 0) + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000);
      }
      const summary = [...hoursByProject.entries()]
        .map(([pid, hours]) => {
          const p = pid === '__none__' ? null : projectMap.get(pid);
          return { pid, name: p ? getProjectDisplayName(p) : 'Ohne Projekt', color: p?.color ?? '#9CA3AF', hours };
        })
        .sort((a, b) => b.hours - a.hours);
      result.set(day.date.toISOString(), summary);
    }
    return result;
  });

  formatHM(hours: number): string {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  clearView() {
    this.dismissEmptyDraft();
    const entries = this.days().flatMap(day => day.entries);
    if (entries.length > 0) {
      this.undoStore.pushDelete(entries);
      this.timeEntryStore.removeEntries(entries.map(e => e.id));
    }
    const googleEvents = this.days().flatMap(day => day.googleEvents);
    for (const event of googleEvents) {
      this.timeEntryStore.dismissGoogleEvent(event.id);
    }
    this.calendarStore.clearEvents();
  }

  toggleVacation(day: { date: Date; entries: TimeEntry[]; isVacation: boolean }) {
    this.dismissEmptyDraft();
    if (!day.isVacation && day.entries.length > 0) {
      this.undoStore.pushDelete(day.entries);
      this.timeEntryStore.removeEntries(day.entries.map(e => e.id));
    }
    this.vacationStore.toggleDay(day.date);
  }

}
