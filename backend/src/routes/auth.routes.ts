import { Router } from 'express';
import crypto from 'crypto';
import { createOAuth2Client, SCOPES } from '../config/oauth.config.js';

const router = Router();

// Server-side OAuth state store — avoids reliance on session cookies which
// break when the dev proxy (port 4200) and direct backend (port 3000) set
// cookies in different first-party contexts.
const pendingStates = new Map<string, number>();

function cleanupStates() {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, createdAt] of pendingStates) {
    if (createdAt < fiveMinAgo) pendingStates.delete(key);
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
router.get('/start', (_req, res) => {
  cleanupStates();
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now());
  const oauth2Client = createOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
  res.redirect(url);
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

  if (!state || !pendingStates.has(state)) {
    redirectWithAuthError(res, 'invalid_state');
    return;
  }
  pendingStates.delete(state);

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    req.session.save(() => {
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
    res.json({ success: true });
  });
});

export default router;
