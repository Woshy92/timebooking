// Provide the env vars that createApp()/oauth.config read, so the app boots
// without real Google credentials. Must run before any module reads process.env.
process.env.SESSION_SECRET = 'test-session-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/callback';
process.env.FRONTEND_ORIGIN = 'http://localhost:4200';
process.env.NODE_ENV = 'test';
// Generous rate limits so the suite never flakes on 429s. Individual tests
// lower these via process.env before calling createApp().
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.RATE_LIMIT_API_MAX = '1000';
