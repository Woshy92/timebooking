import { google } from 'googleapis';

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
];
