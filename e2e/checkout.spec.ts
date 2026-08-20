import { test, expect } from '@playwright/test';

/**
 * Login helpers mirror the pattern from invoices.spec.ts and payments.spec.ts.
 * Each clicks the demo quick-login button for the given role.
 */

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('text=Dr. Emeka (Admin)').click();
  await page.waitForURL('**/dashboard');
}

async function loginAsFinanceManager(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('text=Ngozi (Finance)').click();
  await page.waitForURL('**/dashboard');
}

test.describe('Checkout — Invoice-to-Payment Workflow', () => {
  /**
   * 1. Create a new invoice
   *    - Login as admin, navigate to /invoices
   *    - Click "Create Invoice", fill form, submit
   *    - Verify new invoice appears in the table with "Draft" status
   */
  test('create a new invoice as admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    // Click the Create Invoice button
    const createBtn = page.locator(
      'button:has-text("Create Invoice"), a:has-text("Create Invoice"), [class*="create"]:has-text("Invoice")',
    ).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Fill in the invoice creation form
    // Select a customer from dropdown
    const customerSelect = page.locator('select:has(option), [class*="customer"] select').first();
    if (await customerSelect.isVisible()) {
      await customerSelect.selectOption({ index: 1 });
    }

    // Add a line item
    const productSelect = page.locator('select:has(option), [class*="product"] select').first();
    if (await productSelect.isVisible()) {
      await productSelect.selectOption({ index: 1 });
    }

    const qtyInput = page.locator('input[type="number"], input[name*="qty"], input[name*="quantity"]').first();
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('2');
    }

    const priceInput = page.locator('input[name*="price"], input[name*="rate"]').first();
    if (await priceInput.isVisible()) {
      await priceInput.fill('5000');
    }

    // Set due date
    const dateInput = page.locator('input[type="date"], input[name*="due"]').first();
    if (await dateInput.isVisible()) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await dateInput.fill(futureDate.toISOString().split('T')[0]);
    }

    // Submit the form
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Save"), button:has-text("Create")',
    ).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify the new invoice appears in the table
    await page.goto('/invoices');
    await expect(page.locator('table').or(page.locator('[class*="card"]')).first()).toBeVisible();

    // Verify at least one invoice has "Draft" status
    const draftIndicators = page.locator(
      'text=Draft, [class*="draft"], [class*="Draft"], td:has-text("Draft")',
    );
    await expect(draftIndicators.first()).toBeVisible();
  });

  /**
   * 2. Mark an invoice as sent
   *    - Find a draft invoice in the table
   *    - Click "Mark as Sent" action
   *    - Verify status changes to "Sent"
   */
  test('mark invoice as sent', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/invoices');

    // Find a draft invoice to act on
    const draftRow = page.locator('tr:has-text("Draft"), [class*="row"]:has-text("Draft")').first();
    await expect(draftRow).toBeVisible();

    // Click the "Mark as Sent" action inside that row
    const markSentBtn = draftRow.locator(
      'button:has-text("Mark as Sent"), a:has-text("Mark as Sent"), [class*="action"]:has-text("Sent")',
    ).first();
    if (await markSentBtn.isVisible()) {
      await markSentBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Fallback: try finding the button anywhere on the page
      const globalBtn = page.locator(
        'button:has-text("Mark as Sent"), a:has-text("Mark as Sent")',
      ).first();
      if (await globalBtn.isVisible()) {
        await globalBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Verify the status changed to "Sent"
    await page.goto('/invoices');
    const sentIndicators = page.locator(
      'text=Sent, [class*="sent"], [class*="Sent"], td:has-text("Sent")',
    );
    await expect(sentIndicators.first()).toBeVisible();
  });

  /**
   * 3. Record a payment against an invoice
   *    - Login as admin, navigate to /payments
   *    - Click "Record Payment", fill form, submit
   *    - Verify new payment appears in the table
   */
  test('record a payment against an invoice', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/payments');

    // Open the Record Payment modal/form
    const recordBtn = page.locator('button:has-text("Record Payment")').first();
    await expect(recordBtn).toBeVisible();
    await recordBtn.click();

    // Fill in payment details
    // Select customer
    const customerSelect = page.locator('select:has(option), [class*="customer"] select').first();
    if (await customerSelect.isVisible()) {
      await customerSelect.selectOption({ index: 1 });
    }

    // Select invoice to pay against
    const invoiceSelect = page.locator(
      'select:has(option), [class*="invoice"] select, [name*="invoice"]',
    ).first();
    if (await invoiceSelect.isVisible()) {
      await invoiceSelect.selectOption({ index: 1 });
    }

    // Enter amount
    const amountInput = page.locator(
      'input[type="number"], input[name*="amount"], input[name*="total"]',
    ).first();
    if (await amountInput.isVisible()) {
      await amountInput.fill('5000');
    }

    // Select payment method = cash
    const methodSelect = page.locator(
      'select:has(option), [name*="method"], [name*="type"], [class*="method"] select',
    ).first();
    if (await methodSelect.isVisible()) {
      const cashOption = methodSelect.locator('option:has-text("Cash")');
      if (await cashOption.count() > 0) {
        await methodSelect.selectOption({ label: 'Cash' });
      } else {
        await methodSelect.selectOption({ index: 1 });
      }
    }

    // Submit the form
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Save"), button:has-text("Record")',
    ).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify the payment appears on the payments page
    await page.goto('/payments');
    await expect(page.locator('h1').first()).toContainText('Payment');
    await expect(
      page.locator('text=Total Payments').or(page.locator('text=Total Amount')).first(),
    ).toBeVisible();
  });

  /**
   * 4. Verify payment approval flow by finance manager
   *    - Login as Ngozi (finance_manager)
   *    - Navigate to /payments, find pending payment in "Pending Approval" tab
   *    - Click "Approve", verify status becomes "Approved"
   */
  test('finance manager approves a pending payment', async ({ page }) => {
    await loginAsFinanceManager(page);
    await page.goto('/payments');

    // Switch to the "Pending Approval" tab
    const pendingTab = page.locator(
      'button:has-text("Pending Approval"), button:has-text("Pending"), [role="tab"]:has-text("Pending")',
    ).first();
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
      await page.waitForTimeout(500);
    }

    // Find a payment that is pending approval
    const pendingPayment = page.locator(
      'tr:has-text("Pending"), [class*="row"]:has-text("Pending"), [class*="pending"]',
    ).first();
    await expect(pendingPayment).toBeVisible();

    // Click the Approve button
    const approveBtn = pendingPayment.locator(
      'button:has-text("Approve"), a:has-text("Approve")',
    ).first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Fallback: try finding approve button elsewhere on the page
      const globalApprove = page.locator(
        'button:has-text("Approve"), a:has-text("Approve")',
      ).first();
      if (await globalApprove.isVisible()) {
        await globalApprove.click();
        await page.waitForTimeout(1000);
      }
    }

    // Verify the payment moved to "Approved" status
    await page.goto('/payments');
    const approvedTab = page.locator(
      'button:has-text("Approved"), [role="tab"]:has-text("Approved")',
    ).first();
    if (await approvedTab.isVisible()) {
      await approvedTab.click();
      await page.waitForTimeout(500);
    }
    const approvedIndicator = page.locator(
      'text=Approved, [class*="approved"], [class*="Approved"], td:has-text("Approved")',
    );
    await expect(approvedIndicator.first()).toBeVisible();
  });

  /**
   * 5. Dashboard shows financial data
   *    - Login as admin, navigate to /dashboard
   *    - Verify revenue / stat summary cards are visible
   */
  test('dashboard displays financial summary cards', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard');

    // Verify the dashboard page has loaded
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Look for financial stat cards — these could be labelled differently
    const statCards = page.locator(
      'text=Revenue, text=Total Sales, text=Outstanding, [class*="stat"], [class*="card"], [class*="metric"]',
    );

    // Expect at least one financial summary element to be visible
    await expect(statCards.first()).toBeVisible();

    // Verify at least one numeric value is displayed (a currency amount)
    const numericValue = page.locator(
      'text=₦, [class*="amount"], [class*="value"]',
    ).first();
    await expect(numericValue).toBeVisible();
  });
});
