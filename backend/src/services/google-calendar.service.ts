import { google } from 'googleapis';
import { Credentials } from 'google-auth-library';
import { createOAuth2Client } from '../config/oauth.config.js';

interface EventListParams {
  timeMin: string;
  timeMax: string;
  calendarId: string;
}

export async function listEvents(tokens: Credentials, params: EventListParams) {
  const auth = createOAuth2Client();
  auth.setCredentials(tokens);

  let refreshedTokens: Credentials | null = null;
  auth.on('tokens', (newTokens) => {
    refreshedTokens = { ...newTokens };
  });

  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: params.calendarId,
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });

  // Merge refreshed tokens with original tokens to preserve refresh_token
  const newTokens = refreshedTokens ? { ...tokens, ...refreshedTokens } : auth.credentials;

  const events = (res.data.items ?? [])
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .filter(e => !e.attendees?.some(a => a.self && a.responseStatus === 'declined'))
    .map(e => ({
      id: e.id,
      summary: e.summary ?? '(Kein Titel)',
      description: e.description ?? '',
      attendees: (e.attendees ?? [])
        .filter(a => !a.self)
        .map(a => a.displayName || a.email || '')
        .filter(Boolean),
      start: { dateTime: e.start!.dateTime! },
      end: { dateTime: e.end!.dateTime! },
      ...(e.recurringEventId && { recurringEventId: e.recurringEventId }),
    }));

  return { events, tokens: newTokens };
}
