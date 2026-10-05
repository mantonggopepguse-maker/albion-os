import { describe, expect, it } from 'vitest';
import type { Invoice, Payment } from '@/lib/types';

interface ReconciledReceipt {
  watermarkText: string;
  receiptHeading: string;
  amountPaid: number;
  balanceDue: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  isUnpaid: boolean;
  isCancelled: boolean;
}

/** Pure reconciliation logic matching InvoiceReceiptPage */
function reconcileReceipt(invoice: Invoice, payments: Payment[]): ReconciledReceipt {
  const approvedPayments = payments.filter(
    (p) => p.invoice_id === invoice.id && p.status === 'approved'
  );
  const totalApprovedPayments = approvedPayments.reduce((sum, p) => sum + p.amount, 0);

  const isMarkedPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';
  const amountPaid = isCancelled ? 0 : isMarkedPaid ? Math.max(invoice.total, totalApprovedPayments) : totalApprovedPayments;
  const balanceDue = isCancelled ? 0 : Math.max(0, invoice.total - amountPaid);
  const isFullyPaid = !isCancelled && (isMarkedPaid || (amountPaid >= invoice.total && invoice.total > 0));
  const isPartiallyPaid = !isCancelled && !isFullyPaid && amountPaid > 0;
  const isUnpaid = !isCancelled && !isFullyPaid && !isPartiallyPaid;

  let watermarkText = 'PAID';
  if (isCancelled) {
    watermarkText = 'CANCELLED';
  } else if (isFullyPaid) {
    watermarkText = 'PAID';
  } else if (isPartiallyPaid) {
    watermarkText = 'PARTIAL';
  } else {
    watermarkText = invoice.status === 'draft' ? 'DRAFT' : 'UNPAID';
  }

  let receiptHeading = 'OFFICIAL RECEIPT';
  if (isCancelled) receiptHeading = 'VOID SALES RECORD';
  else if (isPartiallyPaid) receiptHeading = 'PAYMENT STATEMENT / PARTIAL RECEIPT';
  else if (isUnpaid) receiptHeading = 'PAYMENT STATEMENT (UNPAID)';

  return {
    watermarkText,
    receiptHeading,
    amountPaid,
    balanceDue,
    isFullyPaid,
    isPartiallyPaid,
    isUnpaid,
    isCancelled,
  };
}

describe('Truthful Invoice Receipt Reconciliation', () => {
  const sampleInvoice: Invoice = {
    id: 'inv-test-1',
    invoice_number: 'INV-2026-001',
    customer_id: 'cust-1',
    sales_rep_id: 'rep-1',
    status: 'draft',
    subtotal: 100000,
    vat: 7500,
    total: 107500,
    items: [],
    created_at: new Date().toISOString(),
  };

  it('renders draft invoice with DRAFT watermark, zero paid, and full balance due', () => {
    const res = reconcileReceipt(sampleInvoice, []);
    expect(res.watermarkText).toBe('DRAFT');
    expect(res.receiptHeading).toBe('PAYMENT STATEMENT (UNPAID)');
    expect(res.amountPaid).toBe(0);
    expect(res.balanceDue).toBe(107500);
    expect(res.isFullyPaid).toBe(false);
    expect(res.isUnpaid).toBe(true);
  });

  it('renders sent invoice with UNPAID watermark and pending statement heading', () => {
    const sentInvoice = { ...sampleInvoice, status: 'sent' as const };
    const res = reconcileReceipt(sentInvoice, []);
    expect(res.watermarkText).toBe('UNPAID');
    expect(res.receiptHeading).toBe('PAYMENT STATEMENT (UNPAID)');
    expect(res.amountPaid).toBe(0);
    expect(res.balanceDue).toBe(107500);
  });

  it('renders partially paid invoice with PARTIAL watermark, accurate balance, and statement heading', () => {
    const sentInvoice = { ...sampleInvoice, status: 'sent' as const };
    const partialPayment: Payment = {
      id: 'pay-1',
      invoice_id: 'inv-test-1',
      customer_id: 'cust-1',
      amount: 50000,
      method: 'bank_transfer',
      status: 'approved',
      recorded_by: 'rep-1',
      created_at: new Date().toISOString(),
    };

    const res = reconcileReceipt(sentInvoice, [partialPayment]);
    expect(res.watermarkText).toBe('PARTIAL');
    expect(res.receiptHeading).toBe('PAYMENT STATEMENT / PARTIAL RECEIPT');
    expect(res.amountPaid).toBe(50000);
    expect(res.balanceDue).toBe(57500);
    expect(res.isPartiallyPaid).toBe(true);
    expect(res.isFullyPaid).toBe(false);
  });

  it('renders fully paid invoice with PAID watermark and zero balance due', () => {
    const paidInvoice = { ...sampleInvoice, status: 'paid' as const };
    const res = reconcileReceipt(paidInvoice, []);
    expect(res.watermarkText).toBe('PAID');
    expect(res.receiptHeading).toBe('OFFICIAL RECEIPT');
    expect(res.amountPaid).toBe(107500);
    expect(res.balanceDue).toBe(0);
    expect(res.isFullyPaid).toBe(true);
  });

  it('renders cancelled invoice with CANCELLED watermark and void heading', () => {
    const cancelledInvoice = { ...sampleInvoice, status: 'cancelled' as const };
    const res = reconcileReceipt(cancelledInvoice, []);
    expect(res.watermarkText).toBe('CANCELLED');
    expect(res.receiptHeading).toBe('VOID SALES RECORD');
    expect(res.amountPaid).toBe(0);
    expect(res.balanceDue).toBe(0);
    expect(res.isCancelled).toBe(true);
  });
});
