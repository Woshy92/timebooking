import { Injectable, inject, signal } from '@angular/core';
import { TimeEntryStore } from '../../state/time-entry.store';
import { ProjectStore } from '../../state/project.store';
import { CalendarStore } from '../../state/calendar.store';
import { UiStore } from '../../state/ui.store';
import { CalendarSyncService } from '../../application/calendar-sync.service';
import { UndoStore } from '../../state/undo.store';
import { TimeEntry } from '../../domain/models/time-entry.model';
import { Project, getProjectDisplayName } from '../../domain/models/project.model';
import { CalendarEvent } from '../../domain/models/calendar-event.model';
import { DraftEntry, PopoverState, DragOverride, RecurringConfirmState, SNAP_MINUTES } from '../models/calendar-view.models';
import { snapToGrid, hourToStr, formatTime } from '../utils/time-helpers';
import { getEntryColor as calcEntryColor, getProject as calcProject } from '../utils/entry-styling';
import { GapSuggestion } from '../utils/gap-filler';
import { startAutoScroll } from '../utils/auto-scroll';

@Injectable({ providedIn: 'root' })
export class CalendarInteractionService {
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  readonly calendarStore = inject(CalendarStore);
  private readonly calendarSyncService = inject(CalendarSyncService);
  private readonly undoStore = inject(UndoStore);
  private readonly ui = inject(UiStore);

  // ─── Shared signals ─────────────────────────────────
  draft = signal<DraftEntry | null>(null);
  popover = signal<PopoverState | null>(null);
  selectedEntryIds = signal<Set<string>>(new Set());
  recurringConfirm = signal<RecurringConfirmState | null>(null);

  resizeOverride = signal<{ entryId: string; end: Date } | null>(null);
  resizeTopOverride = signal<{ entryId: string; start: Date } | null>(null);
  dragOverride = signal<DragOverride | null>(null);

  private resizeStartY = 0;
  private resizeStartEndHour = 0;
  private resizeStartStartHour = 0;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  private dragging = false;

  // ─── Draft methods ──────────────────────────────────
  dismissEmptyDraft() {
    if (this.draft() && !this.draft()!.title?.trim()) {
      this.draft.set(null);
    }
  }

  saveDraft(hourHeight: number) {
    const d = this.draft(); if (!d) return;
    const start = new Date(d.date); start.setHours(Math.floor(d.startHour), (d.startHour % 1) * 60, 0, 0);
    const end = new Date(d.date); end.setHours(Math.floor(d.endHour), (d.endHour % 1) * 60, 0, 0);
    const projectId = this.ui.defaultProjectId() ?? undefined;
    this.timeEntryStore.addEntry({ title: d.title || 'Ohne Beschreibung', start, end, source: 'manual', projectId });
    this.draft.set(null);
  }

  cancelDraft() { this.draft.set(null); }

  getDraftTop(viewStart: number, hourHeight: number): number {
    return (this.draft()!.startHour - viewStart) * hourHeight;
  }

  getDraftHeight(hourHeight: number, minHeight: number): number {
    const d = this.draft()!;
    return Math.max((d.endHour - d.startHour) * hourHeight, minHeight);
  }

  formatDraftTime(): string {
    const d = this.draft()!;
    return `${hourToStr(d.startHour)}–${hourToStr(d.endHour)}`;
  }

  updateDraftTitle(title: string) {
    const d = this.draft();
    if (d) this.draft.set({ ...d, title });
  }

