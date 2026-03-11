import { Component, inject, computed, signal, ElementRef, viewChild, afterNextRender, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { CalendarSyncService } from '../../../application/calendar-sync.service';
import { UndoStore } from '../../../state/undo.store';
import { VacationStore } from '../../../state/vacation.store';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { TimeEntry } from '../../../domain/models/time-entry.model';
import { Project } from '../../../domain/models/project.model';
import { CalendarEvent } from '../../../domain/models/calendar-event.model';
import { ProjectPillsBarComponent } from '../../../shared/components/project-pills-bar/project-pills-bar.component';
import { ClearConfirmPopoverComponent } from '../../../shared/components/clear-confirm-popover/clear-confirm-popover.component';
import { ProjectPopoverComponent } from '../../../shared/components/project-popover/project-popover.component';
import { DraftEntry, PopoverState, DragOverride, START_HOUR, END_HOUR, SNAP_MINUTES } from '../../../shared/models/calendar-view.models';
import { computeOverlapLayout, getEntryLeft as calcEntryLeft, getEntryWidth as calcEntryWidth } from '../../../shared/utils/overlap-layout';
import { snapToHalfHour, snapToGrid, hourToStr, formatTime } from '../../../shared/utils/time-helpers';
import { getEntryColor as calcEntryColor, getProject as calcProject } from '../../../shared/utils/entry-styling';
import { startAutoScroll } from '../../../shared/utils/auto-scroll';

const HOUR_HEIGHT = 72;

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [DurationPipe, FormsModule, ProjectPillsBarComponent, ClearConfirmPopoverComponent, ProjectPopoverComponent],
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
          @for (hour of hours; track hour) {
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
          @for (hour of hours; track hour) {
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
              (click)="onGoogleEventClick($event, event)"
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
                  (click)="dismissGoogleEvent($event, event.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          }

          @for (entry of entries(); track entry.id) {
            <div
              class="absolute rounded-lg cursor-pointer z-[6]
                     shadow-sm hover:shadow-lg transition-all group"
              [style.top.px]="getTopPosition(getEffectiveStart(entry))"
              [style.height.px]="getBlockHeight(getEffectiveStart(entry), getEffectiveEnd(entry))"
              [style.min-height.px]="34"
              [style.left]="getEntryLeft(entry.id)"
              [style.width]="getEntryWidth(entry.id)"
              [style.background-color]="getEntryColor(entry) + '15'"
              [style.border-left]="'4px solid ' + getEntryColor(entry)"
              [class.ring-2]="selectedEntryIds().has(entry.id)"
              [class.ring-indigo-400]="selectedEntryIds().has(entry.id)"
              [class.opacity-60]="dragOverride()?.entryId === entry.id"
              [class.shadow-xl]="dragOverride()?.entryId === entry.id"
              [class.!z-50]="dragOverride()?.entryId === entry.id"
              (mousedown)="onEntryMouseDown($event, entry)"
              (click)="onEntryClick($event, entry)"
              (dblclick)="onEntryDblClick($event, entry)"
            >
              <div class="px-3 py-2 h-full flex flex-col overflow-hidden">
                <div class="flex items-center gap-1.5">
                  <div class="text-sm font-semibold truncate" [style.color]="getEntryColor(entry)">{{ entry.title || 'Ohne Beschreibung' }}</div>
                  @if (entry.source === 'google') {
                    <svg class="w-3 h-3 flex-shrink-0 opacity-50" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  }
                </div>
                <div class="text-xs tabular-nums mt-0.5" [style.color]="getEntryColor(entry)" style="opacity: 0.6">
                  {{ formatTime(getEffectiveStart(entry)) }}–{{ formatTime(getEffectiveEnd(entry)) }} · {{ getDurationMinutes(entry) | duration }}
                </div>
                @if (getProject(entry); as p) {
                  <div class="text-[10px] font-bold mt-auto truncate uppercase tracking-wider" [style.color]="getEntryColor(entry)" style="opacity: 0.5">{{ p.name }}</div>
                }
              </div>
              <!-- Top resize handle -->
              <div
                class="absolute top-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                (mousedown)="onResizeTopStart($event, entry)"
              >
                <div class="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="getEntryColor(entry)" style="opacity: 0.4"></div>
              </div>
              <!-- Bottom resize handle -->
              <div
                class="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                (mousedown)="onResizeStart($event, entry)"
              >
                <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="getEntryColor(entry)" style="opacity: 0.4"></div>
              </div>
            </div>
          }

          <!-- Draft block -->
          @if (draft()) {
            <div
              class="absolute left-3 right-3 rounded-lg z-30 border-2 border-dashed"
              [style.top.px]="getDraftTop()"
              [style.height.px]="getDraftHeight()"
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
                  [ngModel]="draft()!.title"
                  (ngModelChange)="updateDraftTitle($event)"
                  (keydown.enter)="saveDraft()"
                  (keydown.escape)="cancelDraft()"
                />
                <div class="text-xs tabular-nums mt-auto" [style.color]="draftColor()" style="opacity: 0.5">{{ formatDraftTime() }}</div>
              </div>
              <div class="absolute top-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="onDraftResizeTopStart($event)">
                <div class="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
              </div>
              <div class="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="onDraftResizeStart($event)">
                <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Project popover -->
    @if (popover(); as pop) {
      <app-project-popover
        [x]="pop.x"
        [y]="pop.y"
        [selectedCount]="selectedEntryIds().size"
        [commonProjectId]="commonProjectId()"
        (assign)="assignProject($event)"
        (openDetails)="openEntryDetails()"
        (delete)="deleteEntries()"
        (close)="closePopover()"
      />
    }
  `,
  styles: [`:host { display: flex; flex-direction: column; height: 100%; }`],
})
export class DayViewComponent {
  protected readonly ui = inject(UiStore);
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);
  private readonly calendarSyncService = inject(CalendarSyncService);
  private readonly undoStore = inject(UndoStore);
  protected readonly vacationStore = inject(VacationStore);

  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  readonly draftInput = viewChild<ElementRef>('draftInput');

  readonly hourHeight = HOUR_HEIGHT;
  readonly hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  draft = signal<DraftEntry | null>(null);
  popover = signal<PopoverState | null>(null);
  selectedEntryIds = signal<Set<string>>(new Set());

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

  private resizeStartY = 0;
  private resizeStartEndHour = 0;
  resizeOverride = signal<{ entryId: string; end: Date } | null>(null);
  resizeTopOverride = signal<{ entryId: string; start: Date } | null>(null);
  dragOverride = signal<DragOverride | null>(null);
  private dragging = false;

  constructor() {
    afterNextRender(() => {
      const container = this.scrollContainer()?.nativeElement;
      if (container) container.scrollTop = (8 - START_HOUR) * HOUR_HEIGHT;
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.popover()) this.closePopover();
    else if (this.draft()) this.cancelDraft();
  }

  readonly isActiveToday = computed(() => isSameDay(this.ui.activeDate(), new Date()));
  readonly isVacation = computed(() => this.vacationStore.isVacation(this.ui.activeDate()));
  readonly nowPosition = computed(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT;
  });

  readonly entries = computed(() =>
    this.timeEntryStore.entries().filter(e => isSameDay(new Date(e.start), this.ui.activeDate()))
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
    const h = this.entries().reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0);
    return `${h.toFixed(1)}h gebucht`;
  });

  protected dismissEmptyDraft() {
    if (this.draft() && !this.draft()!.title?.trim()) {
      this.draft.set(null);
    }
  }

  private getYInGrid(event: MouseEvent): number {
    const scrollEl = this.scrollContainer()?.nativeElement;
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const scrollRect = scrollEl ? scrollEl.getBoundingClientRect() : { top: 0 };
    return event.clientY - scrollRect.top + scrollTop;
  }

  onGridMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('input')) return;

    // Save existing draft if it has a title
    if (this.draft()?.title?.trim()) { this.saveDraft(); }

    const y = this.getYInGrid(event);
    const hour = snapToHalfHour(START_HOUR + y / HOUR_HEIGHT);

    this.draft.set({ date: this.ui.activeDate(), startHour: hour, endHour: hour + 0.5, title: '' });
    setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);

    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    const stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;

    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const curY = this.getYInGrid(e);
      const curHour = snapToGrid(START_HOUR + curY / HOUR_HEIGHT, SNAP_MINUTES);
      const d = this.draft()!;
      this.draft.set({ ...d, endHour: Math.min(Math.max(curHour, d.startHour + 0.25), END_HOUR) });
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

  getDraftTop() { return (this.draft()!.startHour - START_HOUR) * HOUR_HEIGHT; }
  getDraftHeight() { const d = this.draft()!; return Math.max((d.endHour - d.startHour) * HOUR_HEIGHT, 34); }
  formatDraftTime() { const d = this.draft()!; return `${hourToStr(d.startHour)}–${hourToStr(d.endHour)}`; }
  updateDraftTitle(t: string) { const d = this.draft(); if (d) this.draft.set({ ...d, title: t }); }

  saveDraft() {
    const d = this.draft(); if (!d) return;
    const start = new Date(d.date); start.setHours(Math.floor(d.startHour), (d.startHour % 1) * 60, 0, 0);
    const end = new Date(d.date); end.setHours(Math.floor(d.endHour), (d.endHour % 1) * 60, 0, 0);
    const projectId = this.ui.defaultProjectId() ?? undefined;
    this.timeEntryStore.addEntry({ title: d.title || 'Ohne Beschreibung', start, end, source: 'manual', projectId });
    this.draft.set(null);
  }

  cancelDraft() { this.draft.set(null); }

  onDraftResizeTopStart(event: MouseEvent) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const startStartHour = this.draft()!.startHour;
    const onMove = (e: MouseEvent) => {
      const d = this.draft()!;
      const newStart = snapToGrid(startStartHour + (e.clientY - this.resizeStartY) / HOUR_HEIGHT, SNAP_MINUTES);
      this.draft.set({ ...d, startHour: Math.min(Math.max(newStart, START_HOUR), d.endHour - 0.25) });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  onDraftResizeStart(event: MouseEvent) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    this.resizeStartEndHour = this.draft()!.endHour;
    const onMove = (e: MouseEvent) => {
      const d = this.draft()!;
      const newEnd = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / HOUR_HEIGHT, SNAP_MINUTES);
      this.draft.set({ ...d, endHour: Math.max(newEnd, d.startHour + 0.25) });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

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
      const newStartHour = snapToGrid(this.resizeStartStartHour + (e.clientY - this.resizeStartY) / HOUR_HEIGHT, SNAP_MINUTES);
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

  onResizeStart(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const ed = new Date(entry.end);
    this.resizeStartEndHour = ed.getHours() + ed.getMinutes() / 60;
    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    const stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;
    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const sd = new Date(entry.start);
      const startH = sd.getHours() + sd.getMinutes() / 60;
      const newEnd = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / HOUR_HEIGHT, SNAP_MINUTES);
      const clamped = Math.max(newEnd, startH + 0.25);
      const ne = new Date(entry.end); ne.setHours(Math.floor(clamped), (clamped % 1) * 60, 0, 0);
      this.resizeOverride.set({ entryId: entry.id, end: ne });
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
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ─── Entry drag ──────────────────────────────────────
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
    const clickOffsetHour = (START_HOUR + yInGrid / HOUR_HEIGHT) - startHour;

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
      const yInG = this.getYInGrid(e);
      const rawHour = START_HOUR + yInG / HOUR_HEIGHT - clickOffsetHour;
      const snappedHour = snapToGrid(rawHour, SNAP_MINUTES);
      const clampedHour = Math.max(START_HOUR, Math.min(snappedHour, END_HOUR - durationMs / 3600000));

      const newStart = new Date(this.ui.activeDate());
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

  private clickTimer: ReturnType<typeof setTimeout> | null = null;

  onEntryClick(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation();
    if (this.dragging) return;
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
    if (id) this.ui.selectEntry(id);
    this.closePopover();
  }

  closePopover() {
    this.popover.set(null);
    this.selectedEntryIds.set(new Set());
  }

  onEntryDblClick(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation();
    if (this.dragging) return;
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
    this.dismissEmptyDraft();
    this.closePopover();
    this.ui.selectEntry(entry.id);
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

  getDurationMinutes(entry: TimeEntry) { const start = this.getEffectiveStart(entry); const end = this.getEffectiveEnd(entry); return (new Date(end).getTime() - new Date(start).getTime()) / 60000; }
  getTopPosition(start: Date) { const d = new Date(start); return (d.getHours() + d.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT; }
  getBlockHeight(start: Date, end: Date) { return Math.max((new Date(end).getTime() - new Date(start).getTime()) / 3600000 * HOUR_HEIGHT, 34); }
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
  getEntryColor(entry: TimeEntry) { return calcEntryColor(entry, this.projectStore.projectMap()); }
  getProject(entry: TimeEntry): Project | null { return calcProject(entry, this.projectStore.projectMap()); }
  formatTime = formatTime;

  clearView() {
    this.dismissEmptyDraft();
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
    this.dismissEmptyDraft();
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
