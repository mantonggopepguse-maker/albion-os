import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, label: string) {
  await page.goto('/login');
  await page.locator(`text=${label}`).click();
  await page.waitForURL('**/dashboard');
}

test.describe('RLS — Role-Based Access Control', () => {

  /* ============================================================
     ▸ 1. Navigation Visibility
       Verify the sidebar only shows links permitted for the role.
     ============================================================ */

  test.describe('Navigation visibility per role', () => {

    test('sales_rep cannot see Staff, Payments, Payroll in nav', async ({ page }) => {
      await loginAs(page, 'Chidi (Sales)');

      // Should see
      await expect(page.locator('nav:has-text("Dashboard")')).toBeVisible();
      await expect(page.locator('nav:has-text("Invoices")')).toBeVisible();
      await expect(page.locator('nav:has-text("Customers")')).toBeVisible();
      await expect(page.locator('nav:has-text("Inventory")')).toBeVisible();

      // Should NOT see
      await expect(page.locator('nav:has-text("Staff")')).not.toBeVisible();
      await expect(page.locator('nav:has-text("Payments")')).not.toBeVisible();
      await expect(page.locator('nav:has-text("Payroll")')).not.toBeVisible();
    });

    test('finance_manager can see Payments but not Staff', async ({ page }) => {
      await loginAs(page, 'Ngozi (Finance)');

      await expect(page.locator('nav:has-text("Payments")')).toBeVisible();
      await expect(page.locator('nav:has-text("Invoices")')).toBeVisible();
      await expect(page.locator('nav:has-text("Reports")')).toBeVisible();
      await expect(page.locator('nav:has-text("Payroll")')).toBeVisible();

      await expect(page.locator('nav:has-text("Staff")')).not.toBeVisible();
      await expect(page.locator('nav:has-text("Products")')).not.toBeVisible();
    });

    test('inventory_manager sees Inventory but not Payments', async ({ page }) => {
      await loginAs(page, 'Tunde (Inventory)');

      await expect(page.locator('nav:has-text("Inventory")')).toBeVisible();
      await expect(page.locator('nav:has-text("Products")')).toBeVisible();

      await expect(page.locator('nav:has-text("Payments")')).not.toBeVisible();
      await expect(page.locator('nav:has-text("Invoices")')).not.toBeVisible();
      await expect(page.locator('nav:has-text("Customers")')).not.toBeVisible();
      await expect(page.locator('nav:has-text("Reports")')).not.toBeVisible();
    });

    test('CEO sees all nav items', async ({ page }) => {
      await loginAs(page, 'Chief Executive (CEO)');

      const allLinks = [
        'Dashboard', 'Products', 'Inventory', 'Customers',
        'Invoices', 'Payments', 'Reports', 'Payroll', 'Staff', 'Chat',
      ];

      for (const link of allLinks) {
        await expect(page.locator(`nav:has-text("${link}")`)).toBeVisible();
      }
    });

    test('super_admin sees all nav items', async ({ page }) => {
      await loginAs(page, 'Dr. Emeka (Admin)');

      const allLinks = [
        'Dashboard', 'Products', 'Inventory', 'Customers',
        'Invoices', 'Payments', 'Reports', 'Payroll', 'Staff', 'Chat',
      ];

      for (const link of allLinks) {
        await expect(page.locator(`nav:has-text("${link}")`)).toBeVisible();
      }
    });
  });

  /* ============================================================
     ▸ 2. Route Access Control (redirect to /dashboard)
       Verify middleware redirects unauthorized roles away from
       protected routes.
     ============================================================ */

  test.describe('Route access control', () => {

    test('sales_rep visiting /staff redirects to /dashboard', async ({ page }) => {
      await loginAs(page, 'Chidi (Sales)');
      await page.goto('/staff');
      await page.waitForURL('**/dashboard');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('sales_rep visiting /payments redirects to /dashboard', async ({ page }) => {
      await loginAs(page, 'Chidi (Sales)');
      await page.goto('/payments');
      await page.waitForURL('**/dashboard');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('sales_rep visiting /payroll redirects to /dashboard', async ({ page }) => {
      await loginAs(page, 'Chidi (Sales)');
      await page.goto('/payroll');
      await page.waitForURL('**/dashboard');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('inventory_manager visiting /payments redirects to /dashboard', async ({ page }) => {
      await loginAs(page, 'Tunde (Inventory)');
      await page.goto('/payments');
      await page.waitForURL('**/dashboard');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('finance_manager can visit /payments without redirect', async ({ page }) => {
      await loginAs(page, 'Ngozi (Finance)');
      await page.goto('/payments');
      await expect(page.locator('h1, h2').first()).toContainText('Payment');
    });
  });

  /* ============================================================
     ▸ 3. Data Isolation
       Verify role-scoped data visibility on key pages.
     ============================================================ */

  test.describe('Data isolation', () => {

    test('sales_rep on /invoices sees their own invoices', async ({ page }) => {
      await loginAs(page, 'Chidi (Sales)');
      await page.goto('/invoices');

      await expect(page.locator('h1, h2').first()).toContainText('Invoice');
      // Sales reps only see invoices they own — check for their name or identifier
      await expect(page.locator('text=Chidi').or(page.locator('text=INV-')).first()).toBeVisible();
    });

    test('sales_rep on /customers sees their own customers', async ({ page }) => {
      await loginAs(page, 'Chidi (Sales)');
      await page.goto('/customers');

      await expect(page.locator('h1, h2').first()).toContainText('Customer');
      // Sales rep's customers should be visible
      await expect(page.locator('table').or(page.locator('[class*="card"]')).first()).toBeVisible();
    });

    test('finance_manager on /payments sees payment verification queue', async ({ page }) => {
      await loginAs(page, 'Ngozi (Finance)');
      await page.goto('/payments');

      await expect(page.locator('h1, h2').first()).toContainText('Payment');
      // Finance manager sees pending approvals / verification queue
      await expect(page.locator('text=Pending').or(page.locator('text=Verify')).first()).toBeVisible();
    });

    test('inventory_manager on /inventory sees warehouse summary', async ({ page }) => {
      await loginAs(page, 'Tunde (Inventory)');
      await page.goto('/inventory');

      await expect(page.locator('h1, h2').first()).toContainText('Inventory');
      // Warehouse / stock-level data visible to inventory managers
      await expect(page.locator('text=Qty').or(page.locator('text=Batch')).or(page.locator('text=Stock')).first()).toBeVisible();
    });
  });
});
