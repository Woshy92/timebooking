export interface CalendarEvent {
  readonly id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  attendees?: string[];
  recurringEventId?: string;
  source: 'google';
}

export interface CalendarFetchParams {
  timeMin: Date;
  timeMax: Date;
  calendarId?: string;
}
