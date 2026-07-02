import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('text=Dr. Emeka (Admin)').click();
  await page.waitForURL('**/dashboard');
}

test.describe('Staff Management', () => {
  test('staff page loads with user table', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/staff');

    await expect(page.locator('h1, h2').first()).toContainText('Staff');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=Chidi Okafor')).toBeVisible();
    await expect(page.locator('text=Ngozi Eze')).toBeVisible();
  });

  test('can open add staff modal', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/staff');

    await page.locator('button:has-text("Add Staff")').click();
    await expect(page.locator('h2:has-text("Add Staff")')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="full_name"]')).toBeVisible();
  });

  test('add staff modal validates empty fields', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/staff');

    await page.locator('button:has-text("Add Staff")').click();
    await page.locator('button:has-text("Add Staff")').last().click();

    await expect(page.locator('text=required')).toBeVisible();
  });

  test('CEO view shows deleted toggle', async ({ page }) => {
    await page.goto('/login');
    await page.locator('text=Chief Executive (CEO)').click();
    await page.waitForURL('**/dashboard');
    await page.goto('/staff');

    await expect(page.locator('text=Show Deleted')).toBeVisible();
  });
});
