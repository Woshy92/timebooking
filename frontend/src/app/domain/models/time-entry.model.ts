export type TimeEntrySource = 'google' | 'manual';

export interface TimeEntry {
  readonly id: string;
  title: string;
  start: Date;
  end: Date;
  projectId?: string;
  source: TimeEntrySource;
  googleEventId?: string;
  notes?: string;
}

export type CreateTimeEntryDTO = Omit<TimeEntry, 'id'>;
export type UpdateTimeEntryDTO = Partial<Omit<TimeEntry, 'id' | 'source'>>;
