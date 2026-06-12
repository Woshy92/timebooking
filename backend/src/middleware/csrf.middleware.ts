import crypto from 'crypto';
import type { Response } from 'express';

export const XSRF_COOKIE_NAME = 'XSRF-TOKEN';

/**
 * Issues a fresh CSRF double-submit cookie (non-httpOnly so the SPA can read
 * it and mirror it into the X-XSRF-TOKEN header). Called on first contact in
 * app.ts and re-called to ROTATE the token after privilege changes
 * (login callback success, logout) so a pre-login token can never be fixated.
 */
export function issueXsrfCookie(res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(XSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return token;
}
