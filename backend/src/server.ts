import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDatabase, closeDatabase } from './services/database.service.js';

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

const server = app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`Frontend expected at ${process.env.FRONTEND_ORIGIN || 'http://localhost:4200'}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `FATAL: Port ${port} ist bereits belegt (EADDRINUSE). ` +
      `Läuft bereits eine andere Instanz? Beende sie oder setze PORT auf einen freien Port.`,
    );
  } else {
    console.error(`FATAL: HTTP-Server konnte nicht gestartet werden: ${err.message}`);
  }
  process.exit(1);
});

// Graceful shutdown: close the HTTP server first so in-flight requests
// (including session-file writes) complete, then close PGlite, then exit.
// A second signal forces an immediate exit.
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    console.error(`${signal} erneut empfangen — sofortiger Abbruch.`);
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`${signal} empfangen — fahre kontrolliert herunter...`);

  server.close((closeErr) => {
    void (async () => {
      if (closeErr) {
        console.error(`Fehler beim Schließen des HTTP-Servers: ${closeErr.message}`);
      }
      try {
        await closeDatabase();
        console.log('PGlite-Datenbank geschlossen.');
      } catch (dbErr) {
        console.error(
          `Fehler beim Schließen der Datenbank: ${dbErr instanceof Error ? dbErr.message : dbErr}`,
        );
        process.exit(1);
      }
      process.exit(closeErr ? 1 : 0);
    })();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