  // ─── Draft resize ───────────────────────────────────
  onDraftResizeTopStart(event: MouseEvent, hourHeight: number, viewStart: number) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const startStartHour = this.draft()!.startHour;
    const onMove = (e: MouseEvent) => {
      const d = this.draft()!;
      const newStart = snapToGrid(startStartHour + (e.clientY - this.resizeStartY) / hourHeight, SNAP_MINUTES);
      this.draft.set({ ...d, startHour: Math.min(Math.max(newStart, viewStart), d.endHour - 0.25) });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  onDraftResizeStart(event: MouseEvent, hourHeight: number) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    this.resizeStartEndHour = this.draft()!.endHour;
    const onMove = (e: MouseEvent) => {
      const d = this.draft()!;
      const newEnd = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / hourHeight, SNAP_MINUTES);
      this.draft.set({ ...d, endHour: Math.max(newEnd, d.startHour + 0.25) });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  // ─── Entry resize ───────────────────────────────────
  onResizeTopStart(event: MouseEvent, entry: TimeEntry, hourHeight: number, viewStart: number, scrollContainer: HTMLElement | null) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const startDate = new Date(entry.start);
    this.resizeStartStartHour = startDate.getHours() + startDate.getMinutes() / 60;
    let lastClientY = event.clientY;
    const stopScroll = scrollContainer ? startAutoScroll(scrollContainer, () => lastClientY) : null;
    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const endDate = new Date(entry.end);
      const endHour = endDate.getHours() + endDate.getMinutes() / 60;
      const newStartHour = snapToGrid(this.resizeStartStartHour + (e.clientY - this.resizeStartY) / hourHeight, SNAP_MINUTES);
      const clampedStart = Math.min(Math.max(newStartHour, viewStart), endHour - 0.25);
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

  onResizeStart(event: MouseEvent, entry: TimeEntry, hourHeight: number, scrollContainer: HTMLElement | null) {
    event.stopPropagation(); event.preventDefault();
    this.resizeStartY = event.clientY;
    const ed = new Date(entry.end);
    this.resizeStartEndHour = ed.getHours() + ed.getMinutes() / 60;
    let lastClientY = event.clientY;
    const stopScroll = scrollContainer ? startAutoScroll(scrollContainer, () => lastClientY) : null;
    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const sd = new Date(entry.start);
      const startH = sd.getHours() + sd.getMinutes() / 60;
      const newEnd = snapToGrid(this.resizeStartEndHour + (e.clientY - this.resizeStartY) / hourHeight, SNAP_MINUTES);
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

  // ─── Entry click/select ─────────────────────────────
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

  onEntryDblClick(event: MouseEvent, entry: TimeEntry) {
    event.stopPropagation();
    if (this.dragging) return;
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
    this.dismissEmptyDraft();
    this.closePopover();
    this.ui.selectEntry(entry.id);
  }

  // ─── Google events ──────────────────────────────────
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

  // ─── Gap suggestions ───────────────────────────────
  onGapClick(gap: GapSuggestion, date: Date, focusDraftInput: () => void) {
    if (this.draft()?.title?.trim()) { this.saveDraft(0); }
    const start = new Date(gap.start);
    const end = new Date(gap.end);
    this.draft.set({
      date,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
      title: '',
    });
    setTimeout(focusDraftInput, 0);
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

  // ─── Project assignment ─────────────────────────────
  assignProject(projectId: string | undefined) {
    const entries = this.timeEntryStore.entries().filter(e => this.selectedEntryIds().has(e.id));
    for (const entryId of this.selectedEntryIds()) {
      this.timeEntryStore.assignProject(entryId, projectId);
    }
    if (projectId) {
      const recurringEntry = entries.find(e => e.recurringEventId);
      if (recurringEntry?.recurringEventId) {
        const project = this.projectStore.projectMap().get(projectId);
        this.recurringConfirm.set({
          recurringEventId: recurringEntry.recurringEventId,
          projectId,
          projectName: project ? getProjectDisplayName(project) : projectId,
          projectColor: project?.color ?? '#6366F1',
        });
      }
    }
    this.closePopover();
  }

  confirmRecurringProject() {
    const rc = this.recurringConfirm();
    if (rc) {
      this.timeEntryStore.setRecurringProjectMapping(rc.recurringEventId, rc.projectId);
    }
    this.recurringConfirm.set(null);
  }

  dismissRecurringConfirm() {
    this.recurringConfirm.set(null);
  }

  // ─── Entry actions ──────────────────────────────────
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

  // ─── Positioning & styling ──────────────────────────
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

  getTopPosition(start: Date, viewStart: number, hourHeight: number): number {
    const d = new Date(start);
    return (d.getHours() + d.getMinutes() / 60 - viewStart) * hourHeight;
  }

  getBlockHeight(start: Date, end: Date, hourHeight: number, minHeight: number): number {
    return Math.max((new Date(end).getTime() - new Date(start).getTime()) / 3600000 * hourHeight, minHeight);
  }

  getEntryColor(entry: TimeEntry): string {
    return calcEntryColor(entry, this.projectStore.projectMap());
  }

  getProject(entry: TimeEntry): Project | null {
    return calcProject(entry, this.projectStore.projectMap());
  }

  getGapMinutes(gap: GapSuggestion): number {
    return Math.round((new Date(gap.end).getTime() - new Date(gap.start).getTime()) / 60000);
  }

  formatTime = formatTime;
  getDisplayName = getProjectDisplayName;

  // ─── Drag helpers (used by onEntryMouseDown in views) ──
  get isDragging() { return this.dragging; }
  set isDragging(v: boolean) { this.dragging = v; }

  clearClickTimer() {
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
  }
}
