import { Router } from 'express';
import crypto from 'crypto';
import { createOAuth2Client, SCOPES } from '../config/oauth.config.js';

const router = Router();

router.get('/url', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const oauth2Client = createOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    res.status(400).json({ error: 'No authorization code provided' });
    return;
  }

  if (!state || !req.session.oauthState || state !== req.session.oauthState) {
    res.status(403).json({ error: 'Invalid state parameter' });
    return;
  }
  delete req.session.oauthState;

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
