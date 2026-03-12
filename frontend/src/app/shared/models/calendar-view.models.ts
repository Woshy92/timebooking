export const START_HOUR = 6;
export const END_HOUR = 21;
export const SNAP_MINUTES = 15;

export interface DraftEntry {
  date: Date;
  startHour: number;
  endHour: number;
  title: string;
}

export interface PopoverState {
  x: number;
  y: number;
}

export interface DragOverride {
  entryId: string;
  start: Date;
  end: Date;
}
