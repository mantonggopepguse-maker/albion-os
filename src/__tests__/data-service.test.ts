import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateInvoiceNumber,
  transitionInvoice,
  approvePayment,
  reconcileCash,
  recordPayment,
  allocateStock,
  stockTake,
  createInvoice,
  addCustomer,
  addProduct,
  getCustomers,
  addStaffUser,
  toggleUserStatus,
  updateStaffUser,
  updateCustomer,
  updateProduct,
} from '@/lib/data-service';
import {
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_CUSTOMERS,
  MOCK_INVENTORY,
  MOCK_USERS,
} from '@/lib/mock-data';

let invoicesSnapshot: typeof MOCK_INVOICES;
let paymentsSnapshot: typeof MOCK_PAYMENTS;
let customersSnapshot: typeof MOCK_CUSTOMERS;
let inventorySnapshot: typeof MOCK_INVENTORY;
let usersSnapshot: typeof MOCK_USERS;

function saveSnapshots() {
  invoicesSnapshot = JSON.parse(JSON.stringify(MOCK_INVOICES));
  paymentsSnapshot = JSON.parse(JSON.stringify(MOCK_PAYMENTS));
  customersSnapshot = JSON.parse(JSON.stringify(MOCK_CUSTOMERS));
  inventorySnapshot = JSON.parse(JSON.stringify(MOCK_INVENTORY));
  usersSnapshot = JSON.parse(JSON.stringify(MOCK_USERS));
}

function restoreSnapshots() {
  MOCK_INVOICES.length = 0;
  MOCK_INVOICES.push(...invoicesSnapshot);
  MOCK_PAYMENTS.length = 0;
  MOCK_PAYMENTS.push(...paymentsSnapshot);
  MOCK_CUSTOMERS.length = 0;
  MOCK_CUSTOMERS.push(...customersSnapshot);
  MOCK_INVENTORY.length = 0;
  MOCK_INVENTORY.push(...inventorySnapshot);
  MOCK_USERS.length = 0;
  MOCK_USERS.push(...usersSnapshot);
}

beforeEach(() => {
  saveSnapshots();
});

afterEach(() => {
  restoreSnapshots();
});

describe('generateInvoiceNumber', () => {
  it('returns a string matching the INV-YYYY-XXXXX timestamp-based format', () => {
    const num = generateInvoiceNumber();
    expect(num).toMatch(/^INV-\d{4}-[0-9A-Z]{5}$/);
  });

  it('generates unique numbers on successive calls', () => {
    const a = generateInvoiceNumber();
    const b = generateInvoiceNumber();
    expect(a).not.toBe(b);
  });
});

describe('transitionInvoice', () => {
  it('rejects transition from draft to paid (skipping sent)', async () => {
    const result = await transitionInvoice('inv-0005-draft', 'paid');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot transition');
  });

  it('allows draft to sent', async () => {
    const result = await transitionInvoice('inv-0005-draft', 'sent');
    expect(result.success).toBe(true);
    const inv = MOCK_INVOICES.find((i) => i.id === 'inv-0005-draft');
    expect(inv?.status).toBe('sent');
  });

  it('allows sent to paid', async () => {
    const result = await transitionInvoice('inv-0004-sent', 'paid');
    expect(result.success).toBe(true);
    expect(MOCK_INVOICES.find((i) => i.id === 'inv-0004-sent')?.status).toBe('paid');
  });

  it('allows sent to partial', async () => {
    const result = await transitionInvoice('inv-0004-sent', 'partial');
    expect(result.success).toBe(true);
  });

  it('allows overdue to paid', async () => {
    const result = await transitionInvoice('inv-0003-overdue', 'paid');
    expect(result.success).toBe(true);
  });

  it('rejects paid to any (terminal state)', async () => {
    const result = await transitionInvoice('inv-0001-paid', 'draft');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent invoice', async () => {
    const result = await transitionInvoice('does-not-exist', 'paid');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invoice not found');
  });
});

