import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDatabase } from './services/database.service.js';

const required = ['SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

await initializeDatabase();
console.log('PGlite database initialized');

const app = createApp();
const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`Frontend expected at ${process.env.FRONTEND_ORIGIN || 'http://localhost:4200'}`);
});
