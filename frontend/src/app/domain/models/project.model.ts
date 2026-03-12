export interface Project {
  readonly id: string;
  name: string;
  rate: string;
  shortName?: string;
  color: string;
  description?: string;
  archived: boolean;
  favorite: boolean;
  ignored: boolean;
  billable: boolean;
  order: number;
}

export function getProjectDisplayName(project: Project): string {
  if (project.shortName) return project.shortName;
  if (project.rate) return `${project.name}/${project.rate}`;
  return project.name;
}

export type CreateProjectDTO = Omit<Project, 'id' | 'order'>;
