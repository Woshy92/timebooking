import { Router } from 'express';
import { getDb } from '../services/database.service.js';

const router = Router();

// ─── DB row type ──────────────────────────────────────────────

type Row = Record<string, unknown>;

// ─── Helper: snake_case DB row → camelCase ────────────────────

function toProject(row: Row) {
  return {
    id: row.id,
    name: row.name,
    rate: row.rate ?? '',
    shortName: row.short_name ?? undefined,
    color: row.color,
    description: row.description ?? undefined,
    archived: row.archived ?? false,
    favorite: row.favorite ?? false,
    ignored: row.ignored ?? false,
    billable: row.billable ?? true,
    order: row.order ?? 0,
  };
}

function toTimeEntry(row: Row) {
  return {
    id: row.id,
    title: row.title,
    start: row.start_time,
    end: row.end_time,
    projectId: row.project_id ?? undefined,
    source: row.source ?? 'manual',
    googleEventId: row.google_event_id ?? undefined,
    recurringEventId: row.recurring_event_id ?? undefined,
    description: row.description ?? undefined,
    attendees: row.attendees ?? undefined,
    notes: row.notes ?? undefined,
    pause: row.pause ?? false,
  };
}

function toRecurringMapping(row: Row) {
  return {
    recurringEventId: row.recurring_event_id,
    projectId: row.project_id,
    eventTitle: row.event_title ?? '',
  };
}

// ─── Projects ─────────────────────────────────────────────────

router.get('/projects', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query<Row>('SELECT * FROM projects ORDER BY "order" ASC');
  res.json(rows.map(toProject));
});

router.post('/projects', async (req, res) => {
  const { name, rate, shortName, color, description, archived, favorite, ignored, billable } = req.body;
  const db = await getDb();

  const { rows: maxRows } = await db.query<{ max_order: number }>(
    'SELECT COALESCE(MAX("order"), -1) AS max_order FROM projects'
  );
  const nextOrder = (maxRows[0]?.max_order ?? -1) + 1;

  const { rows } = await db.query<Row>(
    `INSERT INTO projects (name, rate, short_name, color, description, archived, favorite, ignored, billable, "order")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [name, rate ?? '', shortName ?? null, color, description ?? null, archived ?? false, favorite ?? false, ignored ?? false, billable ?? true, nextOrder]
  );
  res.status(201).json(toProject(rows[0]));
});

router.put('/projects/reorder', async (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  const db = await getDb();

  for (let i = 0; i < orderedIds.length; i++) {
    await db.query('UPDATE projects SET "order" = $1 WHERE id = $2', [i, orderedIds[i]]);
  }

  const { rows } = await db.query<Row>('SELECT * FROM projects ORDER BY "order" ASC');
  res.json(rows.map(toProject));
});

router.put('/projects/:id', async (req, res) => {
  const { id } = req.params;
  const changes = req.body;
  const db = await getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name', rate: 'rate', shortName: 'short_name', color: 'color',
    description: 'description', archived: 'archived', order: '"order"',
    favorite: 'favorite', ignored: 'ignored', billable: 'billable',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in changes) {
      setClauses.push(`${col} = $${idx}`);
      values.push(changes[key]);
      idx++;
    }
  }

  if (setClauses.length === 0) {
    const { rows } = await db.query<Row>('SELECT * FROM projects WHERE id = $1', [id]);
    if (rows.length === 0) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(toProject(rows[0]));
    return;
  }

  values.push(id);
  const { rows } = await db.query<Row>(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (rows.length === 0) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(toProject(rows[0]));
});

router.delete('/projects/:id', async (req, res) => {
  const db = await getDb();
  await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// ─── Time Entries ─────────────────────────────────────────────

router.get('/entries', async (req, res) => {
  const { from, to } = req.query;
  const db = await getDb();
  const { rows } = await db.query<Row>(
    'SELECT * FROM time_entries WHERE start_time >= $1 AND start_time <= $2 ORDER BY start_time ASC',
    [from, to]
  );
  res.json(rows.map(toTimeEntry));
});

router.post('/entries', async (req, res) => {
  const { title, start, end, projectId, source, googleEventId, recurringEventId, description, attendees, notes, pause } = req.body;
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `INSERT INTO time_entries (title, start_time, end_time, project_id, source, google_event_id, recurring_event_id, description, attendees, notes, pause)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [title, start, end, projectId ?? null, source ?? 'manual', googleEventId ?? null, recurringEventId ?? null, description ?? null, attendees ? JSON.stringify(attendees) : null, notes ?? null, pause ?? false]
  );
  res.status(201).json(toTimeEntry(rows[0]));
});

