import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { UiStore } from './state/ui.store';
import { CalendarStore } from './state/calendar.store';
import { TimeEntryStore } from './state/time-entry.store';
import { WeekNavigatorComponent } from './shared/components/week-navigator/week-navigator.component';
import { TimeEntryModalComponent } from './features/time-entry/time-entry-modal/time-entry-modal.component';
import { ExportPanelComponent } from './features/export/export-panel/export-panel.component';
import { ErrorToastComponent } from './shared/components/error-toast/error-toast.component';
import { UndoToastComponent } from './shared/components/undo-toast/undo-toast.component';
import { ImportWizardComponent } from './features/calendar/import-wizard/import-wizard.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    WeekNavigatorComponent, TimeEntryModalComponent, ExportPanelComponent, ErrorToastComponent, UndoToastComponent, ImportWizardComponent,
  ],
  template: `
    <!-- Top navigation bar -->
    <nav class="h-14 bg-gray-900 text-gray-300 flex items-center justify-between px-5 z-30 relative">
      <div class="flex items-center gap-5">
        <!-- Logo -->
        <div class="flex items-center gap-2 text-white">
          <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm font-semibold tracking-tight">Timebooking</span>
        </div>

        <!-- Nav links -->
        <div class="flex items-center gap-0.5">
          <a routerLink="/calendar" routerLinkActive="!text-white !bg-gray-800"
             class="px-3 py-1.5 rounded-md text-xs font-medium hover:text-white hover:bg-gray-800 transition-colors">
            Kalender
          </a>
          <a routerLink="/projects" routerLinkActive="!text-white !bg-gray-800"
             class="px-3 py-1.5 rounded-md text-xs font-medium hover:text-white hover:bg-gray-800 transition-colors">
            Projekte
          </a>
          <a routerLink="/statistics" routerLinkActive="!text-white !bg-gray-800"
             class="px-3 py-1.5 rounded-md text-xs font-medium hover:text-white hover:bg-gray-800 transition-colors">
            Statistik
          </a>
          <a routerLink="/rules" routerLinkActive="!text-white !bg-gray-800"
             class="px-3 py-1.5 rounded-md text-xs font-medium hover:text-white hover:bg-gray-800 transition-colors">
            Zuordnung
          </a>
        </div>
      </div>

      <!-- Center: Week navigator (calendar only) -->
      @if (isCalendarRoute()) {
        <app-week-navigator />
      }

      <!-- Right side -->
      <div class="flex items-center gap-1.5">
        @if (isCalendarRoute()) {
          <!-- View toggle -->
          <div class="flex bg-gray-800 rounded-md p-0.5">
            <button
              (click)="ui.setView('week')"
              class="px-2.5 py-1 text-xs font-medium rounded transition-colors"
              [class.bg-gray-600]="ui.activeView() === 'week'"
              [class.text-white]="ui.activeView() === 'week'"
            >
              Woche
            </button>
            <button
              (click)="ui.setView('day')"
              class="px-2.5 py-1 text-xs font-medium rounded transition-colors"
              [class.bg-gray-600]="ui.activeView() === 'day'"
              [class.text-white]="ui.activeView() === 'day'"
            >
              Tag
            </button>
          </div>

          <!-- Total hours badge -->
          <div class="px-2.5 py-1.5 bg-gray-800 rounded-md text-xs font-medium text-gray-400 tabular-nums">
            {{ timeEntryStore.totalHours().toFixed(1) }}h
          </div>

          <!-- Fill gaps -->
          <button
            (click)="fillGaps()"
            class="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 rounded-md text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            title="Zeiten auf Viertelstunde snappen und kleine Lücken schließen"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 3-6 3m12-6l-6 3 6 3"/>
            </svg>
            Lücken füllen
          </button>

          <!-- Highlight gaps toggle -->
          <button
            (click)="ui.toggleHighlightGaps()"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
            [class.bg-amber-500/20]="ui.highlightGaps()"
            [class.text-amber-400]="ui.highlightGaps()"
            [class.hover:bg-amber-500/30]="ui.highlightGaps()"
            [class.bg-gray-800]="!ui.highlightGaps()"
            [class.text-gray-300]="!ui.highlightGaps()"
            [class.hover:bg-gray-700]="!ui.highlightGaps()"
            [class.hover:text-white]="!ui.highlightGaps()"
            title="Lücken zwischen Terminen hervorheben (15+ Min, 8–18 Uhr)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            Gaps
          </button>
        }

        <!-- Google Calendar status -->
        <div class="relative flex items-center gap-2">
          @if (calendarStore.authenticated()) {
            <button
              (click)="refreshCalendar()"
              class="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 rounded-md text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              title="Google Kalender synchronisieren"
            >
              <svg class="w-3.5 h-3.5" [class.animate-spin]="calendarStore.loading()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Sync
            </button>
            <button
              (click)="showImportWizard.set(true)"
              class="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 rounded-md text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              title="Termine per Wizard importieren"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Wizard
            </button>
          }
          <button
            (click)="onGoogleConnect()"
            class="p-1.5 rounded-md hover:bg-gray-800 transition-colors"
            [class.text-emerald-400]="calendarStore.authenticated()"
            [class.text-amber-400]="!calendarStore.authenticated()"
            (mouseenter)="showGoogleTooltip.set(true)"
            (mouseleave)="showGoogleTooltip.set(false)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </button>
          @if (showGoogleTooltip()) {
            <div class="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-950 text-gray-300 text-xs rounded-lg shadow-xl border border-gray-800 z-50">
              @if (calendarStore.authenticated()) {
                <span class="text-emerald-400">Google Calendar verbunden</span>
              } @else if (backendUnavailable()) {
                <div class="font-medium text-amber-400 mb-1">Backend nicht erreichbar</div>
                <div>Starte mit ./start.sh für Google Calendar Import, oder nutze die App im Lokal-Modus für manuelle Zeiterfassung.</div>
              } @else {
                <div class="font-medium text-white mb-1">Google Calendar nicht verbunden</div>
                <div>Klicken, um Google Calendar zu verbinden und Termine zu importieren.</div>
              }
            </div>
          }
        </div>

        <!-- Export -->
        <button
          (click)="ui.toggleExportPanel()"
          class="p-1.5 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </button>

        <!-- New entry -->
        <button
          (click)="ui.openNewEntryModal()"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium
                 rounded-md hover:bg-indigo-400 transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Neu
        </button>
      </div>
    </nav>

    <!-- Main content -->
    <main class="flex-1 bg-gray-100 overflow-hidden">
      <router-outlet />
    </main>

    <!-- Modals & Panels -->
    <app-time-entry-modal />
    <app-export-panel />
    <app-error-toast />
    <app-undo-toast />
    @if (showImportWizard()) {
      <app-import-wizard (closed)="showImportWizard.set(false)" />
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
  `],
})
export class App {
  protected readonly ui = inject(UiStore);
  protected readonly calendarStore = inject(CalendarStore);
  protected readonly timeEntryStore = inject(TimeEntryStore);
  private readonly router = inject(Router);

