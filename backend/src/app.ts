import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import storageRoutes from './routes/storage.routes.js';
import { issueXsrfCookie, XSRF_COOKIE_NAME } from './middleware/csrf.middleware.js';

function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createApp() {
  const app = express();
  const FileStore = FileStoreFactory(session);

  app.disable('x-powered-by');

  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
    credentials: true,
  }));

  app.use(cookieParser());
  app.use(express.json());

  // Rate limiting. Limits are env-overridable (RATE_LIMIT_AUTH_MAX /
  // RATE_LIMIT_API_MAX) so the test suite can raise or lower them without
  // touching code. Defaults: auth flows are rare (10/15min), API calls are
  // chatty (300/15min).
  const rateLimitWindowMs = 15 * 60 * 1000;
  const apiLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: limitFromEnv('RATE_LIMIT_API_MAX', 300),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
  });
  const authLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: limitFromEnv('RATE_LIMIT_AUTH_MAX', 10),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // /auth/status is polled by the SPA, so it gets the generous API limit
    // (mounted below) instead of the strict auth-flow limit.
    skip: (req) => req.path === '/status',
    // /auth/start and /auth/callback are reached via browser navigation —
    // errors must redirect to the SPA, never render raw JSON.
    handler: (req, res) => {
      if (req.method === 'GET') {
        const frontend = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
        res.redirect(`${frontend}/?auth_error=rate_limited`);
      } else {
        res.status(429).json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
      }
    },
  });
  app.use('/auth/status', apiLimiter);
  app.use('/auth', authLimiter);
  app.use('/api', apiLimiter);

  app.use(session({
    // In tests the default in-memory store keeps the suite hermetic
    // (no ./sessions file writes, no file-store reaper timers).
    store: process.env.NODE_ENV === 'test' ? undefined : new FileStore({
      path: './sessions',
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      fileMode: 0o600,
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }));

  // CSRF double-submit cookie: set a non-httpOnly token cookie that the frontend reads.
  // Rotation after login/logout happens in auth.routes.ts via issueXsrfCookie().
  app.use((req, res, next) => {
    if (!req.cookies?.[XSRF_COOKIE_NAME]) {
      issueXsrfCookie(res);
    }
    next();
  });

  // Validate CSRF: header must match cookie (standard double-submit pattern)
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const headerToken = req.headers['x-xsrf-token'] as string;
    const cookieToken = req.cookies?.[XSRF_COOKIE_NAME] as string;
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      res.status(403).json({ error: 'Ungültiger CSRF-Token. Bitte Seite neu laden.' });
      return;
    }
    next();
  });

  // Request logging in development
  if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const ms = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
        console.log(`${color}${req.method} ${req.originalUrl} ${status}\x1b[0m ${ms}ms`);
        if (status >= 400 && req.query) {
          console.log('  query:', req.query);
        }
      });
      next();
    });
  }

  app.use('/auth', authRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/storage', storageRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
