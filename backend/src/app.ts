import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import authRoutes from './routes/auth.routes.js';
import calendarRoutes from './routes/calendar.routes.js';

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

  app.use(session({
    store: new FileStore({
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
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }));

  // CSRF double-submit cookie: set a non-httpOnly token cookie that Angular reads
  app.use((req, res, next) => {
    if (!req.cookies?.['XSRF-TOKEN'] && req.session) {
      const token = crypto.randomBytes(32).toString('hex');
      req.session.csrfToken = token;
      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }
    next();
  });

  // Validate CSRF token on mutating requests
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const headerToken = req.headers['x-xsrf-token'] as string;
    if (!headerToken || headerToken !== req.session?.csrfToken) {
      res.status(403).json({ error: 'Invalid CSRF token' });
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

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
