import { test as base, type Page, type Route } from '@playwright/test';

// ─── Shared types & helpers used by stateful-backend specs ───────────────────

/** Shape of a time entry as stored/returned by the mock backend. */
export interface StoredEntry {
  id: string;
  title: string;
  start: string;
  end: string;
  projectId: string;
  source: string;
  notes?: string;
}

/** Single seeded project so entry forms (projectId required) validate. */
export const PROJECT = { id: 'p1', name: 'Beratung', color: '#6366F1', archived: false };

/** Install a stateful mock backend for the storage endpoints used in create/delete/undo flows. */
export async function installStatefulBackend(page: Page): Promise<void> {
  const entries: StoredEntry[] = [];
  let seq = 0;

  const jsonBody = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  // Projects: one active project so the entry form validates.
  await page.route('**/api/storage/projects**', (route) => {
    if (route.request().method() === 'GET') return jsonBody(route, [PROJECT]);
    return route.fulfill({ status: 204, body: '' });
  });

  // Batch delete: remove ids, return dismissed-google ids (none here).
  await page.route('**/api/storage/entries/delete-batch', async (route) => {
    const { ids } = (route.request().postDataJSON() ?? {}) as { ids: string[] };
    for (const id of ids ?? []) {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx !== -1) entries.splice(idx, 1);
    }
    return jsonBody(route, []);
  });

  // Single delete (used by the modal delete path).
  await page.route('**/api/storage/entries/*', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.pathname.split('/').pop()!;
      const idx = entries.findIndex((e) => e.id === id);
      if (idx !== -1) entries.splice(idx, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    return jsonBody(route, []);
  });

  // List + create on the entries collection.
  await page.route('**/api/storage/entries**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') return jsonBody(route, entries);
    if (method === 'POST') {
      const dto = (route.request().postDataJSON() ?? {}) as Partial<StoredEntry>;
      const created: StoredEntry = {
        id: `e${++seq}`,
        title: dto.title ?? '',
        start: dto.start as string,
        end: dto.end as string,
        projectId: (dto.projectId as string) ?? PROJECT.id,
        source: dto.source ?? 'manual',
        notes: dto.notes,
      };
      entries.push(created);
      return jsonBody(route, created, 201);
    }
    return route.fulfill({ status: 204, body: '' });
  });
}

/** A weekday (Wednesday) in the currently displayed week, formatted yyyy-MM-dd. */
export function midWeekDateStr(): string {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 2); // Monday + 2 = Wednesday
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic E2E fixtures for the Timebooking frontend.
 *
 * Backend isolation:
 * Every request to the Express backend (`/api/**`, `/auth/**`, `/health`) is
 * intercepted via `page.route` and answered with a stable mock. The user is
 * mocked as logged out and all calendar/storage collections come back empty,
 * so a test run never depends on a live Express server, Google OAuth, or the
 * Google Calendar API. The dev build (`environment.local.ts`) actually uses
 * the Noop/IndexedDB adapters and issues no backend calls at all, so these
 * routes are a defensive safety net that also keeps the suite green if the
 * backend-enabled build is ever served.
 *
 * localStorage:
 * The app persists state under the `tb:` key prefix. Each test starts from a
 * clean slate (see `clearAppStorage`); use `seedLocalStorage` to set up state.
 */

type JsonBody = unknown;

function json(route: Route, body: JsonBody, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Install deterministic handlers for all backend endpoints the frontend may
 * call. Unmatched `/api/**` or `/auth/**` requests fall through to a catch-all
 * that returns an empty 200 so nothing ever hits the network.
 */
async function mockBackend(page: Page): Promise<void> {
  // Auth: always logged out.
  await page.route('**/auth/status', (route) => json(route, { authenticated: false }));

  // Health probe (called by the app shell after a delay).
  await page.route('**/health', (route) => json(route, { ok: true }));

  // Calendar events: empty.
  await page.route('**/api/calendar/events**', (route) => json(route, []));

  // Storage collections: empty arrays for list endpoints.
  await page.route('**/api/storage/entries**', (route) => json(route, []));
  await page.route('**/api/storage/projects**', (route) => json(route, []));
  await page.route('**/api/storage/dismissed-events**', (route) => json(route, []));
  await page.route('**/api/storage/recurring-mappings**', (route) => json(route, []));

  // Catch-all for any other backend call: empty success.
  await page.route('**/api/**', (route) => {
    const method = route.request().method();
    if (method === 'GET') return json(route, []);
    return route.fulfill({ status: 204, body: '' });
  });
}

/** Remove all `tb:`-prefixed keys so each test starts deterministically. */
export async function clearAppStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tb:')) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  });
}

/** Seed `tb:` localStorage entries, then reload so the app picks them up. */
export async function seedLocalStorage(
  page: Page,
  entries: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    }
  }, entries);
  await page.reload();
}

export const test = base.extend({
  page: async ({ page }, use) => {
    // Backend mocks must be registered before the first navigation.
    await mockBackend(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
