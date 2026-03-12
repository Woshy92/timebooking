import { Component, inject, computed, ElementRef, viewChild, afterNextRender, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ProjectStore } from '../../../state/project.store';
import { CalendarStore } from '../../../state/calendar.store';
import { UiStore } from '../../../state/ui.store';
import { UndoStore } from '../../../state/undo.store';
import { VacationStore } from '../../../state/vacation.store';
import { format, eachDayOfInterval, isSameDay, startOfDay, isWeekend } from 'date-fns';
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
import { getEntryColor as calcEntryColor, getEntryBg as calcEntryBg, getEntryTextColor as calcEntryTextColor } from '../../../shared/utils/entry-styling';
import { startAutoScroll } from '../../../shared/utils/auto-scroll';
import { findGapSuggestions, GapSuggestion } from '../../../shared/utils/gap-filler';
import { CalendarInteractionService } from '../../../shared/services/calendar-interaction.service';

const HOUR_HEIGHT = 64;
const MIN_BLOCK_HEIGHT = 26;

@Component({
  selector: 'app-week-view',
  standalone: true,
  imports: [FormsModule, ProjectPillsBarComponent, ClearConfirmPopoverComponent, ProjectPopoverComponent, RecurringConfirmComponent],
  template: `
    <div class="flex flex-col h-full bg-white">
      <!-- Default project bar -->
      <div class="flex items-center gap-3 px-4 py-1.5 border-b border-gray-100 bg-gray-50/40">
        <app-project-pills-bar class="flex-1 min-w-0" />
        <div class="ml-auto flex items-center gap-0.5 text-[11px] text-gray-400 tabular-nums select-none">
          <button (click)="uiStore.setViewStartHour(uiStore.viewStartHour() - 1)"
            class="p-0.5 rounded hover:bg-gray-200 hover:text-gray-600 transition-colors"
            title="Früherer Start">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button (click)="uiStore.setViewStartHour(uiStore.viewStartHour() + 1)"
            class="px-1 py-0.5 rounded hover:bg-gray-200 hover:text-gray-600 font-medium transition-colors">
            {{ uiStore.viewStartHour() }}
          </button>
          <span class="text-gray-300">–</span>
          <button (click)="uiStore.setViewEndHour(uiStore.viewEndHour() - 1)"
            class="px-1 py-0.5 rounded hover:bg-gray-200 hover:text-gray-600 font-medium transition-colors">
            {{ uiStore.viewEndHour() }}
          </button>
          <button (click)="uiStore.setViewEndHour(uiStore.viewEndHour() + 1)"
            class="p-0.5 rounded hover:bg-gray-200 hover:text-gray-600 transition-colors"
            title="Späteres Ende">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
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
      <div class="flex flex-1 overflow-x-hidden overflow-y-auto"
           #scrollContainer>
        <!-- Hour gutter -->
        <div class="w-[52px] flex-shrink-0 border-r border-gray-100 bg-gray-50/30">
          @for (hour of hours(); track hour) {
            <div class="relative" [style.height.px]="hourHeight">
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
            @for (hour of hours(); track hour) {
              <div class="border-b border-gray-100/50" [style.height.px]="hourHeight">
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
                      <div class="font-medium text-amber-600 group-hover:text-amber-700 truncate flex-shrink-0 transition-colors">{{ interaction.getGapMinutes(gap) }} Min</div>
                      <div class="text-amber-400 text-[10px] tabular-nums flex-shrink overflow-hidden leading-tight">{{ formatTime(gap.start) }}–{{ formatTime(gap.end) }}</div>
                    </div>
                    <button
                      class="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-medium
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
                (click)="interaction.onGoogleEventClick($event, event)"
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
                    (click)="interaction.dismissGoogleEvent($event, event.id)"
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
              @if (entry.pause) {
                <!-- Pause block -->
                <div
                  class="absolute rounded-md cursor-pointer z-[5] border border-dashed border-gray-300
                         hover:border-gray-400 transition-all group"
                  style="background: repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(156,163,175,0.08) 4px, rgba(156,163,175,0.08) 8px)"
                  [style.top.px]="getTopPosition(interaction.getEffectiveStart(entry))"
                  [style.height.px]="getBlockHeight(interaction.getEffectiveStart(entry), interaction.getEffectiveEnd(entry))"
                  [style.min-height.px]="26"
                  [style.left]="getEntryLeft(entry.id)"
                  [style.width]="getEntryWidth(entry.id)"
                  [class.ring-2]="interaction.selectedEntryIds().has(entry.id)"
                  [class.ring-gray-400]="interaction.selectedEntryIds().has(entry.id)"
                  [class.opacity-60]="interaction.dragOverride()?.entryId === entry.id"
                  [class.!z-50]="interaction.dragOverride()?.entryId === entry.id"
                  (mousedown)="onEntryMouseDown($event, entry, dayIdx)"
                  (click)="interaction.onEntryClick($event, entry)"
                  (dblclick)="interaction.onEntryDblClick($event, entry)"
                >
                  <div class="px-2 py-1 h-full flex flex-col overflow-hidden">
                    <div class="flex items-center gap-1 flex-shrink-0 text-gray-400">
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
                      </svg>
                      <div class="text-[11px] font-medium truncate">Pause</div>
                    </div>
                    <div class="text-[10px] tabular-nums text-gray-400 flex-shrink overflow-hidden leading-tight" style="opacity: 0.7">
                      {{ formatTime(interaction.getEffectiveStart(entry)) }}–{{ formatTime(interaction.getEffectiveEnd(entry)) }}
                    </div>
                  </div>
                  <!-- Top resize handle -->
                  <div
                    class="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    style="background: linear-gradient(rgba(156,163,175,0.3), transparent)"
                    (mousedown)="onResizeTopStart($event, entry)"
                  >
                    <div class="absolute top-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full bg-gray-400" style="opacity: 0.5"></div>
                  </div>
                  <!-- Bottom resize handle -->
                  <div
                    class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    style="background: linear-gradient(transparent, rgba(156,163,175,0.3))"
                    (mousedown)="onResizeStart($event, entry)"
                  >
                    <div class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full bg-gray-400" style="opacity: 0.5"></div>
                  </div>
                </div>
              } @else {
                <!-- Regular entry block -->
                <div
                  class="absolute rounded-md cursor-pointer z-[6]
                         shadow-sm hover:shadow-lg transition-all group"
                  [style.top.px]="getTopPosition(interaction.getEffectiveStart(entry))"
                  [style.height.px]="getBlockHeight(interaction.getEffectiveStart(entry), interaction.getEffectiveEnd(entry))"
                  [style.min-height.px]="26"
                  [style.left]="getEntryLeft(entry.id)"
                  [style.width]="getEntryWidth(entry.id)"
                  [style.background-color]="getEntryBg(entry)"
                  [style.border-left]="'3px solid ' + interaction.getEntryColor(entry)"
                  [class.ring-2]="interaction.selectedEntryIds().has(entry.id)"
                  [class.ring-indigo-400]="interaction.selectedEntryIds().has(entry.id)"
                  [class.opacity-60]="interaction.dragOverride()?.entryId === entry.id"
                  [class.shadow-xl]="interaction.dragOverride()?.entryId === entry.id"
                  [class.!z-50]="interaction.dragOverride()?.entryId === entry.id"
                  (mousedown)="onEntryMouseDown($event, entry, dayIdx)"
                  (click)="interaction.onEntryClick($event, entry)"
                  (dblclick)="interaction.onEntryDblClick($event, entry)"
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
                    <div class="text-[10px] tabular-nums flex-shrink overflow-hidden leading-tight" [style.color]="interaction.getEntryColor(entry)" style="opacity: 0.7">
                      {{ formatTime(interaction.getEffectiveStart(entry)) }}–{{ formatTime(interaction.getEffectiveEnd(entry)) }}
                    </div>
                    @if (interaction.getProject(entry); as p) {
                      <div class="text-[9px] font-semibold mt-auto truncate uppercase tracking-wide flex-shrink overflow-hidden" [style.color]="interaction.getEntryColor(entry)" style="opacity: 0.6">{{ getDisplayName(p) }}</div>
                    }
                  </div>
                  <!-- Top resize handle -->
                  <div
                    class="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    [style.background]="'linear-gradient(' + interaction.getEntryColor(entry) + '30, transparent)'"
                    (mousedown)="onResizeTopStart($event, entry)"
                  >
                    <div class="absolute top-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="interaction.getEntryColor(entry)" style="opacity: 0.5"></div>
                  </div>
                  <!-- Bottom resize handle -->
                  <div
                    class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    [style.background]="'linear-gradient(transparent, ' + interaction.getEntryColor(entry) + '30)'"
                    (mousedown)="onResizeStart($event, entry)"
                  >
                    <div class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="interaction.getEntryColor(entry)" style="opacity: 0.5"></div>
                  </div>
                </div>
              }
            }

            <!-- Draft block -->
            @if (interaction.draft() && isDraftOnDay(day.date)) {
              <div
                class="absolute left-1.5 right-1.5 rounded-md z-30 border-2 border-dashed"
                [style.top.px]="interaction.getDraftTop(viewStart(), hourHeight)"
                [style.height.px]="interaction.getDraftHeight(hourHeight, 26)"
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
                    [ngModel]="interaction.draft()!.title"
                    (ngModelChange)="interaction.updateDraftTitle($event)"
                    (keydown.enter)="interaction.saveDraft(hourHeight)"
                    (keydown.escape)="interaction.cancelDraft()"
                  />
                  <div class="text-[10px] tabular-nums mt-auto" [style.color]="draftColor()" style="opacity: 0.5">
                    {{ interaction.formatDraftTime() }}
                  </div>
                </div>
                <div class="absolute top-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="interaction.onDraftResizeTopStart($event, hourHeight, viewStart())">
                  <div class="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
                </div>
                <div class="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize" (mousedown)="interaction.onDraftResizeStart($event, hourHeight)">
                  <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full" [style.background-color]="draftColor()" style="opacity: 0.3"></div>
                </div>
              </div>
            }
          </div>
        }
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
export class WeekViewComponent {
  private readonly timeEntryStore = inject(TimeEntryStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly calendarStore = inject(CalendarStore);
  protected readonly uiStore = inject(UiStore);
  private readonly undoStore = inject(UndoStore);
  protected readonly vacationStore = inject(VacationStore);
  protected readonly interaction = inject(CalendarInteractionService);

  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  readonly draftInput = viewChild<ElementRef>('draftInput');

  readonly viewStart = computed(() => this.uiStore.viewStartHour());
  private readonly viewEnd = computed(() => this.uiStore.viewEndHour());
  readonly hours = computed(() =>
    Array.from({ length: this.viewEnd() - this.viewStart() }, (_, i) => this.viewStart() + i)
  );
  readonly hourHeight = HOUR_HEIGHT;

  readonly defaultProject = computed(() => {
    const id = this.uiStore.defaultProjectId();
    if (id) return this.projectStore.projectMap().get(id) ?? null;
    return this.projectStore.activeProjects()[0] ?? null;
  });

  readonly draftColor = computed(() => this.defaultProject()?.color ?? '#6366F1');

  constructor() {
    afterNextRender(() => {
      const container = this.scrollContainer()?.nativeElement;
      if (!container) return;
      const scrollTo = (8 - this.viewStart()) * HOUR_HEIGHT;
      if (scrollTo > 0) container.scrollTop = scrollTo;
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.interaction.popover()) this.interaction.closePopover();
    else if (this.interaction.draft()) this.interaction.cancelDraft();
  }

  readonly nowPosition = computed(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60 - this.viewStart()) * HOUR_HEIGHT;
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
      const totalHours = dayEntries.filter(e => !e.pause).reduce(
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
    const ids = this.interaction.selectedEntryIds();
    if (ids.size === 0) return null;
    const entries = this.timeEntryStore.entries().filter(e => ids.has(e.id));
    if (entries.length === 0) return null;
    const first = entries[0].projectId;
    return entries.every(e => e.projectId === first) ? first : null;
  });

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

    if (this.interaction.popover()) { this.interaction.closePopover(); return; }
    if (this.interaction.draft()?.title?.trim()) { this.interaction.saveDraft(HOUR_HEIGHT); }

    const y = this.getYInColumn(event);
    const hour = snapToHalfHour(this.viewStart() + y / HOUR_HEIGHT);

    this.interaction.draft.set({ date, startHour: hour, endHour: hour + 0.5, title: '' });
    setTimeout(() => this.draftInput()?.nativeElement?.focus(), 0);

    let lastClientY = event.clientY;
    const container = this.scrollContainer()?.nativeElement;
    const stopScroll = container ? startAutoScroll(container, () => lastClientY) : null;

    const onMove = (e: MouseEvent) => {
      lastClientY = e.clientY;
      const currentY = this.getYInColumn(e);
      const currentHour = snapToGrid(this.viewStart() + currentY / HOUR_HEIGHT, SNAP_MINUTES);
      const d = this.interaction.draft();
      if (d) {
        const newEnd = Math.max(currentHour, d.startHour + 0.25);
        this.interaction.draft.set({ ...d, endHour: Math.min(newEnd, this.viewEnd()) });
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

  // ─── Entry drag (multi-day) ──────────────────────────────
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
    const clickOffsetHour = (this.viewStart() + yInColumn / HOUR_HEIGHT) - startHour;

    const dayColumns = this.getDayColumnRects();
    let currentDayIdx = dayIdx;

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

      currentDayIdx = this.getDayIdxFromX(e.clientX, dayColumns, currentDayIdx);
      const targetDate = this.days()[currentDayIdx].date;

      const yInCol = this.getYInColumn(e);
      const rawHour = this.viewStart() + yInCol / HOUR_HEIGHT - clickOffsetHour;
      const snappedHour = snapToGrid(rawHour, SNAP_MINUTES);
      const clampedHour = Math.max(this.viewStart(), Math.min(snappedHour, this.viewEnd() - durationMs / 3600000));

      const newStart = new Date(targetDate);
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
  isDraftOnDay(date: Date): boolean { return !!this.interaction.draft() && isSameDay(this.interaction.draft()!.date, date); }

  // ─── Delegated methods with view-specific params ────
  onResizeTopStart(event: MouseEvent, entry: TimeEntry) {
    this.interaction.onResizeTopStart(event, entry, HOUR_HEIGHT, this.viewStart(), this.scrollContainer()?.nativeElement ?? null);
  }

  onResizeStart(event: MouseEvent, entry: TimeEntry) {
    this.interaction.onResizeStart(event, entry, HOUR_HEIGHT, this.scrollContainer()?.nativeElement ?? null);
  }

  onGapClick(gap: GapSuggestion) {
    this.interaction.onGapClick(gap, new Date(gap.start), () => this.draftInput()?.nativeElement?.focus());
  }

  // ─── Positioning & Styling ─────────────────────────────
  getTopPosition(start: Date): number { return this.interaction.getTopPosition(start, this.viewStart(), HOUR_HEIGHT); }
  getBlockHeight(start: Date, end: Date): number { return this.interaction.getBlockHeight(start, end, HOUR_HEIGHT, MIN_BLOCK_HEIGHT); }
  getEntryBg(entry: TimeEntry): string { return calcEntryBg(entry, this.projectStore.projectMap()); }
  getEntryTextColor(entry: TimeEntry): string { return calcEntryTextColor(entry, this.projectStore.projectMap()); }
  getDisplayName = getProjectDisplayName;
  formatTime = formatTime;

  readonly weekEntryCount = computed(() =>
    this.days().reduce((sum, day) => sum + day.entries.length, 0)
  );

  readonly weekGoogleEventCount = computed(() =>
    this.days().reduce((sum, day) => sum + day.googleEvents.length, 0)
  );

  readonly weekProjectSummary = computed(() => {
    const entries = this.days().flatMap(d => d.entries).filter(e => !e.pause);
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

  readonly entryTimeLabel = computed(() => {
    const ids = this.interaction.selectedEntryIds();
    if (ids.size !== 1) return '';
    const entry = this.timeEntryStore.entries().find(e => ids.has(e.id));
    if (!entry) return '';
    return `${formatTime(entry.start)}–${formatTime(entry.end)}`;
  });

  readonly dayProjectSummary = computed(() => {
    const projectMap = this.projectStore.projectMap();
    const result = new Map<string, { pid: string; name: string; color: string; hours: number }[]>();

    for (const day of this.days()) {
      const workEntries = day.entries.filter(e => !e.pause);
      if (workEntries.length === 0) continue;
      const hoursByProject = new Map<string, number>();
      for (const e of workEntries) {
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
    this.interaction.dismissEmptyDraft();
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
    this.interaction.dismissEmptyDraft();
    if (!day.isVacation && day.entries.length > 0) {
      this.undoStore.pushDelete(day.entries);
      this.timeEntryStore.removeEntries(day.entries.map(e => e.id));
    }
    this.vacationStore.toggleDay(day.date);
  }
}
