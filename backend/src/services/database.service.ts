import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data/pglite');

let db: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new PGlite(DATA_DIR);
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const client = await getDb();

  await client.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      rate        TEXT NOT NULL DEFAULT '',
      short_name  TEXT,
      color       TEXT NOT NULL,
      description TEXT,
      archived    BOOLEAN NOT NULL DEFAULT FALSE,
      "order"     INTEGER NOT NULL DEFAULT 0,
      favorite    BOOLEAN NOT NULL DEFAULT FALSE,
      ignored     BOOLEAN NOT NULL DEFAULT FALSE
    );

    ALTER TABLE projects ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS ignored BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS time_entries (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title              TEXT NOT NULL,
      start_time         TIMESTAMPTZ NOT NULL,
      end_time           TIMESTAMPTZ NOT NULL,
      project_id         UUID REFERENCES projects(id) ON DELETE SET NULL,
      source             TEXT NOT NULL DEFAULT 'manual',
      google_event_id    TEXT,
      recurring_event_id TEXT,
      description        TEXT,
      attendees          JSONB,
      notes              TEXT,
      pause              BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_start ON time_entries(start_time);
    CREATE INDEX IF NOT EXISTS idx_time_entries_google_event ON time_entries(google_event_id);

    CREATE TABLE IF NOT EXISTS dismissed_google_events (
      event_id TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS recurring_project_mappings (
      recurring_event_id TEXT PRIMARY KEY,
      project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      event_title        TEXT NOT NULL DEFAULT ''
    );
  `);
}
