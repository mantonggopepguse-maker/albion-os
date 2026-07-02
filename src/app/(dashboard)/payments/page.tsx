/**
 * @file payments/page.tsx — Payment Management & Verification Queue
 *
 * This page renders the **full payment management dashboard** used by
 * finance managers and super-admins to record, review, approve, or reject
 * payments submitted by sales reps.
 *
 * Architecture notes:
 * ─────────────────────
 * • All data operations go through Supabase hooks (`usePayments`,
 *   `useCustomers`, `useInvoices`, `useUsers`) which handle async fetching,
 *   loading states, and refetch-after-mutation automatically.
 * • Customer and user names are resolved at render-time via lookup helpers
 *   (`findCustomerById(customers, id)`, `findUserById(users, id)`) rather
 *   than being denormalized on each payment object.
 * • The tab system is data-driven: an array of `Tab` objects carries both the
 *   label and the filter predicate, so adding a new status tab is a one-liner.
 *
 * Key sections:
 *   1. Tab definitions & filter predicates
 *   2. Formatting / badge helpers
 *   3. PaymentCard component (individual card)
 *   4. Record Payment Modal (form with customer→invoice cascade)
 *   5. Reject Reason Modal (prompts for rejection reason)
 *   6. PaymentsPage component (page layout, state, summary calculations)
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
/* ── Supabase hooks replace the old synchronous data-service imports ── */
import {
  usePayments, useCustomers, useInvoices, useUsers,
  findCustomerById, findUserById,
  type RecordPaymentInput,
} from '@/hooks/use-supabase-data';
import { useAuth } from '@/lib/auth-context';
import type { Payment, PaymentStatus, Customer, User } from '@/lib/types';
import styles from './payments.module.css';

// ============================================================================
// Section 1 — Tab Definitions
// ============================================================================

/** Union of allowed tab keys — matches the four filter views. */
type TabKey = 'pending' | 'approved' | 'rejected' | 'all';

/** Describes a single tab: its key, display label, and filter predicate. */
interface Tab {
  key: TabKey;
  label: string;
  /** Predicate applied to each Payment to decide visibility. */
  filter: (p: Payment) => boolean;
}

/**
 * Tab configuration array.
 * Each entry drives one tab button in the tab bar. The `filter` function
 * is memoized in the page component so React can skip re-filtering when the
 * underlying payments array hasn't changed.
 */
const TABS: Tab[] = [
  { key: 'pending', label: 'Pending Approval', filter: (p) => p.status === 'pending' },
  { key: 'approved', label: 'Approved', filter: (p) => p.status === 'approved' },
  { key: 'rejected', label: 'Rejected', filter: (p) => p.status === 'rejected' },
  { key: 'all', label: 'All', filter: () => true },
];

// ============================================================================
// Section 2 — Toast State Type
// ============================================================================

/** Shape of the toast notification state used throughout the page. */
interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

// ============================================================================
// Section 3 — Formatting & Badge Helpers
// ============================================================================

/**
 * Format a numeric amount as Nigerian Naira (₦).
 * Uses `toLocaleString('en-NG')` for thousands-separator formatting.
 *
 * @param amount - Raw numeric value in Naira.
 * @returns Formatted currency string, e.g. "₦1,250,000".
 */
function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

/**
 * Convert an ISO-8601 date string to a short human-readable format.
 *
 * @param iso - ISO date string (e.g. "2026-06-15T10:00:00Z").
 * @returns Formatted date like "15 Jun 2026".
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Map internal method codes to display labels.
 *
 * @param method - Either 'bank_transfer' or 'cash'.
 * @returns Human-readable label.
 */
function formatMethodLabel(method: string): string {
  return method === 'bank_transfer' ? 'Bank Transfer' : 'Cash';
}

/**
 * Return the CSS module class name for the status badge's color variant.
 * Pending = yellow, Approved = green, Rejected = red.
 *
 * @param status - Payment status enum value.
 * @returns CSS class string from the module stylesheet.
 */
