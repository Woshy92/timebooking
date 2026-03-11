import { Component, inject, input, output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectStore } from '../../../state/project.store';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../../../domain/models/time-entry.model';
import { format } from 'date-fns';

@Component({
  selector: 'app-time-entry-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
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
