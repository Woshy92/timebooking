import { test, expect, clearAppStorage, installStatefulBackend, midWeekDateStr } from './fixtures';

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

const ENTRY_TITLE = 'Undo Testeintrag';

test('deleting an entry from the modal can be undone', async ({ page }) => {
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

  // The entry block renders in the calendar grid with its title.
  const entryBlock = page.getByText(ENTRY_TITLE, { exact: true });
  await expect(entryBlock).toBeVisible();

  // ── Open the entry modal (double-click) and delete ────────────────────
  await entryBlock.dblclick();
  const editDialog = page.getByRole('dialog', { name: 'Zeiteintrag bearbeiten' });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByRole('heading', { name: 'Zeiteintrag bearbeiten' })).toBeVisible();

  await editDialog.getByRole('button', { name: 'Löschen' }).click();

  // Entry is gone and the undo toast appears.
  await expect(page.getByText(ENTRY_TITLE, { exact: true })).toHaveCount(0);
  const undoButton = page.getByRole('button', { name: 'Rückgängig' });
  await expect(undoButton).toBeVisible();

  // ── Undo restores the entry ───────────────────────────────────────────
  await undoButton.click();
  await expect(page.getByText(ENTRY_TITLE, { exact: true })).toBeVisible();
  await expect(undoButton).toHaveCount(0);
});