describe('approvePayment', () => {
  it('marks payment as approved and updates invoice status to paid when fully settled', async () => {
    const invoice = MOCK_INVOICES.find((i) => i.id === 'inv-0004-sent')!;
    const invoiceTotal = invoice.total;
    const customer = MOCK_CUSTOMERS.find((c) => c.id === invoice.customer_id)!;
    const originalBalance = customer.outstanding_balance;

    const payResult = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: invoice.customer_id,
      amount: invoiceTotal,
      method: 'cash',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: null,
      notes: null,
    });
    expect(payResult.success).toBe(true);

    const result = await approvePayment(payResult.data!.id, 'c3d4e5f6-a7b8-9012-cdef-123456789012');
    expect(result.success).toBe(true);

    const updatedInvoice = MOCK_INVOICES.find((i) => i.id === 'inv-0004-sent')!;
    expect(updatedInvoice.status).toBe('paid');

    const updatedCustomer = MOCK_CUSTOMERS.find((c) => c.id === invoice.customer_id)!;
    expect(updatedCustomer.outstanding_balance).toBe(
      Math.max(0, originalBalance - invoiceTotal)
    );
  });

  it('marks payment as approved and updates invoice status to partial for underpayment', async () => {
    const invoice = MOCK_INVOICES.find((i) => i.id === 'inv-0004-sent')!;
    const customer = MOCK_CUSTOMERS.find((c) => c.id === invoice.customer_id)!;
    const originalBalance = customer.outstanding_balance;

    const payResult = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: invoice.customer_id,
      amount: 50000,
      method: 'cash',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: null,
      notes: null,
    });
    expect(payResult.success).toBe(true);

    const result = await approvePayment(payResult.data!.id, 'c3d4e5f6-a7b8-9012-cdef-123456789012');
    expect(result.success).toBe(true);

    const updatedInvoice = MOCK_INVOICES.find((i) => i.id === 'inv-0004-sent')!;
    expect(updatedInvoice.status).toBe('partial');

    const updatedCustomer = MOCK_CUSTOMERS.find((c) => c.id === invoice.customer_id)!;
    expect(updatedCustomer.outstanding_balance).toBe(originalBalance - 50000);
  });

  it('rejects approval of an already-approved payment', async () => {
    const result = await approvePayment('pay-0001-approved', 'c3d4e5f6-a7b8-9012-cdef-123456789012');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment is not pending');
  });

  it('rejects payment that exceeds remaining balance', async () => {
    const invoice = MOCK_INVOICES.find((i) => i.id === 'inv-0004-sent')!;
    const existingApproved = MOCK_PAYMENTS
      .filter((p) => p.invoice_id === 'inv-0004-sent' && p.status === 'approved')
      .reduce((s, p) => s + p.amount, 0);
    const remaining = invoice.total - existingApproved;

    const payResult = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: invoice.customer_id,
      amount: remaining + 1,
      method: 'cash',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: null,
      notes: null,
    });
    expect(payResult.success).toBe(true);

    const result = await approvePayment(payResult.data!.id, 'c3d4e5f6-a7b8-9012-cdef-123456789012');
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds');
  });
});

describe('reconcileCash', () => {
  it('rejects reconciliation of a non-cash payment', async () => {
    const result = await reconcileCash('pay-0003-pending', 'c3d4e5f6-a7b8-9012-cdef-123456789012');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Only cash payments can be reconciled');
  });

  it('rejects reconciliation of a non-pending payment', async () => {
    const result = await reconcileCash('pay-0002-approved', 'c3d4e5f6-a7b8-9012-cdef-123456789012');
    expect(result.success).toBe(false);
  });

  it('reconciles and approves a pending cash payment', async () => {
    const invoice = MOCK_INVOICES.find((i) => i.id === 'inv-0004-sent')!;
    const payResult = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: invoice.customer_id,
      amount: 100000,
      method: 'cash',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: null,
      notes: null,
    });
    expect(payResult.success).toBe(true);

    const result = await reconcileCash(payResult.data!.id, 'c3d4e5f6-a7b8-9012-cdef-123456789012');
    expect(result.success).toBe(true);

    const updated = MOCK_PAYMENTS.find((p) => p.id === payResult.data!.id);
    expect(updated?.status).toBe('approved');
  });
});

