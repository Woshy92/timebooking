import { TimeEntry } from '../../domain/models/time-entry.model';
import { Project } from '../../domain/models/project.model';

const DEFAULT_COLOR = '#6366F1';

export function getEntryColor(entry: TimeEntry, projectMap: Map<string, Project>): string {
  return entry.projectId ? (projectMap.get(entry.projectId)?.color ?? DEFAULT_COLOR) : DEFAULT_COLOR;
}

export function getEntryBg(entry: TimeEntry, projectMap: Map<string, Project>): string {
  return getEntryColor(entry, projectMap) + '18';
}

export function getEntryTextColor(entry: TimeEntry, projectMap: Map<string, Project>): string {
  return getEntryColor(entry, projectMap);
}

export function getProject(entry: TimeEntry, projectMap: Map<string, Project>): Project | null {
  return entry.projectId ? (projectMap.get(entry.projectId) ?? null) : null;
}
