import { Component, inject, computed, signal } from '@angular/core';
import { ProjectStore } from '../../../state/project.store';
import { UiStore } from '../../../state/ui.store';
import { getProjectDisplayName } from '../../../domain/models/project.model';

@Component({
  selector: 'app-project-pills-bar',
  standalone: true,
  template: `
    <div class="flex items-center gap-1.5 min-w-0 flex-1">
      <div class="flex items-center gap-1 flex-wrap flex-1">
        @for (project of visibleProjects(); track project.id) {
          <button
            (click)="selectProject(project.id)"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap
                   flex-shrink-0 border-2 transition-all cursor-pointer hover:shadow-sm"
            [style.background-color]="isSelected(project.id) ? project.color + '20' : project.color + '0A'"
            [style.border-color]="isSelected(project.id) ? project.color : 'transparent'"
            [style.color]="project.color"
          >
            <div class="w-2 h-2 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
            {{ getDisplayName(project) }}
          </button>
        }
      </div>
      @if (hasOverflow()) {
        <div class="relative flex-shrink-0">
          <button (click)="overflowOpen.set(!overflowOpen())"
            class="px-2 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            +{{ overflowCount() }}
          </button>
          @if (overflowOpen()) {
            <div class="fixed inset-0 z-30" (click)="overflowOpen.set(false)"></div>
            <div class="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-40 animate-pop-in max-h-80 overflow-y-auto">
              @for (project of overflowProjects(); track project.id) {
                <button
                  (click)="selectProject(project.id); overflowOpen.set(false)"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
                  [class.bg-gray-50]="isSelected(project.id)"
                  [class.font-semibold]="isSelected(project.id)"
                >
                  <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
                  <span class="text-gray-800 truncate">{{ getDisplayName(project) }}</span>
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`:host { display: flex; min-width: 0; flex: 1; }`],
})
export class ProjectPillsBarComponent {
  private readonly projectStore = inject(ProjectStore);
  private readonly uiStore = inject(UiStore);
  protected readonly getDisplayName = getProjectDisplayName;

  overflowOpen = signal(false);

  private readonly nonIgnoredProjects = computed(() =>
    this.projectStore.activeProjects().filter(p => !p.ignored)
  );

  readonly visibleProjects = computed(() => {
    const all = this.nonIgnoredProjects();
    const favorites = all.filter(p => p.favorite);
    const defaultId = this.uiStore.defaultProjectId();
    const selectedNonFav = defaultId
      ? all.find(p => p.id === defaultId && !p.favorite)
      : undefined;
    return selectedNonFav ? [...favorites, selectedNonFav] : favorites;
  });

  readonly overflowProjects = computed(() => {
    const all = this.nonIgnoredProjects();
    const defaultId = this.uiStore.defaultProjectId();
    return all.filter(p => !p.favorite && p.id !== defaultId);
  });

  readonly hasOverflow = computed(() => this.overflowProjects().length > 0);
  readonly overflowCount = computed(() => this.overflowProjects().length);

  isSelected(id: string): boolean {
    return this.uiStore.defaultProjectId() === id;
  }

  selectProject(id: string) {
    this.uiStore.setDefaultProject(id);
  }
}
