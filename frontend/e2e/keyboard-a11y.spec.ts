import { test, expect, clearAppStorage, installStatefulBackend, midWeekDateStr } from './fixtures';

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

const ENTRY_TITLE = 'Tastatur Testeintrag';

test('a focused entry block can be deleted with the keyboard and undone', async ({ page }) => {
  await installStatefulBackend(page);

  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();

  await expect(page).toHaveURL(/\/calendar$/);

  // ── Create an entry via the "Neu" button ──────────────────────────────
  await page.getByRole('button', { name: 'Neu', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Neuer Zeiteintrag' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Beschreibung', { exact: true }).fill(ENTRY_TITLE);
  await dialog.getByLabel('Datum').fill(midWeekDateStr());
  await dialog.getByLabel('Von').fill('09:00');
  await dialog.getByLabel('Bis').fill('10:00');

  await dialog.getByRole('button', { name: 'Erstellen' }).click();

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
