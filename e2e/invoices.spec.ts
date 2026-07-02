import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('text=Dr. Emeka (Admin)').click();
  await page.waitForURL('**/dashboard');
}

test.describe('Invoices', () => {
  test('invoices page loads with invoice table', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    await expect(page.locator('h1, h2').first()).toContainText('Invoice');
    await expect(page.locator('table').or(page.locator('[class*="card"]')).first()).toBeVisible();
  });

  test('invoice list shows invoice numbers', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    await expect(page.locator('text=INV-').first()).toBeVisible();
  });

  test('can click an invoice to view details', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    const invoiceLink = page.locator('a:has-text("INV-")').first();
    await expect(invoiceLink).toBeVisible();
    await invoiceLink.click();
    await page.waitForURL('**/invoices/**');
    await expect(page.locator('text=Invoice').or(page.locator('text=Print')).first()).toBeVisible();
  });

  test('print page loads for an invoice', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    const invoiceLink = page.locator('a:has-text("INV-")').first();
    const href = await invoiceLink.getAttribute('href');
    if (href) {
      await page.goto(`${href}/print`);
      await expect(page.locator('text=Print').or(page.locator('text=Invoice')).first()).toBeVisible();
    }
  });
});
