import { Component, inject, input, output, computed } from '@angular/core';
import { ProjectStore } from '../../../state/project.store';

@Component({
  selector: 'app-project-popover',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-40" (click)="close.emit()"></div>
    <div
      class="fixed z-50 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 animate-pop-in"
      [style.left.px]="x()"
      [style.top.px]="y()"
    >
      <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        @if (selectedCount() > 1) {
          {{ selectedCount() }} Einträge · Projekt zuweisen
        } @else {
          Projekt zuweisen
        }
      </div>
      @for (project of projectStore.activeProjects(); track project.id) {
        <button
          (click)="assign.emit(project.id)"
          class="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
          [class.bg-indigo-50]="commonProjectId() === project.id"
          [class.font-semibold]="commonProjectId() === project.id"
        >
          <div class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="project.color"></div>
          <span class="text-gray-800 truncate">{{ project.name }}</span>
          @if (commonProjectId() === project.id) {
            <svg class="w-3.5 h-3.5 text-indigo-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
          }
        </button>
      }
      <div class="border-t border-gray-100 mt-1 pt-1">
        <button
          (click)="delete.emit()"
          class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors text-left"
        >
          <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          @if (selectedCount() > 1) {
            <span>{{ selectedCount() }} Einträge löschen</span>
          } @else {
            <span>Eintrag löschen</span>
          }
        </button>
      </div>
    </div>
  `,
})
export class ProjectPopoverComponent {
  protected readonly projectStore = inject(ProjectStore);

  x = input.required<number>();
  y = input.required<number>();
  selectedCount = input.required<number>();
  commonProjectId = input.required<string | undefined | null>();

  assign = output<string>();
  delete = output<void>();
  close = output<void>();
}
