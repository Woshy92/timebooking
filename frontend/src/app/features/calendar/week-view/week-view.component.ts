import { Component, inject, computed, signal, ElementRef, viewChild, afterNextRender, HostListener, DestroyRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { CalendarSyncService } from '../../../application/calendar-sync.service';
import { format, eachDayOfInterval, isSameDay, startOfDay, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { TimeEntry } from '../../../domain/models/time-entry.model';
import { Project } from '../../../domain/models/project.model';
import { CalendarEvent } from '../../../domain/models/calendar-event.model';
import { ProjectPillsBarComponent } from '../../../shared/components/project-pills-bar/project-pills-bar.component';
import { ClearConfirmPopoverComponent } from '../../../shared/components/clear-confirm-popover/clear-confirm-popover.component';
import { DraftEntry, PopoverState, START_HOUR, END_HOUR, SNAP_MINUTES } from '../../../shared/models/calendar-view.models';
import { computeOverlapLayout, getEntryLeft as calcEntryLeft, getEntryWidth as calcEntryWidth } from '../../../shared/utils/overlap-layout';
import { snapToHalfHour, snapToGrid, hourToStr, formatTime } from '../../../shared/utils/time-helpers';
import { getEntryColor as calcEntryColor, getEntryBg as calcEntryBg, getEntryTextColor as calcEntryTextColor, getProject as calcProject } from '../../../shared/utils/entry-styling';

const HOUR_HEIGHT = 64;

@Component({
  selector: 'app-week-view',
  standalone: true,
  imports: [FormsModule, ProjectPillsBarComponent, ClearConfirmPopoverComponent],
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
          label="dieser Woche"
          title="Woche leeren"
          (confirm)="clearView()"
        />
      </div>

      <!-- Day headers -->
      <div class="flex border-b border-gray-200/80 bg-white sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="w-[52px] flex-shrink-0 border-r border-gray-100"></div>
        @for (day of days(); track day.date.toISOString()) {
          <div class="flex-1 text-center py-2.5 border-l border-gray-100/60"
               [class.bg-indigo-50/40]="day.isToday">
            <div class="text-[11px] font-semibold tracking-wider uppercase"
                 [class.text-indigo-500]="day.isToday"
                 [class.text-gray-400]="!day.isToday">{{ day.dayName }}</div>
            <div class="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                 [class.bg-indigo-600]="day.isToday"
                 [class.text-white]="day.isToday"
                 [class.text-gray-800]="!day.isToday">{{ day.dayNumber }}</div>
            @if (day.totalHours > 0) {
              <div class="text-[10px] font-medium mt-0.5"
                   [class.text-indigo-500]="day.isToday"
                   [class.text-gray-400]="!day.isToday">{{ day.totalHours.toFixed(1) }}h</div>
            }
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
            [class.bg-indigo-50/20]="day.isToday"
            (mousedown)="onGridMouseDown($event, day.date, dayIdx)"
          >
            @for (hour of hours; track hour) {
              <div class="border-b border-gray-100/50" [style.height.px]="hourHeight()">
                <div class="border-b border-dashed border-gray-100/30 h-1/2"></div>
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

            <!-- Google Calendar events -->
            @for (event of day.googleEvents; track event.id) {
              <div
                class="absolute left-1.5 right-1.5 rounded-md px-2 py-1 text-[11px] cursor-pointer z-[5]
                       bg-white border border-dashed border-gray-300 hover:border-indigo-400
                       hover:shadow-md transition-all group"
                [style.top.px]="getTopPosition(event.start)"
                [style.height.px]="getBlockHeight(event.start, event.end)"
                [style.min-height.px]="26"
                (mousedown)="$event.stopPropagation()"
                (click)="onGoogleEventClick($event, event)"
              >
                <div class="flex items-start gap-1 h-full overflow-hidden">
                  <svg class="w-3 h-3 text-gray-400 group-hover:text-indigo-500 mt-[1px] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  <div class="min-w-0 flex flex-col overflow-hidden">
                    <div class="font-medium text-gray-500 group-hover:text-indigo-600 truncate flex-shrink-0 transition-colors">{{ event.title }}</div>
                    <div class="text-gray-400 text-[10px] tabular-nums flex-shrink overflow-hidden leading-tight">{{ formatTime(event.start) }}–{{ formatTime(event.end) }}</div>
                  </div>
                </div>
              </div>
            }

            <!-- Saved time entries -->
            @for (entry of day.entries; track entry.id) {
              <div
                class="absolute rounded-md cursor-pointer z-[6]
                       shadow-sm hover:shadow-lg transition-all group"
                [style.top.px]="getTopPosition(entry.start)"
                [style.height.px]="getBlockHeight(entry.start, entry.end)"
                [style.min-height.px]="26"
                [style.left]="getEntryLeft(entry.id)"
                [style.width]="getEntryWidth(entry.id)"
                [style.background-color]="getEntryBg(entry)"
                [style.border-left]="'3px solid ' + getEntryColor(entry)"
                [class.ring-2]="selectedEntryIds().has(entry.id)"
                [class.ring-indigo-400]="selectedEntryIds().has(entry.id)"
                (mousedown)="$event.stopPropagation()"
                (click)="onEntryClick($event, entry)"
              >
                <div class="px-2 py-1 h-full flex flex-col overflow-hidden">
                  <div class="text-[11px] font-semibold truncate flex-shrink-0" [style.color]="getEntryTextColor(entry)">
                    {{ entry.title || 'Ohne Beschreibung' }}
                  </div>
                  <div class="text-[10px] tabular-nums flex-shrink overflow-hidden leading-tight" [style.color]="getEntryColor(entry)" style="opacity: 0.7">
                    {{ formatTime(entry.start) }}–{{ formatTime(entry.end) }}
                  </div>
                  @if (getProject(entry); as p) {
                    <div class="text-[9px] font-semibold mt-auto truncate uppercase tracking-wide flex-shrink overflow-hidden" [style.color]="getEntryColor(entry)" style="opacity: 0.6">{{ p.name }}</div>
                  }
                </div>
                <!-- Resize handle -->
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
      <div class="fixed inset-0 z-40" (click)="closePopover()"></div>
      <div
        class="fixed z-50 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 animate-pop-in"
        [style.left.px]="pop.x"
        [style.top.px]="pop.y"
      >
        <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          @if (selectedEntryIds().size > 1) {
            {{ selectedEntryIds().size }} Einträge · Projekt zuweisen
          } @else {
            Projekt zuweisen
          }
        </div>
        @for (project of projectStore.activeProjects(); track project.id) {
          <button
            (click)="assignProject(project.id)"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
            [class.bg-indigo-50]="commonProjectId() === project.id"
            [class.font-semibold]="commonProjectId() === project.id"
          >
            <div class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
            <span class="text-gray-800 truncate">{{ project.name }}</span>
            @if (commonProjectId() === project.id) {
              <svg class="w-3.5 h-3.5 text-indigo-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            }
          </button>
        }
        <div class="border-t border-gray-100 mt-1 pt-1">
          <button
            (click)="deleteEntries()"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            @if (selectedEntryIds().size > 1) {
              <span>{{ selectedEntryIds().size }} Einträge löschen</span>
            } @else {
              <span>Eintrag löschen</span>
            }
          </button>
        </div>
      </div>
    }
  `,
  styles: [`:host { display: flex; flex-direction: column; height: 100%; }`],
})
export class WeekViewComponent {
  private readonly timeEntryStore = inject(TimeEntryStore);
  protected readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);
  protected readonly uiStore = inject(UiStore);
  private readonly calendarSyncService = inject(CalendarSyncService);

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

  private autoSelectEffect = effect(() => {
    if (!this.uiStore.defaultProjectId()) {
      const first = this.projectStore.activeProjects()[0];
      if (first) this.uiStore.setDefaultProject(first.id);
    }
  });

  readonly draftColor = computed(() => this.defaultProject()?.color ?? '#6366F1');

  private resizingEntryId: string | null = null;
  private resizingDraft = false;
  private resizeStartY = 0;
  private resizeStartEndHour = 0;

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

    return allDays.map(date => {
      const dayEntries = entries.filter(e => isSameDay(new Date(e.start), date));
      const dayGoogleEvents = googleEvents
        .filter(e => isSameDay(new Date(e.start), date))
        .filter(e => !bookedGoogleIds.has(e.id))
        .filter(e => !dismissedGoogleIds.has(e.id));
      const totalHours = dayEntries.reduce(
        (sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000, 0
      );
      return {
        date, dayName: format(date, 'EEE', { locale: de }), dayNumber: format(date, 'd'),
        isToday: isSameDay(date, today), entries: dayEntries, googleEvents: dayGoogleEvents, totalHours,
      };
    });
  });

  // ─── Overlap layout ────────────────────────────────────
  readonly entryLayout = computed(() => {
    const result = new Map<string, { col: number; total: number }>();
    for (const day of this.days()) {
      computeOverlapLayout(day.entries, result);
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
    for (const entryId of this.selectedEntryIds()) {
      this.timeEntryStore.removeEntry(entryId);
    }
    this.closePopover();
  }

  closePopover() {
    this.popover.set(null);
    this.selectedEntryIds.set(new Set());
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

    const y = this.getYInColumn(event);
    const hour = snapToHalfHour(START_HOUR + y / this.hourHeight());

    this.draft.set({ date, startHour: hour, endHour: hour + 0.5, title: '' });
    setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);

    const onMove = (e: MouseEvent) => {
      const currentY = this.getYInColumn(e);
      const currentHour = snapToGrid(START_HOUR + currentY / this.hourHeight(), SNAP_MINUTES);
      const d = this.draft();
      if (d) {
        const newEnd = Math.max(currentHour, d.startHour + 0.25);
        this.draft.set({ ...d, endHour: Math.min(newEnd, END_HOUR) });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ─── Entry click → popover ─────────────────────────────
  onEntryClick(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation();
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
    } else {
      this.selectedEntryIds.set(new Set([entry.id]));
      this.popover.set({ x, y });
    }
  }

  onGoogleEventClick(event: MouseEvent, calEvent: CalendarEvent) {
    event.stopPropagation();
    this.calendarSyncService.importEvent(calEvent);
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
    this.resizingEntryId = entry.id;
    this.resizeStartY = event.clientY;
    const endDate = new Date(entry.end);
    this.resizeStartEndHour = endDate.getHours() + endDate.getMinutes() / 60;
    const onMove = (e: MouseEvent) => {
      const startDate = new Date(entry.start);
      const startHour = startDate.getHours() + startDate.getMinutes() / 60;
      const newEndHour = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / this.hourHeight(), SNAP_MINUTES);
      const clampedEnd = Math.max(newEndHour, startHour + 0.25);
      const newEnd = new Date(entry.end); newEnd.setHours(Math.floor(clampedEnd), (clampedEnd % 1) * 60, 0, 0);
      this.timeEntryStore.updateEntry(entry.id, { end: newEnd });
    };
    const onUp = () => { this.resizingEntryId = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  // ─── Positioning & Styling ─────────────────────────────
  getTopPosition(start: Date): number { const d = new Date(start); return (d.getHours() + d.getMinutes() / 60 - START_HOUR) * this.hourHeight(); }
  getBlockHeight(start: Date, end: Date): number { return Math.max((new Date(end).getTime() - new Date(start).getTime()) / 3600000 * this.hourHeight(), 26); }
  getEntryColor(entry: TimeEntry): string { return calcEntryColor(entry, this.projectStore.projectMap()); }
  getEntryBg(entry: TimeEntry): string { return calcEntryBg(entry, this.projectStore.projectMap()); }
  getEntryTextColor(entry: TimeEntry): string { return calcEntryTextColor(entry, this.projectStore.projectMap()); }
  getProject(entry: TimeEntry): Project | null { return calcProject(entry, this.projectStore.projectMap()); }
  formatTime = formatTime;

  toggleFitToScreen() {
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

  clearView() {
    for (const day of this.days()) {
      for (const entry of day.entries) {
        this.timeEntryStore.removeEntry(entry.id);
      }
    }
  }

}
