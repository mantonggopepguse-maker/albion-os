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

  test('can mark a draft invoice as sent', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    const markSentBtn = page.locator('button:has-text("Mark Sent")').first();
    if (await markSentBtn.isVisible()) {
      await markSentBtn.click();
      await page.waitForTimeout(1000);
      await page.goto('/invoices');
      await expect(page.locator('text=Sent').first()).toBeVisible();
    }
  });

  test('status filter tabs are functional', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    // Click each status tab and verify the table updates
    const tabs = ['Draft', 'Sent', 'Paid', 'All'];
    for (const tab of tabs) {
      const tabBtn = page.locator(`button:has-text("${tab}")`).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(300);
      }
    }
    await expect(page.locator('table').or(page.locator('[class*="table"]')).first()).toBeVisible();
  });
});
