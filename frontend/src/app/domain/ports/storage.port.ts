import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { TimeEntry, CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../models/time-entry.model';
import { Project, CreateProjectDTO } from '../models/project.model';
import { RecurringProjectMapping } from '../models/recurring-mapping.model';

export interface StoragePort {
  getEntries(from: Date, to: Date): Observable<TimeEntry[]>;
  saveEntry(entry: CreateTimeEntryDTO): Observable<TimeEntry>;
  updateEntry(id: string, changes: UpdateTimeEntryDTO): Observable<TimeEntry>;
  deleteEntry(id: string): Observable<void>;
  deleteEntries(ids: string[]): Observable<string[]>;

  getDismissedGoogleEventIds(): Observable<string[]>;
  dismissGoogleEvent(eventId: string): Observable<void>;
  undismissGoogleEvent(eventId: string): Observable<void>;
  clearDismissedGoogleEventIds(): Observable<void>;

  getRecurringProjectMappings(): Observable<RecurringProjectMapping[]>;
  setRecurringProjectMapping(recurringEventId: string, projectId: string, eventTitle: string): Observable<void>;
  deleteRecurringProjectMapping(recurringEventId: string): Observable<void>;

  getProjects(): Observable<Project[]>;
  saveProject(project: CreateProjectDTO): Observable<Project>;
  updateProject(id: string, changes: Partial<Project>): Observable<Project>;
  deleteProject(id: string): Observable<void>;
  reorderProjects(orderedIds: string[]): Observable<Project[]>;
}

export const STORAGE_PORT = new InjectionToken<StoragePort>('StoragePort');
