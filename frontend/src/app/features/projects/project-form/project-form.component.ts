import { Component, inject, input, output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ColorPickerComponent, PRESET_COLORS } from '../../../shared/components/color-picker/color-picker.component';
import { Project, CreateProjectDTO } from '../../../domain/models/project.model';
import { ProjectStore } from '../../../state/project.store';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [ReactiveFormsModule, ColorPickerComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Projektname</label>
        <input
          formControlName="name"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          placeholder="z.B. Kunde A – Beratung"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Satz</label>
        <input
          formControlName="rate"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          placeholder="z.B. Standard, Premium, Intern"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Kurzbezeichnung</label>
        <input
          formControlName="shortName"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          placeholder="Optional – wird als Anzeigename verwendet"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
        <input
          formControlName="description"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          placeholder="Optional"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
        <app-color-picker [value]="form.value.color" (colorChange)="form.patchValue({ color: $event })" />
      </div>

      <div class="flex justify-end gap-2 pt-2">
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
          {{ project() ? 'Speichern' : 'Erstellen' }}
        </button>
      </div>
    </form>
  `,
})
export class ProjectFormComponent implements OnInit {
  project = input<Project | null>(null);
  saved = output<CreateProjectDTO | { id: string; changes: Partial<Project> }>();
  cancelled = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly projectStore = inject(ProjectStore);
  form!: FormGroup;

  ngOnInit() {
    const p = this.project();
    const defaultColor = p?.color ?? this.nextAvailableColor();
    this.form = this.fb.group({
      name: [p?.name ?? '', Validators.required],
      rate: [p?.rate ?? '', Validators.required],
      shortName: [p?.shortName ?? ''],
      description: [p?.description ?? ''],
      color: [defaultColor],
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const v = { ...this.form.value, shortName: this.form.value.shortName?.trim() || undefined };
    const p = this.project();
    if (p) {
      this.saved.emit({ id: p.id, changes: v });
    } else {
      this.saved.emit({ ...v, archived: false, favorite: false, ignored: false });
    }
  }

  private nextAvailableColor(): string {
    const usedColors = new Set(this.projectStore.projects().map(p => p.color));
    return PRESET_COLORS.find(c => !usedColors.has(c))
      ?? PRESET_COLORS[this.projectStore.projects().length % PRESET_COLORS.length];
  }
}