  protected readonly isCalendarRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.startsWith('/calendar')),
    ),
    { initialValue: true },
  );

  readonly googleEnabled = environment.googleCalendarEnabled;
  showGoogleTooltip = signal(false);
  showImportWizard = signal(false);
  backendUnavailable = signal(!environment.googleCalendarEnabled);

  constructor() {
    if (this.googleEnabled) {
      this.calendarStore.checkAuth();
      setTimeout(() => {
        if (!this.calendarStore.authenticated()) {
          fetch(environment.backendUrl + '/health')
            .then(() => this.backendUnavailable.set(false))
            .catch(() => this.backendUnavailable.set(true));
        }
      }, 2000);
    }
  }

  refreshCalendar() {
    this.timeEntryStore.clearDismissedGoogleEventIds();
    this.calendarStore.fetchEvents(this.ui.weekStart(), this.ui.weekEnd());
  }

  fillGaps() {
    this.timeEntryStore.fillGaps();
  }

  onGoogleConnect() {
    if (!this.googleEnabled) return;
    if (this.calendarStore.authenticated()) return;
    if (this.backendUnavailable()) return;
    this.calendarStore.getAuthUrl((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' && parsed.hostname === 'accounts.google.com') {
          window.location.href = url;
        }
      } catch {
        console.error('Invalid auth URL received from backend');
      }
    });
  }
}
