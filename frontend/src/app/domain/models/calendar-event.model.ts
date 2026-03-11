export interface CalendarEvent {
  readonly id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  source: 'google';
}

export interface CalendarFetchParams {
  timeMin: Date;
  timeMax: Date;
  calendarId?: string;
}
