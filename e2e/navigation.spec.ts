import { test, expect } from '@playwright/test';

/**
 * These tests assume you're running against local Supabase (or mock-auth mode).
 * If the app redirects to /login, use the demo login credentials.
 */

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('text=Dr. Emeka (Admin)').click();
  await page.waitForURL('**/dashboard');
}

test.describe('Navigation', () => {
  test('sidebar shows all nav items for super_admin', async ({ page }) => {
    await loginAsAdmin(page);

    const navLinks = [
      'Dashboard',
      'Products',
      'Inventory',
      'Customers',
      'Invoices',
      'Payments',
      'Reports',
      'Staff',
      'Chat',
    ];

    for (const link of navLinks) {
      await expect(page.locator(`nav:has-text("${link}")`)).toBeVisible();
    }
  });

  test('can navigate to every page', async ({ page }) => {
    await loginAsAdmin(page);

    const pages = [
      { link: 'Dashboard', url: '/dashboard' },
      { link: 'Products', url: '/products' },
      { link: 'Inventory', url: '/inventory' },
      { link: 'Customers', url: '/customers' },
      { link: 'Invoices', url: '/invoices' },
      { link: 'Payments', url: '/payments' },
      { link: 'Reports', url: '/reports' },
      { link: 'Staff', url: '/staff' },
      { link: 'Chat', url: '/chat' },
    ];

    for (const { link, url } of pages) {
      await page.locator(`nav >> text="${link}"`).first().click();
      await page.waitForURL(`**${url}`);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('topbar shows user name and role badge', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.locator('text=Dr. Emeka Moneke')).toBeVisible();
    await expect(page.locator('text=Super Admin')).toBeVisible();
  });
});
