import { test, expect, clearAppStorage } from './fixtures';

/**
 * Minimal, robust smoke test for the E2E baseline.
 *
 * Intentionally asserts only on stable, top-level shell elements (the primary
 * navigation and the calendar-only top-bar controls) so it does not break when
 * other agents refactor the calendar view internals in parallel. It relies on
 * role/name selectors and Playwright auto-waiting — no fixed sleeps.
 */
test('app loads and the calendar view is visible', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);

  // Primary navigation renders with the German nav links.
  const nav = page.getByRole('navigation');
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Kalender' })).toBeVisible();

  // The default route ('') redirects to the calendar view; its top-bar
  // controls only render on the calendar route, so they signal that the
  // calendar shell mounted successfully.
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole('button', { name: 'Woche', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tag', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Neu', exact: true })).toBeVisible();
});
