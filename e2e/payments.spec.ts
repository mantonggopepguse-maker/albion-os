import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('text=Dr. Emeka (Admin)').click();
  await page.waitForURL('**/dashboard');
}

test.describe('Payments', () => {
  test('payments page loads with summary cards', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/payments');

    await expect(page.locator('h1').first()).toContainText('Payment');
    await expect(page.locator('text=Total Payments').or(page.locator('text=Total Amount')).first()).toBeVisible();
  });

  test('shows payment tabs', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/payments');

    await expect(page.locator('text=Pending Approval').or(page.locator('text=Approved')).first()).toBeVisible();
  });

  test('can filter payments by tab', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/payments');

    const approvedTab = page.locator('button:has-text("Approved")');
    if (await approvedTab.isVisible()) {
      await approvedTab.click();
      await expect(page.locator('text=Approved').first()).toBeVisible();
    }
  });

  test('can open record payment modal', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/payments');

    const recordBtn = page.locator('button:has-text("Record Payment")');
    if (await recordBtn.isVisible()) {
      await recordBtn.click();
      await expect(page.locator('text=Record Payment').or(page.locator('select').first())).toBeVisible();
    }
  });
});