function getStatusBadgeClass(status: PaymentStatus): string {
  switch (status) {
    case 'pending':
      return styles.badgePending;
    case 'approved':
      return styles.badgeApproved;
    case 'rejected':
      return styles.badgeRejected;
    default:
      return '';
  }
}

/**
 * Capitalize the first letter of a status string for display.
 *
 * @param status - Lowercase status string.
 * @returns Title-cased label, e.g. "Pending".
 */
function getStatusLabel(status: PaymentStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ============================================================================
// Section 4 — PaymentCard Component
// ============================================================================

/**
 * PaymentCard — renders a single payment as a glassmorphic card with:
 *   • Header: customer name + business name + status badge
 *   • Body:   amount, method, recorded-by user, date, invoice ref, notes
 *   • Footer: receipt viewer link (bank transfers) + approve/reject actions
 *
 * The `onApprove` and `onReject` callbacks bubble up to the parent so the
 * page-level state is the single source of truth for payment status.
 *
 * Props note: `customers` and `users` arrays are passed down from the parent
 * so the card can resolve names via `findCustomerById(customers, id)` and
 * `findUserById(users, id)` without calling hooks inside a non-hook function.
 */
function PaymentCard({
  payment,
  customers,
  users,
  onApprove,
  onReject,
  onReconcileCash,
}: {
  payment: Payment;
  customers: Customer[];
  users: User[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReconcileCash?: (id: string) => void;
}) {
  /* Resolve related entities — helpers now take the array as first arg */
  const customer = findCustomerById(customers, payment.customer_id);
  const recordedBy = findUserById(users, payment.recorded_by);

  return (
    <div className={styles.card}>
      {/* ── Header — customer identity + status badge ── */}
      <div className={styles.cardHeader}>
        <div className={styles.customerInfo}>
          <span className={styles.customerName}>
            {customer?.name || 'Unknown Customer'}
          </span>
          {/* Show business name only if the customer record has one */}
          {customer?.business_name && (
            <span className={styles.businessName}>{customer.business_name}</span>
          )}
        </div>
        {/* Composite badge: colored dot + capitalized status text */}
        <span className={`${styles.badge} ${getStatusBadgeClass(payment.status)}`}>
          <span className={styles.badgeDot} />
          {getStatusLabel(payment.status)}
        </span>
      </div>

      {/* ── Body — payment details grid ── */}
      <div className={styles.cardBody}>
        <div className={styles.amount}>{formatCurrency(payment.amount)}</div>

        <div className={styles.detailsGrid}>
          {/* Payment method (bank transfer vs cash) with emoji icon */}
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Payment Method</span>
            <span className={styles.methodBadge}>
              {payment.method === 'bank_transfer' ? '🏦' : '💵'}{' '}
              {formatMethodLabel(payment.method)}
            </span>
          </div>

          {/* The sales rep or user who recorded this payment in the field */}
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Recorded By</span>
            <span className={styles.detailValue}>
              {recordedBy?.full_name || 'Unknown'}
            </span>
          </div>

          {/* Date the payment was recorded */}
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Date</span>
            <span className={styles.detailValue}>
              {formatDate(payment.created_at)}
            </span>
          </div>

          {/* Invoice reference — format for display */}
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Invoice</span>
            <span className={styles.detailValue}>
              {payment.invoice_id.replace('inv-', 'INV-').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Optional notes attached by the recording user */}
        {payment.notes && (
          <div className={styles.notes}>
            💬 {payment.notes}
          </div>
        )}
      </div>

      {/* ── Footer — receipt viewer + approve/reject action buttons ── */}
      <div className={styles.cardFooter}>
        {/*
         * Receipt link is only relevant for bank transfers that have
         * an uploaded proof-of-payment URL. Opens in a new tab.
         */}
        {payment.method === 'bank_transfer' && payment.proof_url && (
          <button
            className={styles.receiptLink}
            onClick={() => window.open(payment.proof_url!, '_blank')}
          >
            📄 View Receipt
          </button>
        )}

        {/*
         * Action buttons are only shown for payments still in "pending"
         * status. Once approved or rejected, the buttons disappear.
         */}
        {payment.status === 'pending' && (
          <div className={styles.actionButtons}>
            {payment.method === 'cash' && onReconcileCash && (
              <button
                className={styles.approveBtn}
                style={{ background: 'var(--color-warning)', color: '#fff' }}
                onClick={() => onReconcileCash(payment.id)}
              >
                💵 Reconcile Cash
              </button>
            )}
            <button
              className={styles.approveBtn}
              onClick={() => onApprove(payment.id)}
            >
              ✓ Approve
            </button>
            <button
              className={styles.rejectBtn}
              onClick={() => onReject(payment.id)}
            >
              ✕ Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section 5 — Main Page Component
// ============================================================================

/**
 * PaymentsPage — the top-level page component for `/payments`.
 *
 * State management:
 * ─────────────────
 * • `activeTab`       — which tab filter is selected (default: "pending").
 * • `searchQuery`     — text filter applied across customer name, method, notes.
 * • `showRecordModal` — controls the Record Payment modal visibility.
 * • `rejectTarget`    — when set, opens the Reject Reason modal for that payment.
 * • `toast`           — current toast notification (null = hidden).
 *
 * Data is fetched via Supabase hooks. Each hook manages its own loading
 * state and exposes a `refetch()` function called after mutations.
 */
export default function PaymentsPage() {
  // ── Auth — get current logged-in user for recording/approving ──
  const { user } = useAuth();

  // ── Supabase data hooks (replace old synchronous data-service calls) ──
  const {
    payments, loading: paymentsLoading,
    recordPayment, approvePayment, rejectPayment,
  } = usePayments();
  const { customers } = useCustomers();
  const { invoices } = useInvoices();
  const { users } = useUsers();

  // ── Core state ──
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Modal state ──
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Toast state ──
  const [toast, setToast] = useState<ToastState | null>(null);

  // ── Record Payment form state ──
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [formNotes, setFormNotes] = useState('');
  const [formProofUrl, setFormProofUrl] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  /**
   * Invoices filtered to the selected customer in the Record Payment form.
   * Only shows invoices belonging to the chosen customer so the user
   * can't accidentally apply payment to the wrong account.
   */
  const customerInvoices = useMemo(
    () => invoices.filter((i) => i.customer_id === formCustomerId),
    [invoices, formCustomerId]
  );

  /** Resolve the active tab's config object (label + filter predicate). */
  const currentTab = TABS.find((t) => t.key === activeTab)!;

  /**
   * Filtered payments for the currently selected tab + search query.
   * Search is case-insensitive across customer name, method, and notes.
   * Note: findCustomerById now takes the customers array as first arg.
   */
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return payments
      .filter(currentTab.filter)
      .filter((p) => {
        if (!query) return true;
        const customer = findCustomerById(customers, p.customer_id);
        const customerName = (customer?.name || '').toLowerCase();
        const businessName = (customer?.business_name || '').toLowerCase();
        const method = formatMethodLabel(p.method).toLowerCase();
        const notes = (p.notes || '').toLowerCase();
        const amount = formatCurrency(p.amount).toLowerCase();
        return (
          customerName.includes(query) ||
          businessName.includes(query) ||
          method.includes(query) ||
          notes.includes(query) ||
          amount.includes(query)
        );
      });
  }, [payments, customers, currentTab, searchQuery]);

  /**
   * Per-tab counts — used to render the badge number on each tab button.
   * Iterates the full payments array once, incrementing each status bucket.
   */
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { pending: 0, approved: 0, rejected: 0, all: 0 };
    payments.forEach((p) => {
      c.all++;
      if (p.status === 'pending') c.pending++;
      else if (p.status === 'approved') c.approved++;
      else if (p.status === 'rejected') c.rejected++;
    });
    return c;
  }, [payments]);

  // ── Summary statistics (memoized) ──

  /** Total monetary value of all payments combined. */
  const totalAmount = useMemo(
    () => payments.reduce((s, p) => s + p.amount, 0),
    [payments]
  );

  /** Count of pending payments awaiting approval. */
  const pendingCount = useMemo(
    () => payments.filter((p) => p.status === 'pending').length,
    [payments]
  );

  /** Total monetary value of all pending payments. */
  const pendingAmount = useMemo(
    () => payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
    [payments]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ── Action Handlers ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Handle approving a payment.
   * Calls async `approvePayment()` from Supabase hook, shows toast.
   * Hook's refetch is called internally by approvePayment on success.
   */
  const handleApprove = useCallback(
    async (id: string) => {
      if (!user) {
        setToast({ message: 'You must be logged in to approve payments.', type: 'error' });
        return;
      }

      const result = await approvePayment(id, user.id);
      if (result.success) {
        setToast({ message: 'Payment approved successfully!', type: 'success' });
      } else {
        setToast({ message: result.error || 'Failed to approve payment.', type: 'error' });
      }
    },
    [user, approvePayment]
  );

  /**
   * Handle cash reconciliation — validates and approves cash payments.
   * Reuses the approvePayment logic with a reconcile-specific toast.
   */
  const handleReconcileCash = useCallback(
    async (id: string) => {
      if (!user) {
        setToast({ message: 'You must be logged in to reconcile payments.', type: 'error' });
        return;
      }

      const result = await approvePayment(id, user.id);
      if (result.success) {
        setToast({ message: 'Cash reconciled successfully!', type: 'success' });
      } else {
        setToast({ message: result.error || 'Failed to reconcile cash.', type: 'error' });
      }
    },
    [user, approvePayment]
  );

  /**
   * Open the Reject Reason modal for a specific payment.
   * The actual rejection happens in `handleRejectConfirm`.
   */
  const handleRejectStart = useCallback((id: string) => {
    setRejectTarget(id);
    setRejectReason('');
  }, []);

  /**
   * Confirm rejection with the entered reason.
   * Calls async `rejectPayment()` from Supabase hook, shows toast.
   * Hook's refetch is called internally by rejectPayment on success.
   */
  const handleRejectConfirm = useCallback(async () => {
    if (!user || !rejectTarget) return;

    if (!rejectReason.trim()) {
      setToast({ message: 'Please provide a reason for rejection.', type: 'error' });
      return;
    }

    const result = await rejectPayment(rejectTarget, user.id, rejectReason.trim());
    if (result.success) {
      setToast({ message: 'Payment rejected.', type: 'info' });
      setRejectTarget(null);
      setRejectReason('');
    } else {
      setToast({ message: result.error || 'Failed to reject payment.', type: 'error' });
    }
  }, [user, rejectTarget, rejectReason, rejectPayment]);

  // ══════════════════════════════════════════════════════════════════════════
  // ── Record Payment Form Handlers ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Reset all Record Payment form fields to their defaults.
   * Called after a successful submission or when closing the modal.
   */
  const resetForm = useCallback(() => {
    setFormCustomerId('');
    setFormInvoiceId('');
    setFormAmount('');
    setFormMethod('cash');
    setFormNotes('');
    setFormProofUrl('');
    setFormSubmitting(false);
  }, []);

  /**
   * Open the Record Payment modal. Resets form state before showing.
   */
  const openRecordModal = useCallback(() => {
    resetForm();
    setShowRecordModal(true);
  }, [resetForm]);

  /**
   * Close the Record Payment modal and clean up form state.
   */
  const closeRecordModal = useCallback(() => {
    setShowRecordModal(false);
    resetForm();
  }, [resetForm]);

  /**
   * Handle Record Payment form submission.
   * Validates all required fields, calls async `recordPayment()` from
   * Supabase hook, shows success/error toasts.
   * Note: recordPayment(input, userId) — userId is passed as second arg.
   */
  const handleRecordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!user) {
        setToast({ message: 'You must be logged in to record payments.', type: 'error' });
        return;
      }

      /* ── Validate required fields ── */
      if (!formCustomerId) {
        setToast({ message: 'Please select a customer.', type: 'error' });
        return;
      }
      if (!formInvoiceId) {
        setToast({ message: 'Please select an invoice.', type: 'error' });
        return;
      }
      const amount = parseFloat(formAmount);
      if (isNaN(amount) || amount <= 0) {
        setToast({ message: 'Amount must be greater than 0.', type: 'error' });
        return;
      }

      setFormSubmitting(true);

      /* ── Build input and call Supabase hook ── */
      const input: RecordPaymentInput = {
        customer_id: formCustomerId,
        invoice_id: formInvoiceId,
        amount,
        method: formMethod,
        proof_url: formProofUrl.trim() || null,
        notes: formNotes.trim() || undefined,
      };

      const result = await recordPayment(input, user.id);

      if (result.success) {
        setToast({ message: `Payment of ${formatCurrency(amount)} recorded successfully!`, type: 'success' });
        closeRecordModal();
      } else {
        setToast({ message: result.error || 'Failed to record payment.', type: 'error' });
        setFormSubmitting(false);
      }
    },
    [user, formCustomerId, formInvoiceId, formAmount, formMethod, formProofUrl, formNotes, closeRecordModal, recordPayment]
  );

  /**
   * When the customer selection changes, reset the invoice dropdown
   * since the available invoices change per customer.
   */
  const handleCustomerChange = useCallback((customerId: string) => {
    setFormCustomerId(customerId);
    setFormInvoiceId(''); // Reset invoice when customer changes
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // ── Render ──────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /* ── Loading state — show spinner while payments are being fetched ── */
  if (paymentsLoading) {
    return (
      <>
        <Topbar title="Payments" />
        <div className={styles.page}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>⏳</span>
            <h3 className={styles.emptyTitle}>Loading Payments…</h3>
            <p className={styles.emptyText}>Fetching payment data from the server.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Payments" />

      <div className={styles.page}>
        {/* ── Page Header — title + Record Payment button ──────────── */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Payment Management</h1>
            <p className={styles.pageSubtitle}>
              Record, review, and verify payment transactions
            </p>
          </div>
          {user?.role !== 'ceo' && (
            <button className={styles.recordBtn} onClick={openRecordModal}>
              + Record Payment
            </button>
          )}
        </div>

        {/* ── Summary Cards ─────────────────────────────────────────── */}
        {/* Four KPI cards: Total Count, Total Amount, Pending Count, Pending Amount */}
        <div className={styles.summaryBar}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>📊</div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryLabel}>Total Payments</div>
              <div className={styles.summaryValue}>{payments.length}</div>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>💰</div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryLabel}>Total Amount</div>
              <div className={styles.summaryValue}>{formatCurrency(totalAmount)}</div>
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardPending}`}>
            <div className={styles.summaryIcon}>⏳</div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryLabel}>Pending Count</div>
              <div className={styles.summaryValue}>{pendingCount}</div>
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardPending}`}>
            <div className={styles.summaryIcon}>🔒</div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryLabel}>Pending Amount</div>
              <div className={styles.summaryValue}>{formatCurrency(pendingAmount)}</div>
            </div>
          </div>
        </div>

        {/* ── Search Bar ────────────────────────────────────────────── */}
        <div className={styles.searchBar}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by customer, method, amount, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {/* Clear button — only shown when there's a search query */}
          {searchQuery && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Tab Bar ───────────────────────────────────────────────── */}
        {/* Renders one button per TABS entry; active tab gets highlighted style */}
        <div className={styles.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {/* Inline count badge shows how many payments match this tab's filter */}
              <span className={styles.tabCount}>{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        {/* ── Payment Cards Grid / Empty State ─────────────────────── */}
        {filtered.length > 0 ? (
          <div className={styles.cardsGrid}>
            {filtered.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                customers={customers}
                users={users}
                onApprove={handleApprove}
                onReject={handleRejectStart}
                onReconcileCash={handleReconcileCash}
              />
            ))}
          </div>
        ) : (
          /* Empty state shown when no payments match the active filter + search */
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            <h3 className={styles.emptyTitle}>
              {searchQuery
                ? 'No Matching Payments'
                : `No ${currentTab.label} Payments`}
            </h3>
            <p className={styles.emptyText}>
              {searchQuery
                ? `No payments match "${searchQuery}". Try a different search term.`
                : 'There are no payments with this status right now. Check back later or try a different tab.'}
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── Record Payment Modal ──────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showRecordModal}
        onClose={closeRecordModal}
        title="Record Payment"
        subtitle="Log a new payment received from a customer"
      >
        <form onSubmit={handleRecordSubmit} className={styles.form}>
          {/* ── Customer Dropdown ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Customer <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.formSelect}
              value={formCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              required
            >
              <option value="">Select a customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.business_name}
                </option>
              ))}
            </select>
          </div>

          {/* ── Invoice Dropdown (filtered by selected customer) ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Invoice <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.formSelect}
              value={formInvoiceId}
              onChange={(e) => setFormInvoiceId(e.target.value)}
              required
              disabled={!formCustomerId}
            >
              <option value="">
                {formCustomerId
                  ? customerInvoices.length > 0
                    ? 'Select an invoice...'
                    : 'No invoices for this customer'
                  : 'Select a customer first...'}
              </option>
              {customerInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {formatCurrency(inv.total)} ({inv.status})
                </option>
              ))}
            </select>
            {/* Hint text when customer has no invoices */}
            {formCustomerId && customerInvoices.length === 0 && (
              <span className={styles.formHint}>
                This customer has no invoices yet. Create an invoice first.
              </span>
            )}
          </div>

          {/* ── Amount Input ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Amount (₦) <span className={styles.required}>*</span>
            </label>
            <input
              type="number"
              className={styles.formInput}
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="e.g. 250000"
              min="1"
              step="any"
              required
            />
          </div>

          {/* ── Payment Method Radio Buttons ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Payment Method <span className={styles.required}>*</span>
            </label>
            <div className={styles.radioGroup}>
              <label className={`${styles.radioLabel} ${formMethod === 'cash' ? styles.radioActive : ''}`}>
                <input
                  type="radio"
                  name="method"
                  value="cash"
                  checked={formMethod === 'cash'}
                  onChange={() => setFormMethod('cash')}
                  className={styles.radioInput}
                />
                <span className={styles.radioIcon}>💵</span>
                Cash
              </label>
              <label className={`${styles.radioLabel} ${formMethod === 'bank_transfer' ? styles.radioActive : ''}`}>
                <input
                  type="radio"
                  name="method"
                  value="bank_transfer"
                  checked={formMethod === 'bank_transfer'}
                  onChange={() => setFormMethod('bank_transfer')}
                  className={styles.radioInput}
                />
                <span className={styles.radioIcon}>🏦</span>
                Bank Transfer
              </label>
            </div>
          </div>

          {/* ── Receipt Upload (only for bank transfers) ── */}
          {formMethod === 'bank_transfer' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Receipt / Proof of Payment <span className={styles.required}>*</span>
              </label>
              <input
                type="url"
                className={styles.formInput}
                value={formProofUrl}
                onChange={(e) => setFormProofUrl(e.target.value)}
                placeholder="Paste a URL or upload link to the receipt image"
              />
              <span className={styles.formHint}>
                Upload receipt to Supabase Storage or provide a direct image URL
              </span>
            </div>
          )}

          {/* ── Notes Textarea (optional) ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Notes</label>
            <textarea
              className={styles.formTextarea}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional — add any relevant notes about this payment..."
              rows={3}
            />
          </div>

          {/* ── Form Actions — Cancel + Submit ── */}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={closeRecordModal}
              disabled={formSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Recording...' : '💳 Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── Reject Reason Modal ───────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={rejectTarget !== null}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
        title="Reject Payment"
        subtitle="Provide a reason for rejecting this payment"
        maxWidth="480px"
      >
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Rejection Reason <span className={styles.required}>*</span>
            </label>
            <textarea
              className={styles.formTextarea}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Proof of payment is unclear, amount does not match invoice..."
              rows={4}
              autoFocus
            />
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => { setRejectTarget(null); setRejectReason(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.rejectConfirmBtn}
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()}
            >
              ✕ Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Toast Notification ─────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
