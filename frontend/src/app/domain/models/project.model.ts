export interface Project {
  readonly id: string;
  name: string;
  color: string;
  description?: string;
  archived: boolean;
  order: number;
}

export type CreateProjectDTO = Omit<Project, 'id' | 'order'>;
