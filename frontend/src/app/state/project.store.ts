import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, withHooks, patchState } from '@ngrx/signals';
import { Project, CreateProjectDTO } from '../domain/models/project.model';
import { STORAGE_PORT } from '../domain/ports/storage.port';
import { extractErrorMessage } from '../shared/utils/error-message';

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

export const ProjectStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectState>({
    projects: [],
    loading: false,
    error: null,
  }),
  withComputed(({ projects }) => ({
    activeProjects: computed(() =>
      projects().filter(p => !p.archived).sort((a, b) => a.order - b.order)
    ),
    projectMap: computed(() => new Map(projects().map(p => [p.id, p]))),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_PORT);
    return {
      loadProjects() {
        patchState(store, { loading: true });
        storage.getProjects().subscribe({
          next: (projects) => patchState(store, { projects, loading: false }),
          error: (err) => patchState(store, { error: extractErrorMessage(err), loading: false }),
        });
      },
      addProject(dto: CreateProjectDTO) {
        storage.saveProject(dto).subscribe({
          next: (project) => patchState(store, { projects: [...store.projects(), project] }),
          error: (err) => patchState(store, { error: extractErrorMessage(err) }),
        });
      },
      updateProject(id: string, changes: Partial<Project>) {
        storage.updateProject(id, changes).subscribe({
          next: (updated) => patchState(store, {
            projects: store.projects().map(p => p.id === id ? updated : p),
          }),
          error: (err) => patchState(store, { error: extractErrorMessage(err) }),
        });
      },
      deleteProject(id: string) {
        storage.deleteProject(id).subscribe({
          next: () => patchState(store, {
            projects: store.projects().filter(p => p.id !== id),
          }),
          error: (err) => patchState(store, { error: extractErrorMessage(err) }),
        });
      },
      reorderProjects(orderedIds: string[]) {
        storage.reorderProjects(orderedIds).subscribe({
          next: (projects) => patchState(store, { projects }),
          error: (err) => patchState(store, { error: extractErrorMessage(err) }),
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.loadProjects();
    },
  })
);
