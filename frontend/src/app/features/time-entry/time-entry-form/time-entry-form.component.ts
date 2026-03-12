import { Component, computed, inject, input, output, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectStore } from '../../../state/project.store';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../../../domain/models/time-entry.model';
import { getProjectDisplayName } from '../../../domain/models/project.model';
import { format } from 'date-fns';

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}

interface AttendeeInfo {
  email: string;
  initials: string;
}

function parseAttendee(raw: string): AttendeeInfo {
  const email = raw;
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : local.substring(0, 2).toUpperCase();
  return { email, initials };
}

const MAX_VISIBLE_ATTENDEES = 3;

@Component({
  selector: 'app-time-entry-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
      @if (entry()?.source === 'google') {
        <div class="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 rounded-lg border border-blue-100">
          <svg class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-medium text-blue-700">Importiert aus Google Calendar</div>
          </div>
        </div>
      }

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
        <input
          formControlName="title"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          placeholder="Beschreibung der Tätigkeit"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Datum</label>
          <input
            formControlName="date"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
        <div class="relative">
          <label class="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
          <button
            type="button"
            (click)="projectDropdownOpen.set(!projectDropdownOpen())"
            class="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
          >
            @if (selectedProject()) {
              <div class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="selectedProject()!.color"></div>
              <span class="text-gray-900 truncate">{{ getDisplayName(selectedProject()!) }}</span>
            } @else {
              <span class="text-gray-400">Projekt wählen</span>
            }
            <svg class="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          @if (projectDropdownOpen()) {
            <div class="fixed inset-0 z-40" (click)="projectDropdownOpen.set(false)"></div>
            <div class="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-48 overflow-y-auto">
              @for (project of projectStore.activeProjects(); track project.id) {
                <button
                  type="button"
                  (click)="selectProject(project.id)"
                  class="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                  [class.bg-indigo-50]="form.value.projectId === project.id"
                  [class.font-semibold]="form.value.projectId === project.id"
                >
                  <div class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
                  <span class="text-gray-800 truncate">{{ getDisplayName(project) }}</span>
                  @if (form.value.projectId === project.id) {
                    <svg class="w-3.5 h-3.5 text-indigo-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                  }
                </button>
              }
            </div>
          }
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Von</label>
          <input
            formControlName="startTime"
            type="time"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Bis</label>
          <input
            formControlName="endTime"
            type="time"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
        <textarea
          formControlName="notes"
          rows="2"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
          placeholder="Optionale Notizen..."
        ></textarea>
      </div>

      @if (attendees().length) {
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Teilnehmer ({{ attendees().length }})</label>
          <div class="space-y-1.5">
            @for (a of visibleAttendees(); track a.email) {
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">{{ a.initials }}</div>
                <span class="text-sm text-gray-600 truncate">{{ a.email }}</span>
              </div>
            }
            @if (attendees().length > MAX_VISIBLE_ATTENDEES) {
              <button type="button" (click)="attendeesExpanded.set(!attendeesExpanded())"
                      class="text-xs text-indigo-600 hover:text-indigo-700 ml-8">
                {{ attendeesExpanded() ? 'Weniger anzeigen' : '+' + (attendees().length - MAX_VISIBLE_ATTENDEES) + ' weitere' }}
              </button>
            }
          </div>
        </div>
      }

      @if (cleanDescription()) {
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Terminbeschreibung</label>
          <div class="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600 whitespace-pre-line"
               [class.line-clamp-2]="!descriptionExpanded()">{{ cleanDescription() }}</div>
          @if (descriptionIsLong()) {
            <button type="button"
                    (click)="descriptionExpanded.set(!descriptionExpanded())"
                    class="mt-1 text-xs text-indigo-600 hover:text-indigo-700">
              {{ descriptionExpanded() ? 'Weniger anzeigen' : 'Mehr anzeigen' }}
            </button>
          }
        </div>
      }

      <div class="flex items-center justify-between pt-2">
        @if (entry()) {
          <button
            type="button"
            (click)="deleteClicked.emit()"
            class="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            Löschen
          </button>
        } @else {
          <div></div>
        }
        <div class="flex gap-2">
          <button
            type="button"
            (click)="cancelled.emit()"
            class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            [disabled]="form.invalid"
            class="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700
                   rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ entry() ? 'Speichern' : 'Erstellen' }}
          </button>
        </div>
      </div>
    </form>
  `,
})
export class TimeEntryFormComponent implements OnInit {
  entry = input<TimeEntry | null>(null);
  defaultStart = input<Date | null>(null);
  defaultEnd = input<Date | null>(null);

  saved = output<{ dto: CreateTimeEntryDTO } | { id: string; changes: UpdateTimeEntryDTO }>();
  cancelled = output<void>();
  deleteClicked = output<void>();

  protected readonly projectStore = inject(ProjectStore);
  protected readonly getDisplayName = getProjectDisplayName;
  private readonly fb = inject(FormBuilder);

  protected readonly descriptionExpanded = signal(false);

  protected readonly cleanDescription = computed(() => {
    const desc = this.entry()?.description;
    return desc ? stripHtml(desc) : '';
  });

  protected readonly descriptionIsLong = computed(() => {
    const lines = this.cleanDescription().split('\n');
    return lines.length > 2 || this.cleanDescription().length > 120;
  });

  protected readonly MAX_VISIBLE_ATTENDEES = MAX_VISIBLE_ATTENDEES;
  protected readonly attendeesExpanded = signal(false);

  protected readonly attendees = computed(() =>
    (this.entry()?.attendees ?? []).map(parseAttendee)
  );

  protected readonly visibleAttendees = computed(() => {
    const all = this.attendees();
    return this.attendeesExpanded() ? all : all.slice(0, MAX_VISIBLE_ATTENDEES);
  });

  protected readonly projectDropdownOpen = signal(false);
  protected readonly selectedProjectId = signal<string>('');
  protected readonly selectedProject = computed(() => {
    const id = this.selectedProjectId();
    return this.projectStore.activeProjects().find(p => p.id === id) ?? null;
  });

  form!: FormGroup;

  ngOnInit() {
    const entry = this.entry();
    const start = entry ? new Date(entry.start) : (this.defaultStart() ?? new Date());
    const end = entry ? new Date(entry.end) : (this.defaultEnd() ?? new Date(start.getTime() + 3600000));

    const defaultProjectId = entry?.projectId
      || this.projectStore.activeProjects()[0]?.id
      || '';

    this.form = this.fb.group({
      title: [entry?.title ?? '', Validators.required],
      date: [format(start, 'yyyy-MM-dd'), Validators.required],
      startTime: [format(start, 'HH:mm'), Validators.required],
      endTime: [format(end, 'HH:mm'), Validators.required],
      projectId: [defaultProjectId, Validators.required],
      notes: [entry?.notes ?? ''],
    });
    this.selectedProjectId.set(defaultProjectId);
  }

  selectProject(id: string) {
    this.form.patchValue({ projectId: id });
    this.selectedProjectId.set(id);
    this.projectDropdownOpen.set(false);
  }

  onSubmit() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const start = new Date(`${v.date}T${v.startTime}:00`);
    const end = new Date(`${v.date}T${v.endTime}:00`);
    const projectId = v.projectId;

    const entry = this.entry();
    if (entry) {
      this.saved.emit({
        id: entry.id,
        changes: { title: v.title, start, end, projectId, notes: v.notes || undefined },
      });
    } else {
      this.saved.emit({
        dto: {
          title: v.title,
          start,
          end,
          projectId,
          source: 'manual',
          notes: v.notes || undefined,
        },
      });
    }
  }
}
