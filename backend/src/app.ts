import express from 'express';
import cors from 'cors';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import authRoutes from './routes/auth.routes.js';
import calendarRoutes from './routes/calendar.routes.js';

export function createApp() {
  const app = express();
  const FileStore = FileStoreFactory(session);

  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
    credentials: true,
  }));

  app.use(express.json());

  app.use(session({
    store: new FileStore({
      path: './sessions',
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }));

  app.use('/auth', authRoutes);
  app.use('/api/calendar', calendarRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
