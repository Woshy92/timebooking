import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { listEvents } from '../services/google-calendar.service.js';

const router = Router();

router.get('/events', requireAuth, async (req, res) => {
  try {
    const { timeMin, timeMax, calendarId = 'primary' } = req.query as Record<string, string>;

    if (!timeMin || !timeMax) {
      res.status(400).json({ error: 'timeMin and timeMax are required' });
      return;
    }

    const { events, tokens } = await listEvents(req.session.tokens!, {
      timeMin,
      timeMax,
      calendarId,
    });

    // Update session if tokens were refreshed
    if (tokens.access_token) {
      req.session.tokens = tokens;
    }

    res.json(events);
  } catch (err: any) {
    console.error('Calendar API error:', err.message);
    if (err.code === 401) {
      req.session.destroy(() => {});
      res.status(401).json({ error: 'Token expired, please re-authenticate' });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

export default router;
