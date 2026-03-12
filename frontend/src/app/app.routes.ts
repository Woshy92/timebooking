import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'calendar', pathMatch: 'full' },
  {
    path: 'calendar',
    loadComponent: () => import('./features/calendar/calendar-shell/calendar-shell.component')
      .then(m => m.CalendarShellComponent),
  },
  {
    path: 'projects',
    loadComponent: () => import('./features/projects/project-list/project-list.component')
      .then(m => m.ProjectListComponent),
  },
  {
    path: 'statistics',
    loadComponent: () => import('./features/statistics/statistics.component')
      .then(m => m.StatisticsComponent),
  },
  {
    path: 'rules',
    loadComponent: () => import('./features/rules/rules.component')
      .then(m => m.RulesComponent),
  },
  { path: '**', redirectTo: 'calendar' },
];
