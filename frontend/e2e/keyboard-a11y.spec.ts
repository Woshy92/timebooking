import { test, expect, clearAppStorage } from './fixtures';
import type { Page, Route } from '@playwright/test';

/**
 * E2E: a time-entry block must be deletable with the keyboard alone.
 *
 * Covers TASK-0008 AC#1/#6: entry blocks are focusable (role="button",
 * tabindex="0"); pressing Delete on a focused block removes the entry through
 * the undoable single-delete path, so the entry disappears and the undo toast
 * ("Rückgängig") appears.
 *
 * Determinism:
 * - A small stateful in-memory backend is installed via page.route (mirrors
 *   e2e/undo-delete.spec.ts) so the create -> delete flow round-trips through
 *   the ApiStorageAdapter without a real Express/Google backend. One project is
 *   seeded so the entry form (projectId required) validates.
 * - Keyboard-only: the block is focused via the DOM (.focus(), not a mouse
 *   click) and deleted via page.keyboard.press('Delete'). No mouse interaction
 *   drives the deletion.
 * - Only role/text selectors and Playwright auto-waiting are used; no sleeps.
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
const ENTRY_TITLE = 'Tastatur Testeintrag';

/** Install a stateful mock backend for the storage endpoints used in this flow. */
async function installStatefulBackend(page: Page): Promise<void> {
  const entries: StoredEntry[] = [];
  let seq = 0;

  const jsonBody = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/storage/projects**', (route) => {
    if (route.request().method() === 'GET') return jsonBody(route, [PROJECT]);
    return route.fulfill({ status: 204, body: '' });
  });

  // Batch delete (used by the single-entry delete path on calendar blocks).
  await page.route('**/api/storage/entries/delete-batch', async (route) => {
    const { ids } = (route.request().postDataJSON() ?? {}) as { ids: string[] };
    for (const id of ids ?? []) {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx !== -1) entries.splice(idx, 1);
    }
    return jsonBody(route, []);
  });

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

test('a focused entry block can be deleted with the keyboard and undone', async ({ page }) => {
  await installStatefulBackend(page);

  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();

  await expect(page).toHaveURL(/\/calendar$/);

  // ── Create an entry via the "Neu" button ──────────────────────────────
  await page.getByRole('button', { name: 'Neu', exact: true }).click();

  const form = page.locator('app-time-entry-form form');
  await expect(form).toBeVisible();

  await form.getByPlaceholder('Beschreibung der Tätigkeit').fill(ENTRY_TITLE);
  await form.locator('input[formControlName="date"]').fill(midWeekDateStr());
  await form.locator('input[formControlName="startTime"]').fill('09:00');
  await form.locator('input[formControlName="endTime"]').fill('10:00');

  await form.getByRole('button', { name: 'Erstellen' }).click();

  // The entry block renders as a focusable role="button" carrying the title in
  // its accessible name (Titel · Projekt · Zeitraum).
  const entryBlock = page.getByRole('button', { name: new RegExp(`^${ENTRY_TITLE} ·`) });
  await expect(entryBlock).toBeVisible();
  await expect(entryBlock).toHaveAttribute('tabindex', '0');

  // ── Keyboard-only delete: focus the block, press Delete ────────────────
  await entryBlock.focus();
  await expect(entryBlock).toBeFocused();
  await page.keyboard.press('Delete');

  // The entry is gone and the undo toast appears.
  await expect(page.getByText(ENTRY_TITLE, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
});
