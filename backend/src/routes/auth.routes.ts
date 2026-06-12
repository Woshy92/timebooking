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

  if (!code) {
    res.status(400).json({ error: 'No authorization code provided' });
    return;
  }

  if (!state || !pendingStates.has(state)) {
    res.status(403).json({ error: 'Invalid state parameter' });
    return;
  }
  pendingStates.delete(state);

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    req.session.save(() => {
      res.redirect(process.env.FRONTEND_ORIGIN || 'http://localhost:4200');
    });
  } catch (err) {
    console.error('OAuth callback error:', err instanceof Error ? err.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to exchange authorization code' });
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
