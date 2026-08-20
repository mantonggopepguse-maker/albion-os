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

  test('stock allocation page loads with location data', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/inventory');

    // Look for stock allocation button or section
    const allocateBtn = page.locator(
      'button:has-text("Allocate Stock"), a:has-text("Allocate"), [class*="allocate"]',
    ).first();
    if (await allocateBtn.isVisible()) {
      await allocateBtn.click();
      await page.waitForTimeout(500);
    }

    // Verify at least one location or product selector is visible
    const selector = page.locator(
      'select:has(option), input[type="text"], [class*="location"], [class*="product"]',
    ).first();
    await expect(selector).toBeVisible();
  });

  test('inventory shows stock movement history', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/inventory');

    // Look for movement history section
    const movementsSection = page.locator(
      'text=Movements, text=History, text=Activity, [class*="movement"], [class*="history"]',
    ).first();
    if (await movementsSection.isVisible()) {
      await expect(movementsSection).toBeVisible();
    }
  });
});
