/**
 * @file InvoicesPage — Invoice Management with Create Invoice form
 *
 * Displays all invoices in a filterable table with status tabs and search.
 * Includes a "New Invoice" modal with dynamic line items and auto-calculated totals.
 *
 * Features:
 *   - Status filter tabs (All, Draft, Sent, Paid, Partial, Overdue) with live counts
 *   - Free-text search across invoice number and customer name
 *   - Summary cards: Total Invoices, Total Value, Paid, Overdue
 *   - Create Invoice form with multi-line item support
 *   - Auto-calculated subtotal, 7.5% VAT, and grand total
 *   - Toast notifications for success/error feedback
 *
 * @module (dashboard)/invoices/page
 */
'use client';

import { useState, useMemo, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import {
  useInvoices, useCustomers, useProducts,
  findCustomerById,
} from '@/hooks/use-supabase-data';
import { useAuth } from '@/lib/auth-context';
import type { InvoiceStatus } from '@/lib/types';
import styles from './invoices.module.css';

/* ── Currency formatter ── */
function fmt(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

/* ── Date formatter ── */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/* ── Status badge component ── */
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const colorMap: Record<InvoiceStatus, string> = {
    paid: styles.badgePaid,
    partial: styles.badgePartial,
    sent: styles.badgeSent,
    overdue: styles.badgeOverdue,
    draft: styles.badgeDraft,
  };
  return (
    <span className={`${styles.badge} ${colorMap[status] || ''}`}>
      <span className={styles.badgeDot} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/* ── Line item shape for the form ── */
interface LineItem {
  product_id: string;
  quantity: number;
}

/* ── Tab definitions ── */
const TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'paid', label: 'Paid' },
  { key: 'partial', label: 'Partial' },
  { key: 'overdue', label: 'Overdue' },
];

export default function InvoicesPage() {
  const { user } = useAuth();

  /* ── State ── */
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  /* ── Form state ── */
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ product_id: '', quantity: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  /* ── Data from Supabase hooks ── */
  const { invoices, createInvoice, updateInvoiceStatus } = useInvoices();
  const { customers } = useCustomers();
  const { products } = useProducts();

  /* ── Enriched invoices with customer names ── */
  const enriched = useMemo(() =>
    invoices.map((inv) => {
      const customer = findCustomerById(customers, inv.customer_id);
      return {
        ...inv,
        customerName: customer?.business_name || customer?.name || 'Unknown',
      };
    }),
    [invoices, customers]
  );

  /* ── Tab counts ── */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enriched.length };
    TABS.forEach((tab) => {
      if (tab.key !== 'all') {
        counts[tab.key] = enriched.filter((i) => i.status === tab.key).length;
      }
    });
    return counts;
  }, [enriched]);

  /* ── Two-stage filtering: tab → search ── */
  const filtered = useMemo(() => {
    let result = enriched;
    // Stage 1: filter by status tab
    if (activeTab !== 'all') {
      result = result.filter((i) => i.status === activeTab);
    }
    // Stage 2: free-text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, activeTab, search]);

  /* ── Summary stats (always from full dataset) ── */
  const stats = useMemo(() => ({
    total: enriched.length,
    totalValue: enriched.reduce((s, i) => s + i.total, 0),
    paid: enriched.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    overdue: enriched.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.total, 0),
  }), [enriched]);

  /* ── Line item calculations ── */
  const lineCalcs = useMemo(() => {
    return lineItems.map((line) => {
      const product = products.find((p) => p.id === line.product_id);
      const unitPrice = product?.unit_price || 0;
      const total = unitPrice * line.quantity;
      return { unitPrice, total, productName: product?.name || '' };
    });
  }, [lineItems, products]);

  const subtotal = useMemo(() => lineCalcs.reduce((s, l) => s + l.total, 0), [lineCalcs]);
  const vat = Math.round(subtotal * 0.075);
  const grandTotal = subtotal + vat;

  /* ── Line item handlers ── */
  const updateLine = useCallback((index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const addLine = useCallback(() => {
    setLineItems((prev) => [...prev, { product_id: '', quantity: 1 }]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Reset form to initial state ── */
  const resetForm = useCallback(() => {
    setCustomerId('');
    setDueDate('');
    setLineItems([{ product_id: '', quantity: 1 }]);
  }, []);

  /* ── Open modal with clean form ── */
  const openModal = useCallback(() => {
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  /* ── Form submission (async — writes to Supabase) ── */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Client-side validation
    if (!customerId) { setToast({ message: 'Please select a customer', type: 'error' }); return; }
    if (!dueDate) { setToast({ message: 'Please set a due date', type: 'error' }); return; }
    if (lineItems.some((l) => !l.product_id)) { setToast({ message: 'Please select a product for each line', type: 'error' }); return; }
    if (lineItems.some((l) => l.quantity <= 0)) { setToast({ message: 'Quantity must be > 0', type: 'error' }); return; }

    setIsSubmitting(true);

    const result = await createInvoice(
      {
        customer_id: customerId,
        items: lineItems.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        due_date: dueDate,
      },
      products,
      user.id,
      user.location_id || '',
    );

    if (result.success) {
      setToast({ message: `Invoice created successfully!`, type: 'success' });
      setShowModal(false);
      resetForm();
    } else {
      setToast({ message: result.error || 'Failed to create invoice', type: 'error' });
    }
    setIsSubmitting(false);
  }, [user, customerId, dueDate, lineItems, products, createInvoice, resetForm]);

  const handleMarkSent = useCallback(async (invoiceId: string) => {
    setSendingId(invoiceId);
    const result = await updateInvoiceStatus(invoiceId, 'sent');
    setToast({
      message: result.success ? 'Invoice marked as sent' : (result.error || 'Failed to update'),
      type: result.success ? 'success' : 'error',
    });
    setSendingId(null);
  }, [updateInvoiceStatus]);

  if (!user) return null;

  return (
    <>
      <Topbar title="Invoices" />
      <div className={styles.page}>
        {/* ── Header: Search + New Invoice button ── */}
        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {user.role !== 'ceo' && (
            <button className={styles.addBtn} onClick={openModal}>
              ＋ New Invoice
            </button>
          )}
        </div>

        {/* ── Status filter tabs ── */}
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className={styles.tabCount}>{tabCounts[tab.key] || 0}</span>
            </button>
          ))}
        </div>

        {/* ── Summary cards ── */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryIcon}>🧾</span>
            <div>
              <span className={styles.summaryLabel}>Total Invoices</span>
              <span className={styles.summaryValue}>{stats.total}</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryIcon}>💰</span>
            <div>
              <span className={styles.summaryLabel}>Total Value</span>
              <span className={styles.summaryValue}>{fmt(stats.totalValue)}</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryIcon}>✅</span>
            <div>
              <span className={styles.summaryLabel}>Paid</span>
              <span className={styles.summaryValue}>{fmt(stats.paid)}</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryIcon}>🚨</span>
            <div>
              <span className={styles.summaryLabel}>Overdue</span>
              <span className={styles.summaryValue}>{fmt(stats.overdue)}</span>
            </div>
          </div>
        </div>

        {/* ── Invoices table ── */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Amount (₦)</th>
                <th>Status</th>
                <th>Date</th>
                <th>Due Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    <span>🔍</span>
                    <p>No invoices found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className={styles.row}>
                    <td className={styles.invoiceNum}>{inv.invoice_number}</td>
                    <td>{inv.customerName}</td>
                    <td className={styles.amount}>{fmt(inv.total)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>{formatDate(inv.created_at)}</td>
                    <td>{formatDate(inv.due_date)}</td>
                    <td>
                      {inv.status === 'draft' && (
                        <button
                          style={{
                            padding: '0.25rem 0.75rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: 'var(--color-ocean)',
                            color: '#fff',
                            cursor: sendingId === inv.id ? 'not-allowed' : 'pointer',
                            opacity: sendingId === inv.id ? 0.6 : 1,
                          }}
                          disabled={sendingId === inv.id}
                          onClick={() => handleMarkSent(inv.id)}
                        >
                          {sendingId === inv.id ? '...' : 'Mark Sent'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {/* Table footer */}
          <div className={styles.tableFooter}>
            Showing {filtered.length} of {enriched.length} invoices
          </div>
        </div>

        {/* ── Create Invoice Modal ── */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Create Invoice"
          subtitle="Add line items and the totals will be calculated automatically."
          maxWidth="720px"
        >
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Row: Customer + Due Date */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Customer *</label>
                <select
                  className={styles.formSelect}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Due Date *</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* ── Line Items Section ── */}
            <div className={styles.lineSection}>
              <div className={styles.lineSectionHeader}>
                <h4>Line Items</h4>
                <button type="button" className={styles.addLineBtn} onClick={addLine}>
                  ＋ Add Line
                </button>
              </div>

              {/* Line items header */}
              <div className={styles.lineHeader}>
                <span className={styles.lineColProduct}>Product</span>
                <span className={styles.lineColQty}>Qty</span>
                <span className={styles.lineColPrice}>Price</span>
                <span className={styles.lineColTotal}>Total</span>
                <span className={styles.lineColAction}></span>
              </div>

              {/* Line item rows */}
              {lineItems.map((line, index) => (
                <div key={index} className={styles.lineRow}>
                  <select
                    className={`${styles.formSelect} ${styles.lineColProduct}`}
                    value={line.product_id}
                    onChange={(e) => updateLine(index, 'product_id', e.target.value)}
                    required
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={`${styles.formInput} ${styles.lineColQty}`}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', parseInt(e.target.value) || 0)}
                    min={1}
                    required
                  />
                  <span className={`${styles.linePrice} ${styles.lineColPrice}`}>
                    {fmt(lineCalcs[index]?.unitPrice || 0)}
                  </span>
                  <span className={`${styles.lineTotal} ${styles.lineColTotal}`}>
                    {fmt(lineCalcs[index]?.total || 0)}
                  </span>
                  <div className={styles.lineColAction}>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeLineBtn}
                        onClick={() => removeLine(index)}
                        title="Remove line"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Totals Section ── */}
            <div className={styles.totalsSection}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>VAT (7.5%)</span>
                <span>{fmt(vat)}</span>
              </div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                <span>Grand Total</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </div>

            {/* ── Form Actions ── */}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Toast Notification ── */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </>
  );
}
