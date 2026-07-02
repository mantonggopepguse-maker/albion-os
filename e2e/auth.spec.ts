import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads and shows the form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h2')).toContainText('Welcome Back');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('shows quick-login demo buttons', async ({ page }) => {
    await page.goto('/login');

    const quickLoginSection = page.locator('text=Quick Login');
    await expect(quickLoginSection).toBeVisible();

    await expect(page.locator('text=Dr. Emeka (Admin)')).toBeVisible();
    await expect(page.locator('text=Chief Executive (CEO)')).toBeVisible();
    await expect(page.locator('text=Chidi (Sales)')).toBeVisible();
  });

  test('redirects to /login when accessing protected route unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    await expect(page.locator('h2')).toContainText('Welcome Back');
  });

  test('has link to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('text=Create an account').click();
    await page.waitForURL('**/signup');
    await expect(page.locator('h2')).toContainText('Create Account');
  });

  test('has link to forgot-password page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('text=Forgot password').click();
    await page.waitForURL('**/forgot-password');
    await expect(page.locator('h2')).toContainText('Reset Password');
  });

  test('signup page shows the registration form', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.locator('h2')).toContainText('Create Account');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Create Account');
  });

  test('forgot-password page shows the form', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.locator('h2')).toContainText('Reset Password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Send Reset Link');
  });
});