router.put('/entries/:id', async (req, res) => {
  const { id } = req.params;
  const changes = req.body;
  const db = await getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    title: 'title', start: 'start_time', end: 'end_time', projectId: 'project_id',
    description: 'description', googleEventId: 'google_event_id',
    recurringEventId: 'recurring_event_id', notes: 'notes', pause: 'pause',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in changes) {
      setClauses.push(`${col} = $${idx}`);
      values.push(changes[key] ?? null);
      idx++;
    }
  }

  if ('attendees' in changes) {
    setClauses.push(`attendees = $${idx}`);
    values.push(changes.attendees ? JSON.stringify(changes.attendees) : null);
    idx++;
  }

  if (setClauses.length === 0) {
    const { rows } = await db.query<Row>('SELECT * FROM time_entries WHERE id = $1', [id]);
    if (rows.length === 0) { res.status(404).json({ error: 'Entry not found' }); return; }
    res.json(toTimeEntry(rows[0]));
    return;
  }

  values.push(id);
  const { rows } = await db.query<Row>(
    `UPDATE time_entries SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (rows.length === 0) { res.status(404).json({ error: 'Entry not found' }); return; }
  res.json(toTimeEntry(rows[0]));
});

router.delete('/entries/:id', async (req, res) => {
  const db = await getDb();

  // Auto-dismiss google events when deleting entries
  await db.query(`
    INSERT INTO dismissed_google_events (event_id)
    SELECT google_event_id FROM time_entries
    WHERE id = $1 AND google_event_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `, [req.params.id]);

  await db.query('DELETE FROM time_entries WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

router.post('/entries/delete-batch', async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  const db = await getDb();

  // Get google event IDs before deleting
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: googleRows } = await db.query<{ google_event_id: string }>(
    `SELECT DISTINCT google_event_id FROM time_entries
     WHERE id IN (${placeholders}) AND google_event_id IS NOT NULL`,
    ids
  );

  const dismissedGoogleEventIds = googleRows.map(r => r.google_event_id);

  // Auto-dismiss
  for (const eventId of dismissedGoogleEventIds) {
    await db.query(
      'INSERT INTO dismissed_google_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [eventId]
    );
  }

  // Delete entries
  await db.query(`DELETE FROM time_entries WHERE id IN (${placeholders})`, ids);

  res.json(dismissedGoogleEventIds);
});

// ─── Dismissed Google Events ──────────────────────────────────

router.get('/dismissed-events', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query<{ event_id: string }>('SELECT event_id FROM dismissed_google_events');
  res.json(rows.map(r => r.event_id));
});

router.post('/dismissed-events', async (req, res) => {
  const { eventId } = req.body;
  const db = await getDb();
  await db.query(
    'INSERT INTO dismissed_google_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [eventId]
  );
  res.status(204).end();
});

router.delete('/dismissed-events/all', async (_req, res) => {
  const db = await getDb();
  await db.query('DELETE FROM dismissed_google_events');
  res.status(204).end();
});

router.delete('/dismissed-events/:eventId', async (req, res) => {
  const db = await getDb();
  await db.query('DELETE FROM dismissed_google_events WHERE event_id = $1', [req.params.eventId]);
  res.status(204).end();
});

// ─── Recurring Project Mappings ───────────────────────────────

router.get('/recurring-mappings', async (_req, res) => {
  const db = await getDb();

  // Fetch mappings with backfill for missing event titles
  const { rows } = await db.query<Row>(`
    SELECT
      rm.recurring_event_id,
      rm.project_id,
      COALESCE(NULLIF(rm.event_title, ''), te.title, '') AS event_title
    FROM recurring_project_mappings rm
    LEFT JOIN LATERAL (
      SELECT title FROM time_entries
      WHERE recurring_event_id = rm.recurring_event_id AND title IS NOT NULL
      LIMIT 1
    ) te ON true
  `);

  // Persist backfilled titles
  for (const row of rows) {
    if (row.event_title) {
      await db.query(
        `UPDATE recurring_project_mappings SET event_title = $1
         WHERE recurring_event_id = $2 AND (event_title IS NULL OR event_title = '')`,
        [row.event_title, row.recurring_event_id]
      );
    }
  }

  res.json(rows.map(toRecurringMapping));
});

router.put('/recurring-mappings/:recurringEventId', async (req, res) => {
  const { recurringEventId } = req.params;
  const { projectId, eventTitle } = req.body;
  const db = await getDb();
  await db.query(
    `INSERT INTO recurring_project_mappings (recurring_event_id, project_id, event_title)
     VALUES ($1, $2, $3)
     ON CONFLICT (recurring_event_id) DO UPDATE SET project_id = $2, event_title = $3`,
    [recurringEventId, projectId, eventTitle ?? '']
  );
  res.status(204).end();
});

router.delete('/recurring-mappings/:recurringEventId', async (req, res) => {
  const db = await getDb();
  await db.query('DELETE FROM recurring_project_mappings WHERE recurring_event_id = $1', [req.params.recurringEventId]);
  res.status(204).end();
});

export default router;
