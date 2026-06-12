import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const FRONTEND = 'http://localhost:4200';

// createApp() reads the limits from the environment at call time, so each
// test can pick its own (low) limit and gets a fresh limiter store.
describe('rate limiting', () => {
  let savedAuthMax: string | undefined;
  let savedApiMax: string | undefined;

  beforeEach(() => {
    savedAuthMax = process.env.RATE_LIMIT_AUTH_MAX;
    savedApiMax = process.env.RATE_LIMIT_API_MAX;
  });

  afterEach(() => {
    process.env.RATE_LIMIT_AUTH_MAX = savedAuthMax;
    process.env.RATE_LIMIT_API_MAX = savedApiMax;
  });

  it('limits /auth/* and redirects browser navigations with auth_error=rate_limited', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '2';
    const app = createApp();

    const first = await request(app).get('/auth/start');
    const second = await request(app).get('/auth/start');
    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(first.headers['location']).toContain('accounts.google.com');

    const third = await request(app).get('/auth/start');
    expect(third.status).toBe(302);
    expect(third.headers['location']).toBe(`${FRONTEND}/?auth_error=rate_limited`);
    expect(third.headers['content-type'] ?? '').not.toContain('application/json');
  });

  it('limits /api/* with a 429 JSON response', async () => {
    process.env.RATE_LIMIT_API_MAX = '2';
    const app = createApp();

    const first = await request(app).get('/api/calendar/events');
    const second = await request(app).get('/api/calendar/events');
    expect(first.status).toBe(401); // unauthenticated, but not rate limited
    expect(second.status).toBe(401);

    const third = await request(app).get('/api/calendar/events');
    expect(third.status).toBe(429);
    expect(third.body.error).toContain('Zu viele Anfragen');
  });

  it('does not throttle the frequently polled /auth/status with the strict auth limit', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '1';
    const app = createApp();

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/auth/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ authenticated: false });
    }
  });
});
