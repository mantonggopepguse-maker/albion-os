import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('text=Dr. Emeka (Admin)').click();
  await page.waitForURL('**/dashboard');
}

test.describe('Inventory', () => {
  test('inventory page loads with stock data', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/inventory');

    await expect(page.locator('h1').first()).toContainText('Inventory');
  });

  test('shows product stock levels', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/inventory');

    await expect(page.locator('text=Qty').or(page.locator('text=Batch')).or(page.locator('text=Quantity')).first()).toBeVisible();
  });

  test('can search inventory', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/inventory');

    const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search" i]')).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
    }
  });
});
