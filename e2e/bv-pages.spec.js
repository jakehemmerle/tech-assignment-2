const { test, expect } = require('@playwright/test');

test('page loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Poker Rewards/);
});

test('issue data loads and renders', async ({ page }) => {
  await page.goto('/');
  // The viewer loads SQLite via WASM then renders issues.
  // Navigate to the issues view and wait for content containing bead IDs.
  await page.click('a[href="#/issues"]');
  await expect(page.locator('body')).toContainText('p1-', { timeout: 15000 });
});

test('static assets load without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  const failedRequests = [];
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      failedRequests.push(`${resp.status()} ${resp.url()}`);
    }
  });

  await page.goto('/');
  await page.waitForTimeout(3000);

  expect(failedRequests).toEqual([]);
});
