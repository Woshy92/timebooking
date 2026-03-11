import { Component, computed, inject, input, output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectStore } from '../../../state/project.store';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../../../domain/models/time-entry.model';
import { format } from 'date-fns';

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}

function formatAttendee(raw: string): string {
  if (raw.includes('@')) return raw.split('@')[0].replace(/[._]/g, ' ');
  return raw;
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
            @if (cleanDescription()) {
              <div class="text-xs text-blue-600/70 mt-1 whitespace-pre-line line-clamp-3">{{ cleanDescription() }}</div>
            }
            @if (entry()?.attendees?.length) {
              <div class="flex items-center gap-1 mt-1.5 text-xs text-blue-600/70">
                <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span>{{ attendeeSummary() }}</span>
              </div>
            }
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
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
          <select
            formControlName="projectId"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          >
            <option value="">Kein Projekt</option>
            @for (project of projectStore.activeProjects(); track project.id) {
              <option [value]="project.id">
                {{ project.name }}
              </option>
            }
          </select>
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
  private readonly fb = inject(FormBuilder);

  protected readonly cleanDescription = computed(() => {
    const desc = this.entry()?.description;
    return desc ? stripHtml(desc) : '';
  });

  protected readonly attendeeSummary = computed(() => {
    const all = (this.entry()?.attendees ?? []).map(formatAttendee);
    if (all.length <= MAX_VISIBLE_ATTENDEES) return all.join(', ');
    const rest = all.length - MAX_VISIBLE_ATTENDEES;
    return all.slice(0, MAX_VISIBLE_ATTENDEES).join(', ') + ` +${rest} weitere`;
  });

  form!: FormGroup;

  ngOnInit() {
    const entry = this.entry();
    const start = entry ? new Date(entry.start) : (this.defaultStart() ?? new Date());
    const end = entry ? new Date(entry.end) : (this.defaultEnd() ?? new Date(start.getTime() + 3600000));

    this.form = this.fb.group({
      title: [entry?.title ?? '', Validators.required],
      date: [format(start, 'yyyy-MM-dd'), Validators.required],
      startTime: [format(start, 'HH:mm'), Validators.required],
      endTime: [format(end, 'HH:mm'), Validators.required],
      projectId: [entry?.projectId ?? ''],
      notes: [entry?.notes ?? ''],
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const start = new Date(`${v.date}T${v.startTime}:00`);
    const end = new Date(`${v.date}T${v.endTime}:00`);
    const projectId = v.projectId || undefined;

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
