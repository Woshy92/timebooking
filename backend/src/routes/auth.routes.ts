import { Router } from 'express';
import crypto from 'crypto';
import { createOAuth2Client, SCOPES } from '../config/oauth.config.js';
import { issueXsrfCookie } from '../middleware/csrf.middleware.js';

const router = Router();

// Server-side OAuth state store, bound to the session ID that initiated the
// flow (login-CSRF protection: the callback only accepts a state from the
// same browser session that started it).
// NOTE: This in-memory Map does not survive a server restart and does not
// scale beyond a single instance. Accepted trade-off for local single-user
// operation — replace with a shared store (DB/Redis) before multi-instance
// deployment.
interface PendingState {
  sid: string;
  createdAt: number;
}
const pendingStates = new Map<string, PendingState>();

function cleanupStates() {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, entry] of pendingStates) {
    if (entry.createdAt < fiveMinAgo) pendingStates.delete(key);
  }
}

function frontendOrigin(): string {
  return process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
}

// Redirect back to the frontend with a coarse-grained error code so the SPA can
// show a localized message. Never leak internal/exception details into the URL.
function redirectWithAuthError(res: import('express').Response, code: string): void {
  res.redirect(`${frontendOrigin()}/?auth_error=${encodeURIComponent(code)}`);
}

// Browser navigates here directly so the redirect to Google happens
// server-side (no XHR, no cross-origin cookie issues).
router.get('/start', (req, res) => {
  cleanupStates();
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { sid: req.sessionID, createdAt: Date.now() });
  const oauth2Client = createOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
  // Persist the session before redirecting to Google. The OAuth state itself
  // lives in the server-side `pendingStates` map (bound to this session ID),
  // NOT in the session — so the session would otherwise be unmodified.
  //
  // With saveUninitialized=false, express-session only emits a Set-Cookie
  // header when the session was modified (see shouldSetCookie). An unmodified
  // session gets no cookie, so the callback would arrive with a brand-new
  // session ID and the state check (`entry.sid !== req.sessionID`) would fail.
  // We therefore mark the session as initialized to force the cookie out, then
  // save() persists it to the store before the redirect.
  req.session.initialized = true;
  req.session.save(() => {
    res.redirect(url);
  });
});

router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const error = req.query.error as string;

  // User denied consent (or another OAuth-level error). Google appends ?error=...
  if (error) {
    redirectWithAuthError(res, error === 'access_denied' ? 'access_denied' : 'auth_failed');
    return;
  }

  if (!code) {
    redirectWithAuthError(res, 'auth_failed');
    return;
  }

  const entry = state ? pendingStates.get(state) : undefined;
  if (!entry || entry.sid !== req.sessionID) {
    // Unknown state OR a state issued to a different browser session
    // (login CSRF attempt) — reject either way.
    redirectWithAuthError(res, 'invalid_state');
    return;
  }
  pendingStates.delete(state);

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    req.session.save(() => {
      // Rotate the CSRF token on privilege escalation (login) so a token
      // obtained pre-login cannot be fixated.
      issueXsrfCookie(res);
      res.redirect(frontendOrigin());
    });
  } catch (err) {
    console.error('OAuth callback error:', err instanceof Error ? err.message : 'Unknown error');
    redirectWithAuthError(res, 'token_exchange_failed');
  }
});

router.get('/status', (req, res) => {
  res.json({ authenticated: !!req.session.tokens });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    // Explicitly remove the session cookie in the browser (destroy only
    // deletes the server-side session). Options must match the ones used
    // when the cookie was set, otherwise browsers won't clear it.
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    // Rotate the CSRF token on logout (privilege change).
    issueXsrfCookie(res);
    res.json({ success: true });
  });
});

export default router;
