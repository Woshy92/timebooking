import { Component, inject, computed, signal, ElementRef, viewChild, afterNextRender, HostListener, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { TimeEntry } from '../../../domain/models/time-entry.model';
import { Project } from '../../../domain/models/project.model';
import { CalendarEvent } from '../../../domain/models/calendar-event.model';
import { ProjectPillsBarComponent } from '../../../shared/components/project-pills-bar/project-pills-bar.component';
import { DraftEntry, PopoverState, START_HOUR, END_HOUR, SNAP_MINUTES } from '../../../shared/models/calendar-view.models';
import { computeOverlapLayout, getEntryLeft as calcEntryLeft, getEntryWidth as calcEntryWidth } from '../../../shared/utils/overlap-layout';
import { snapToHalfHour, snapToGrid, hourToStr, formatTime } from '../../../shared/utils/time-helpers';
import { getEntryColor as calcEntryColor, getProject as calcProject } from '../../../shared/utils/entry-styling';

const HOUR_HEIGHT = 72;

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [DurationPipe, FormsModule, ProjectPillsBarComponent],
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
          <div class="text-xs text-gray-400 tabular-nums">{{ totalLabel() }}</div>
        </div>
        <button (click)="ui.navigateDay('next')" class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        <app-project-pills-bar class="ml-auto flex-1 min-w-0 max-w-md" />
        <div class="relative">
          <button (click)="confirmClear.set(true)"
            class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Tag leeren">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
          @if (confirmClear()) {
            <div class="fixed inset-0 z-30" (click)="confirmClear.set(false)"></div>
            <div class="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-40 animate-pop-in">
              <p class="text-xs text-gray-600 mb-2">Alle <strong>{{ dayEntryCount() }}</strong> Einträge dieses Tages löschen?</p>
              <div class="flex gap-2">
                <button (click)="confirmClear.set(false)"
                  class="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
                  Abbrechen
                </button>
                <button (click)="clearView()"
                  class="flex-1 px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors">
                  Löschen
                </button>
              </div>
            </div>
          }
        </div>
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

        <div class="flex-1 relative select-none" (mousedown)="onGridMouseDown($event)">
          @for (hour of hours; track hour) {
            <div class="border-b border-gray-100/50" [style.height.px]="hourHeight">
              <div class="border-b border-dashed border-gray-100/30 h-1/2"></div>
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
              class="absolute left-3 right-3 rounded-lg px-3 py-2 cursor-pointer z-[5]
                     bg-white border border-dashed border-gray-300 hover:border-indigo-400
                     hover:shadow-md transition-all group"
              [style.top.px]="getTopPosition(event.start)"
              [style.height.px]="getBlockHeight(event.start, event.end)"
              [style.min-height.px]="34"
              (mousedown)="$event.stopPropagation()"
              (click)="onGoogleEventClick($event, event)"
            >
              <div class="flex items-start gap-2">
                <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 mt-[1px] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <div class="min-w-0">
                  <div class="font-medium text-gray-500 group-hover:text-indigo-600 transition-colors">{{ event.title }}</div>
                  <div class="text-gray-400 text-xs tabular-nums">{{ formatTime(event.start) }}–{{ formatTime(event.end) }} · Importieren</div>
                </div>
              </div>
            </div>
          }

          @for (entry of entries(); track entry.id) {
            <div
              class="absolute rounded-lg cursor-pointer z-[6]
                     shadow-sm hover:shadow-lg transition-all group"
              [style.top.px]="getTopPosition(entry.start)"
              [style.height.px]="getBlockHeight(entry.start, entry.end)"
              [style.min-height.px]="34"
              [style.left]="getEntryLeft(entry.id)"
              [style.width]="getEntryWidth(entry.id)"
              [style.background-color]="getEntryColor(entry) + '15'"
              [style.border-left]="'4px solid ' + getEntryColor(entry)"
              [class.ring-2]="selectedEntryIds().has(entry.id)"
              [class.ring-indigo-400]="selectedEntryIds().has(entry.id)"
              (mousedown)="$event.stopPropagation()"
              (click)="onEntryClick($event, entry)"
            >
              <div class="px-3 py-2 h-full flex flex-col overflow-hidden">
                <div class="text-sm font-semibold" [style.color]="getEntryColor(entry)">{{ entry.title || 'Ohne Beschreibung' }}</div>
                <div class="text-xs tabular-nums mt-0.5" [style.color]="getEntryColor(entry)" style="opacity: 0.6">
                  {{ formatTime(entry.start) }}–{{ formatTime(entry.end) }} · {{ getDurationMinutes(entry) | duration }}
                </div>
                @if (getProject(entry); as p) {
                  <div class="text-[10px] font-bold mt-auto truncate uppercase tracking-wider" [style.color]="getEntryColor(entry)" style="opacity: 0.5">{{ p.name }}</div>
                }
              </div>
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
export class DayViewComponent {
  protected readonly ui = inject(UiStore);
  private readonly timeEntryStore = inject(TimeEntryStore);
  protected readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);

  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  readonly draftInput = viewChild<ElementRef>('draftInput');

  readonly hourHeight = HOUR_HEIGHT;
  readonly hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  draft = signal<DraftEntry | null>(null);
  popover = signal<PopoverState | null>(null);
  selectedEntryIds = signal<Set<string>>(new Set());
  confirmClear = signal(false);

  readonly dayEntryCount = computed(() => this.entries().length);

  readonly defaultProject = computed(() => {
    const id = this.ui.defaultProjectId();
    if (id) return this.projectStore.projectMap().get(id) ?? null;
    return this.projectStore.activeProjects()[0] ?? null;
  });

  private autoSelectEffect = effect(() => {
    if (!this.ui.defaultProjectId()) {
      const first = this.projectStore.activeProjects()[0];
      if (first) this.ui.setDefaultProject(first.id);
    }
  });

  readonly draftColor = computed(() => this.defaultProject()?.color ?? '#6366F1');

  readonly entryLayout = computed(() => {
    const result = new Map<string, { col: number; total: number }>();
    computeOverlapLayout(this.entries(), result);
    return result;
  });

  private resizeStartY = 0;
  private resizeStartEndHour = 0;

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

    const y = this.getYInGrid(event);
    const hour = snapToHalfHour(START_HOUR + y / HOUR_HEIGHT);

    this.draft.set({ date: this.ui.activeDate(), startHour: hour, endHour: hour + 0.5, title: '' });
    setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);

    const onMove = (e: MouseEvent) => {
      const curY = this.getYInGrid(e);
      const curHour = snapToGrid(START_HOUR + curY / HOUR_HEIGHT, SNAP_MINUTES);
      const d = this.draft()!;
      this.draft.set({ ...d, endHour: Math.min(Math.max(curHour, d.startHour + 0.25), END_HOUR) });
    };
    const onUp = () => {
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

  onResizeStart(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const ed = new Date(entry.end);
    this.resizeStartEndHour = ed.getHours() + ed.getMinutes() / 60;
    const onMove = (e: MouseEvent) => {
      const sd = new Date(entry.start);
      const startH = sd.getHours() + sd.getMinutes() / 60;
      const newEnd = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / HOUR_HEIGHT, SNAP_MINUTES);
      const clamped = Math.max(newEnd, startH + 0.25);
      const ne = new Date(entry.end); ne.setHours(Math.floor(clamped), (clamped % 1) * 60, 0, 0);
      this.timeEntryStore.updateEntry(entry.id, { end: ne });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

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

  onGoogleEventClick(event: MouseEvent, calEvent: CalendarEvent) {
    event.stopPropagation();
    this.timeEntryStore.addEntry({ title: calEvent.title, start: calEvent.start, end: calEvent.end, projectId: this.ui.defaultProjectId() ?? undefined, source: 'google', googleEventId: calEvent.id });
  }

  getDurationMinutes(entry: TimeEntry) { return (new Date(entry.end).getTime() - new Date(entry.start).getTime()) / 60000; }
  getTopPosition(start: Date) { const d = new Date(start); return (d.getHours() + d.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT; }
  getBlockHeight(start: Date, end: Date) { return Math.max((new Date(end).getTime() - new Date(start).getTime()) / 3600000 * HOUR_HEIGHT, 34); }
  getEntryColor(entry: TimeEntry) { return calcEntryColor(entry, this.projectStore.projectMap()); }
  getProject(entry: TimeEntry): Project | null { return calcProject(entry, this.projectStore.projectMap()); }
  formatTime = formatTime;

  clearView() {
    for (const entry of this.entries()) {
      this.timeEntryStore.removeEntry(entry.id);
    }
    this.confirmClear.set(false);
  }

  getEntryLeft(entryId: string): string {
    return calcEntryLeft(this.entryLayout(), entryId, 12);
  }

  getEntryWidth(entryId: string): string {
    return calcEntryWidth(this.entryLayout(), entryId, 24, 2);
  }

}
