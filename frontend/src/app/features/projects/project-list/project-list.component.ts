import { Component, inject, signal } from '@angular/core';
import { ProjectStore } from '../../../state/project.store';
import { TimeEntryStore } from '../../../state/time-entry.store';
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
            [class.opacity-60]="project.ignored && draggedId() !== project.id"
            draggable="true"
            (dragstart)="onDragStart($event, project.id)"
            (dragend)="onDragEnd()"
            (dragover)="onDragOver($event, project.id)"
            (dragleave)="onDragLeave(project.id)"
            (drop)="onDrop($event, project.id)"
          >
            <div class="flex items-center gap-4 min-w-0 flex-1">
              <svg class="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
              </svg>
              <div class="w-4 h-4 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
              <div class="min-w-0">
                <div class="font-medium text-gray-900 truncate">{{ getDisplayName(project) }}</div>
                @if (project.shortName) {
                  <div class="text-xs text-gray-400">{{ project.name }}/{{ project.rate }}</div>
                }
                @if (project.description) {
                  <div class="text-sm text-gray-500 truncate">{{ project.description }}</div>
                }
              </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0 ml-4">
              <!-- Toggles: always visible -->
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-1.5 cursor-pointer" title="Als Favorit im Kalender immer anzeigen">
                  <span class="text-[11px] text-gray-400 select-none">Favorit</span>
                  <button type="button" (click)="toggleFavorite(project)"
                    class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                    [class.bg-indigo-500]="project.favorite"
                    [class.bg-gray-200]="!project.favorite">
                    <span class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                      [style.transform]="project.favorite ? 'translateX(18px)' : 'translateX(2px)'"></span>
                  </button>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer" title="Im Kalender ausblenden">
                  <span class="text-[11px] text-gray-400 select-none">Ignorieren</span>
                  <button type="button" (click)="toggleIgnored(project)"
                    class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                    [class.bg-red-400]="project.ignored"
                    [class.bg-gray-200]="!project.ignored">
                    <span class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                      [style.transform]="project.ignored ? 'translateX(18px)' : 'translateX(2px)'"></span>
                  </button>
                </label>
              </div>
              <!-- Edit/Archive: hover-only -->
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

    @if (archiveConfirm(); as ac) {
      <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" (click)="archiveConfirm.set(null)">
        <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Projekt archivieren</h3>
          <p class="text-sm text-gray-600 mb-1">
            „{{ getDisplayName(ac.project) }}" wird archiviert.
          </p>
          @if (ac.mappingCount > 0) {
            <div class="flex items-start gap-2 mt-3 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-100">
              <svg class="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
              <p class="text-sm text-amber-800">
                {{ ac.mappingCount }} automatische {{ ac.mappingCount === 1 ? 'Zuordnung wird' : 'Zuordnungen werden' }} dadurch ungültig.
              </p>
            </div>
          }
          <div class="flex justify-end gap-2 mt-5">
            <button
              (click)="archiveConfirm.set(null)"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              (click)="doArchive(ac.project)"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Archivieren
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }
  `],
})
export class ProjectListComponent {
  protected readonly projectStore = inject(ProjectStore);
  private readonly timeEntryStore = inject(TimeEntryStore);
  protected readonly getDisplayName = getProjectDisplayName;

  isFormOpen = signal(false);
  editingProject = signal<Project | null>(null);
  draggedId = signal<string | null>(null);
  dragOverId = signal<string | null>(null);
  archiveConfirm = signal<{ project: Project; mappingCount: number } | null>(null);

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

  toggleFavorite(project: Project) {
    const changes: Partial<Project> = { favorite: !project.favorite };
    if (!project.favorite) changes.ignored = false;
    this.projectStore.updateProject(project.id, changes);
  }

  toggleIgnored(project: Project) {
    const changes: Partial<Project> = { ignored: !project.ignored };
    if (!project.ignored) changes.favorite = false;
    this.projectStore.updateProject(project.id, changes);
  }

  onArchive(project: Project) {
    const mappingCount = this.timeEntryStore.recurringProjectMappings()
      .filter(m => m.projectId === project.id).length;
    if (mappingCount > 0) {
      this.archiveConfirm.set({ project, mappingCount });
    } else {
      this.projectStore.updateProject(project.id, { archived: true });
    }
  }

  doArchive(project: Project) {
    this.projectStore.updateProject(project.id, { archived: true });
    this.archiveConfirm.set(null);
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
