import { test, expect, clearAppStorage } from './fixtures';
import type { Page, Route } from '@playwright/test';

/**
 * E2E: deleting a time entry from the entry modal must be undoable.
 *
 * Covers TASK-0006 AC#1/#4: the modal delete button pushes the entry into the
 * UndoStore, the undo toast appears, and "Rückgängig" restores the entry.
 *
 * Determinism:
 * - A small stateful in-memory backend is installed via page.route (overrides
 *   the fixture's empty-collection mocks) so the create -> delete -> undo flow
 *   round-trips through the ApiStorageAdapter without a real Express/Google
 *   backend. One project is seeded so the entry form (projectId required) is
 *   valid.
 * - Only role/text/test-id selectors and Playwright auto-waiting are used; no
 *   fixed sleeps.
 */

interface StoredEntry {
  id: string;
  title: string;
  start: string;
  end: string;
  projectId: string;
  source: string;
  notes?: string;
}

const PROJECT = { id: 'p1', name: 'Beratung', color: '#6366F1', archived: false };
const ENTRY_TITLE = 'Undo Testeintrag';

/** Install a stateful mock backend for the storage endpoints used in this flow. */
async function installStatefulBackend(page: Page): Promise<void> {
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
function midWeekDateStr(): string {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 2); // Monday + 2 = Wednesday
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('deleting an entry from the modal can be undone', async ({ page }) => {
  await installStatefulBackend(page);

  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();

  await expect(page).toHaveURL(/\/calendar$/);

  // ── Create an entry via the "Neu" button ──────────────────────────────
  await page.getByRole('button', { name: 'Neu', exact: true }).click();

  // The modal (app-modal) is not an ARIA dialog; scope to its <form> instead.
  const form = page.locator('app-time-entry-form form');
  await expect(form).toBeVisible();

  await form.getByPlaceholder('Beschreibung der Tätigkeit').fill(ENTRY_TITLE);
  await form.locator('input[formControlName="date"]').fill(midWeekDateStr());
  await form.locator('input[formControlName="startTime"]').fill('09:00');
  await form.locator('input[formControlName="endTime"]').fill('10:00');

  await form.getByRole('button', { name: 'Erstellen' }).click();

  // The entry block renders in the calendar grid with its title.
  const entryBlock = page.getByText(ENTRY_TITLE, { exact: true });
  await expect(entryBlock).toBeVisible();

  // ── Open the entry modal (double-click) and delete ────────────────────
  await entryBlock.dblclick();
  const editForm = page.locator('app-time-entry-form form');
  await expect(editForm).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Zeiteintrag bearbeiten' })).toBeVisible();

  await editForm.getByRole('button', { name: 'Löschen' }).click();

  // Entry is gone and the undo toast appears.
  await expect(page.getByText(ENTRY_TITLE, { exact: true })).toHaveCount(0);
  const undoButton = page.getByRole('button', { name: 'Rückgängig' });
  await expect(undoButton).toBeVisible();

  // ── Undo restores the entry ───────────────────────────────────────────
  await undoButton.click();
  await expect(page.getByText(ENTRY_TITLE, { exact: true })).toBeVisible();
  await expect(undoButton).toHaveCount(0);
});
