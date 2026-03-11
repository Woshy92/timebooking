import { Component, inject, input, output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ColorPickerComponent } from '../../../shared/components/color-picker/color-picker.component';
import { Project, CreateProjectDTO } from '../../../domain/models/project.model';

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
  form!: FormGroup;

  ngOnInit() {
    const p = this.project();
    this.form = this.fb.group({
      name: [p?.name ?? '', Validators.required],
      description: [p?.description ?? ''],
      color: [p?.color ?? '#4F46E5'],
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const p = this.project();
    if (p) {
      this.saved.emit({ id: p.id, changes: v });
    } else {
      this.saved.emit({ ...v, archived: false });
    }
  }
}