describe('recordPayment', () => {
  it('rejects bank_transfer without proof_url', async () => {
    const result = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: 'cust-0001-vetzone',
      amount: 50000,
      method: 'bank_transfer',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: null,
      notes: null,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('receipt upload');
  });

  it('accepts bank_transfer with proof_url', async () => {
    const result = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: 'cust-0001-vetzone',
      amount: 50000,
      method: 'bank_transfer',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: '/uploads/receipts/test.jpg',
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects amount <= 0', async () => {
    const result = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: 'cust-0001-vetzone',
      amount: 0,
      method: 'cash',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: null,
      notes: null,
    });
    expect(result.success).toBe(false);
  });

  it('creates a pending payment', async () => {
    const result = await recordPayment({
      invoice_id: 'inv-0004-sent',
      customer_id: 'cust-0001-vetzone',
      amount: 75000,
      method: 'cash',
      recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      proof_url: null,
      notes: 'Test payment',
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('pending');
    expect(result.data?.notes).toBe('Test payment');
  });
});

describe('allocateStock (FEFO)', () => {
  it('rejects allocation with quantity <= 0', async () => {
    const result = await allocateStock({
      product_id: 'prod-0001-ivermectin',
      from_location_id: 'loc-0001-onitsha-hq',
      to_location_id: 'loc-0002-lagos-territory',
      quantity: 0,
      batch_number: 'TEST',
    });
    expect(result.success).toBe(false);
  });

  it('rejects allocation when source has no stock', async () => {
    const result = await allocateStock({
      product_id: 'prod-0001-ivermectin',
      from_location_id: 'loc-0004-delta-clinic',
      to_location_id: 'loc-0002-lagos-territory',
      quantity: 10,
      batch_number: 'TEST',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No stock found');
  });

  it('deducts from earliest-expiring batch first (FEFO)', async () => {
    MOCK_INVENTORY.push({
      id: 'stk-test-fefo',
      product_id: 'prod-0001-ivermectin',
      location_id: 'loc-0001-onitsha-hq',
      quantity: 100,
      batch_number: 'BATCH-IVM-EARLY',
      expiry_date: '2027-01-01T00:00:00.000Z',
      status: 'in_stock',
    });

    const batchBefore = MOCK_INVENTORY.find((i) => i.id === 'stk-test-fefo')!;
    expect(batchBefore.quantity).toBe(100);

    const result = await allocateStock({
      product_id: 'prod-0001-ivermectin',
      from_location_id: 'loc-0001-onitsha-hq',
      to_location_id: 'loc-0002-lagos-territory',
      quantity: 30,
      batch_number: 'TEST-FEFO',
    });
    expect(result.success).toBe(true);

    expect(batchBefore.quantity).toBe(70);

    const dest = MOCK_INVENTORY.find(
      (i) => i.product_id === 'prod-0001-ivermectin' &&
        i.location_id === 'loc-0002-lagos-territory'
    );
    expect(dest).toBeDefined();
    expect(dest!.quantity).toBe(30);
    expect(dest!.batch_number).toContain('ALLOC-');
  });

  it('returns insufficient stock error when quantity exceeds available', async () => {
    const result = await allocateStock({
      product_id: 'prod-0004-calcium',
      from_location_id: 'loc-0001-onitsha-hq',
      to_location_id: 'loc-0002-lagos-territory',
      quantity: 100,
      batch_number: 'TEST-INSUFFICIENT',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient stock');
  });
});

describe('stockTake', () => {
  it('adjusts quantity and records difference', async () => {
    const item = MOCK_INVENTORY.find((i) => i.id === 'stk-0001')!;
    const originalQty = item.quantity;

    const result = await stockTake({ inventory_id: 'stk-0001', actual_quantity: 400, notes: 'Physical count' });
    expect(result.success).toBe(true);
    expect(result.data!.difference).toBe(400 - originalQty);
    expect(MOCK_INVENTORY.find((i) => i.id === 'stk-0001')!.quantity).toBe(400);
  });

  it('sets status to out_of_stock when quantity is 0', async () => {
    const result = await stockTake({ inventory_id: 'stk-0001', actual_quantity: 0 });
    expect(result.success).toBe(true);
    expect(MOCK_INVENTORY.find((i) => i.id === 'stk-0001')!.status).toBe('out_of_stock');
  });

  it('rejects negative quantity', async () => {
    const result = await stockTake({ inventory_id: 'stk-0001', actual_quantity: -5 });
    expect(result.success).toBe(false);
  });
});

describe('createInvoice', () => {
  it('creates an invoice with correct totals (7.5% VAT)', async () => {
    const result = await createInvoice({
      customer_id: 'cust-0001-vetzone',
      sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      location_id: 'loc-0001-onitsha-hq',
      items: [
        { product_id: 'prod-0001-ivermectin', quantity: 10 },
        { product_id: 'prod-0002-oxytet', quantity: 5 },
      ],
      due_date: '2026-08-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const invoice = result.data!;
    expect(invoice.subtotal).toBe(10 * 8500 + 5 * 12000);
    expect(invoice.vat).toBe(Math.round(145000 * 0.075));
    expect(invoice.total).toBe(145000 + 10875);
    expect(invoice.status).toBe('draft');
    expect(invoice.invoice_number).toMatch(/^INV-\d{4}-[0-9A-Z]{5}$/);
  });

  it('rejects empty item list', async () => {
    const result = await createInvoice({
      customer_id: 'cust-0001-vetzone',
      sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      location_id: 'loc-0001-onitsha-hq',
      items: [],
      due_date: '2026-08-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('line item');
  });

  it('rejects unknown product', async () => {
    const result = await createInvoice({
      customer_id: 'cust-0001-vetzone',
      sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      location_id: 'loc-0001-onitsha-hq',
      items: [{ product_id: 'prod-nonexistent', quantity: 1 }],
      due_date: '2026-08-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product not found');
  });
});

describe('addCustomer', () => {
  it('rejects empty name', async () => {
    const result = await addCustomer({
      name: '',
      business_name: 'Test Biz',
      phone: '+234 800 000 0000',
      email: null,
      address: '123 Test',
      state: 'Lagos',
      credit_limit: 50000,
      location_id: 'loc-0001-onitsha-hq',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Customer name');
  });

  it('rejects negative credit limit', async () => {
    const result = await addCustomer({
      name: 'Test',
      business_name: 'Test Biz',
      phone: '+234 800 000 0000',
      email: null,
      address: '123 Test',
      state: 'Lagos',
      credit_limit: -100,
      location_id: 'loc-0001-onitsha-hq',
    });
    expect(result.success).toBe(false);
  });

  it('creates a customer with zero outstanding balance', async () => {
    const result = await addCustomer({
      name: 'Test Customer',
      business_name: 'Test Biz',
      phone: '+234 800 000 0000',
      email: 'test@example.com',
      address: '123 Test Street',
      state: 'Lagos',
      credit_limit: 500000,
      location_id: 'loc-0001-onitsha-hq',
    });
    expect(result.success).toBe(true);
    expect(result.data?.outstanding_balance).toBe(0);
    expect(result.data?.is_active).toBe(true);
    expect(await getCustomers()).toContainEqual(result.data);
  });
});

describe('addProduct', () => {
  it('rejects duplicate SKU', async () => {
    const result = await addProduct({
      name: 'Duplicate',
      sku: 'ALB-IVM-100',
      nafdac_number: 'NAFDAC/TEST/0001',
      unit_price: 5000,
      category: 'injectable',
      description: null,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('SKU');
    expect(result.error).toContain('already exists');
  });

  it('rejects price <= 0', async () => {
    const result = await addProduct({
      name: 'Test Product',
      sku: 'ALB-TEST-001',
      nafdac_number: 'NAFDAC/TEST/0001',
      unit_price: 0,
      category: 'injectable',
      description: null,
    });
    expect(result.success).toBe(false);
  });

  it('creates a product with uppercase SKU', async () => {
    const result = await addProduct({
      name: 'Test Product',
      sku: 'alb-test-999',
      nafdac_number: 'NAFDAC/TEST/0999',
      unit_price: 2500,
      category: 'bolus',
      description: 'Test product',
    });
    expect(result.success).toBe(true);
    expect(result.data?.sku).toBe('ALB-TEST-999');
    expect(result.data?.is_active).toBe(true);
  });
});

describe('addStaffUser', () => {
  it('rejects empty email', async () => {
    const result = await addStaffUser({
      email: '',
      full_name: 'Test Staff',
      role: 'sales_rep',
      location_id: 'loc-0001-onitsha-hq',
      phone: '+234 800 000 0000',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Email');
  });

  it('rejects empty full name', async () => {
    const result = await addStaffUser({
      email: 'test@albionpharma.com',
      full_name: '',
      role: 'sales_rep',
      location_id: 'loc-0001-onitsha-hq',
      phone: null,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Full name');
  });

  it('rejects duplicate email', async () => {
    const result = await addStaffUser({
      email: 'chidi@albionpharma.com',
      full_name: 'Duplicate',
      role: 'sales_rep',
      location_id: null,
      phone: null,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('creates a staff user with is_active = true', async () => {
    const result = await addStaffUser({
      email: 'newstaff@albionpharma.com',
      full_name: 'New Staff',
      role: 'sales_rep',
      location_id: 'loc-0002-lagos-territory',
      phone: '+234 800 123 4567',
    });
    expect(result.success).toBe(true);
    expect(result.data?.is_active).toBe(true);
    expect(result.data?.email).toBe('newstaff@albionpharma.com');
    expect(result.data?.role).toBe('sales_rep');
    expect(MOCK_USERS).toContainEqual(result.data);
  });
});

describe('toggleUserStatus', () => {
  it('returns error for non-existent user', async () => {
    const result = await toggleUserStatus('non-existent-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  it('toggles active user to inactive (suspend)', async () => {
    const result = await toggleUserStatus('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(result.success).toBe(true);
    expect(result.data?.is_active).toBe(false);
    const user = MOCK_USERS.find((u) => u.id === 'b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(user?.is_active).toBe(false);
  });

  it('toggles inactive user to active (restore)', async () => {
    await toggleUserStatus('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    const result = await toggleUserStatus('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(result.success).toBe(true);
    expect(result.data?.is_active).toBe(true);
  });
});

describe('updateStaffUser', () => {
  it('returns error for non-existent user', async () => {
    const result = await updateStaffUser('non-existent-id', { full_name: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  it('updates full_name and role', async () => {
    const result = await updateStaffUser('b2c3d4e5-f6a7-8901-bcde-f12345678901', {
      full_name: 'Chidi Updated',
      role: 'inventory_manager',
    });
    expect(result.success).toBe(true);
    expect(result.data?.full_name).toBe('Chidi Updated');
    expect(result.data?.role).toBe('inventory_manager');
  });

  it('rejects duplicate email on update', async () => {
    const result = await updateStaffUser('b2c3d4e5-f6a7-8901-bcde-f12345678901', {
      email: 'ngozi@albionpharma.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('updates email when no duplicate', async () => {
    const result = await updateStaffUser('b2c3d4e5-f6a7-8901-bcde-f12345678901', {
      email: 'chidi.new@albionpharma.com',
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('chidi.new@albionpharma.com');
  });
});

describe('updateCustomer', () => {
  it('returns error for non-existent customer', async () => {
    const result = await updateCustomer('non-existent-id', { name: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Customer not found');
  });

  it('updates customer name, phone, and credit_limit', async () => {
    const result = await updateCustomer('cust-0001-vetzone', {
      name: 'VetZone Updated',
      phone: '+234 800 000 1111',
      credit_limit: 2000000,
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('VetZone Updated');
    expect(result.data?.phone).toBe('+234 800 000 1111');
    expect(result.data?.credit_limit).toBe(2000000);
  });

  it('sets email to null when explicitly passed as null', async () => {
    const result = await updateCustomer('cust-0001-vetzone', { email: null });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBeNull();
  });
});

describe('updateProduct', () => {
  it('returns error for non-existent product', async () => {
    const result = await updateProduct('non-existent-id', { name: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Product not found');
  });

  it('updates product name, price, and category', async () => {
    const result = await updateProduct('prod-0001-ivermectin', {
      name: 'Ivermectin 1% Inj Updated',
      unit_price: 9000,
      category: 'vaccine',
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Ivermectin 1% Inj Updated');
    expect(result.data?.unit_price).toBe(9000);
    expect(result.data?.category).toBe('vaccine');
  });

  it('rejects duplicate SKU on update', async () => {
    const result = await updateProduct('prod-0001-ivermectin', { sku: 'alb-oxy-200' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('updates SKU when no duplicate (uppercased)', async () => {
    const result = await updateProduct('prod-0001-ivermectin', { sku: 'alb-ivm-200' });
    expect(result.success).toBe(true);
    expect(result.data?.sku).toBe('ALB-IVM-200');
  });
});
