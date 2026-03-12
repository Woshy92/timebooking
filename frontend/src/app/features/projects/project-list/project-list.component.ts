import { Component, inject, signal } from '@angular/core';
import { ProjectStore } from '../../../state/project.store';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ProjectFormComponent } from '../project-form/project-form.component';
import { Project, CreateProjectDTO, getProjectDisplayName } from '../../../domain/models/project.model';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [ModalComponent, ProjectFormComponent],
  template: `
    <div class="p-6 max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Projekte</h1>
          <p class="text-sm text-gray-500 mt-1">Verwalte deine Projekte für die Zeiterfassung</p>
        </div>
        <button
          (click)="openForm(null)"
          class="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium
                 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Neues Projekt
        </button>
      </div>

      <div class="space-y-1">
        @for (project of projectStore.activeProjects(); track project.id) {
          <div
            class="flex items-center justify-between p-4 bg-white rounded-xl border-2 transition-all group cursor-grab active:cursor-grabbing"
            [class.border-gray-400]="dragOverId() === project.id"
            [class.border-gray-100]="dragOverId() !== project.id"
            [class.shadow-sm]="draggedId() !== project.id"
            [class.opacity-30]="draggedId() === project.id"
            draggable="true"
            (dragstart)="onDragStart($event, project.id)"
            (dragend)="onDragEnd()"
            (dragover)="onDragOver($event, project.id)"
            (dragleave)="onDragLeave(project.id)"
            (drop)="onDrop($event, project.id)"
          >
            <div class="flex items-center gap-4">
              <svg class="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
              </svg>
              <div class="w-4 h-4 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
              <div>
                <div class="font-medium text-gray-900">{{ getDisplayName(project) }}</div>
                @if (project.shortName) {
                  <div class="text-xs text-gray-400">{{ project.name }}/{{ project.rate }}</div>
                }
                @if (project.description) {
                  <div class="text-sm text-gray-500">{{ project.description }}</div>
                }
              </div>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                (click)="openForm(project)"
                class="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button
                (click)="onArchive(project)"
                class="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        }

        @if (projectStore.activeProjects().length === 0) {
          <div class="text-center py-12 text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <p class="font-medium">Noch keine Projekte</p>
            <p class="text-sm mt-1">Erstelle dein erstes Projekt, um Zeiten zuzuordnen.</p>
          </div>
        }
      </div>
    </div>

    @if (isFormOpen()) {
      <app-modal [title]="editingProject() ? 'Projekt bearbeiten' : 'Neues Projekt'" (closed)="closeForm()">
        <app-project-form
          [project]="editingProject()"
          (saved)="onSave($event)"
          (cancelled)="closeForm()"
        />
      </app-modal>
    }
  `,
})
export class ProjectListComponent {
  protected readonly projectStore = inject(ProjectStore);
  protected readonly getDisplayName = getProjectDisplayName;

  isFormOpen = signal(false);
  editingProject = signal<Project | null>(null);
  draggedId = signal<string | null>(null);
  dragOverId = signal<string | null>(null);

  openForm(project: Project | null) {
    this.editingProject.set(project);
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
    this.editingProject.set(null);
  }

  onSave(event: CreateProjectDTO | { id: string; changes: Partial<Project> }) {
    if ('id' in event) {
      this.projectStore.updateProject(event.id, event.changes);
    } else {
      this.projectStore.addProject(event);
    }
    this.closeForm();
  }

  onArchive(project: Project) {
    this.projectStore.updateProject(project.id, { archived: true });
  }

  onDragStart(event: DragEvent, id: string) {
    this.draggedId.set(id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragEnd() {
    this.draggedId.set(null);
    this.dragOverId.set(null);
  }

  onDragOver(event: DragEvent, id: string) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    if (id !== this.draggedId()) {
      this.dragOverId.set(id);
    }
  }

  onDragLeave(id: string) {
    if (this.dragOverId() === id) {
      this.dragOverId.set(null);
    }
  }

  onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    const draggedId = this.draggedId();
    if (!draggedId || draggedId === targetId) return;

    const ids = this.projectStore.activeProjects().map(p => p.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, draggedId);
    this.projectStore.reorderProjects(ids);

    this.draggedId.set(null);
    this.dragOverId.set(null);
  }
}
