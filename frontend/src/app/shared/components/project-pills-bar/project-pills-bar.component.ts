import { Component, inject, computed, signal, ElementRef, viewChild, viewChildren, afterNextRender, DestroyRef, effect } from '@angular/core';
import { ProjectStore } from '../../../state/project.store';
import { UiStore } from '../../../state/ui.store';
import { getProjectDisplayName } from '../../../domain/models/project.model';

@Component({
  selector: 'app-project-pills-bar',
  standalone: true,
  template: `
    <div class="flex items-center gap-1.5 min-w-0 flex-1">
      <div class="flex items-center gap-1 min-w-0 overflow-hidden flex-1" #pillsContainer>
        @for (project of projects(); track project.id; let i = $index) {
          <button #pill
            (click)="selectProject(project.id)"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap
                   flex-shrink-0 border-2 transition-all cursor-pointer hover:shadow-sm"
            [style.background-color]="isSelected(project.id) ? project.color + '20' : project.color + '0A'"
            [style.border-color]="isSelected(project.id) ? project.color : 'transparent'"
            [style.color]="project.color"
            [style.display]="i < visibleCount() ? '' : 'none'"
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
            <div class="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-40 animate-pop-in">
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly getDisplayName = getProjectDisplayName;

  readonly pillsContainer = viewChild<ElementRef>('pillsContainer');
  readonly pillElements = viewChildren<ElementRef>('pill');

  readonly projects = this.projectStore.activeProjects;
  visibleCount = signal(100);
  overflowOpen = signal(false);

  readonly hasOverflow = computed(() => this.visibleCount() < this.projects().length);
  readonly overflowCount = computed(() => this.projects().length - this.visibleCount());
  readonly overflowProjects = computed(() => this.projects().slice(this.visibleCount()));

  private recalcNeeded = effect(() => {
    this.projects().length;
    this.pillElements();
    this.recalculate();
  });

  constructor() {
    afterNextRender(() => {
      const container = this.pillsContainer()?.nativeElement;
      if (!container) return;
      const ro = new ResizeObserver(() => this.recalculate());
      ro.observe(container);
      this.destroyRef.onDestroy(() => ro.disconnect());
      this.recalculate();
    });
  }

  isSelected(id: string): boolean {
    return this.uiStore.defaultProjectId() === id;
  }

  selectProject(id: string) {
    this.uiStore.setDefaultProject(id);
  }

  private recalculate() {
    const container = this.pillsContainer()?.nativeElement;
    const pills = this.pillElements();
    if (!container || pills.length === 0) {
      this.visibleCount.set(this.projects().length);
      return;
    }

    const containerWidth = container.clientWidth;
    const overflowBtnWidth = 44;
    const gap = 4;
    let usedWidth = 0;
    let count = 0;

    // Temporarily show all pills so we can measure them
    for (const pill of pills) {
      pill.nativeElement.style.display = '';
    }

    for (let i = 0; i < pills.length; i++) {
      const pillWidth = pills[i].nativeElement.offsetWidth;
      const nextWidth = usedWidth + pillWidth + (count > 0 ? gap : 0);
      const remaining = pills.length - i - 1;

      if (remaining > 0 && nextWidth > containerWidth - overflowBtnWidth - gap) {
        break;
      }
      if (remaining === 0 && nextWidth > containerWidth) {
        break;
      }
      usedWidth = nextWidth;
      count++;
    }

    // Hide overflow pills again
    for (let i = count; i < pills.length; i++) {
      pills[i].nativeElement.style.display = 'none';
    }

    this.visibleCount.set(count);
  }
}
