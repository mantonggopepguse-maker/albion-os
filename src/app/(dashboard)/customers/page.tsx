/**
 * @file CustomersPage — AlbionOS Customer Directory (Full CRUD)
 *
 * Displays a searchable directory of all Albion Pharmaceuticals customers
 * with summary statistics, an interactive data table, and a fully functional
 * "Add Customer" modal form.
 *
 * Key features:
 * ──────────────
 * - **Supabase hooks** — All reads via `useCustomers()` and `useLocations()`;
 *   writes via the hook-returned `addCustomer()` mutation. No mock data.
 * - **Real-time search** — Case-insensitive filtering across customer
 *   name, business name, phone number, and state.
 * - **Summary stat cards** — Total customer count, aggregate credit limit,
 *   and total outstanding balance (computed from the full dataset).
 * - **Add Customer modal** — Glassmorphic modal form with 8 validated fields.
 *   On success the hook refetches automatically; no manual refresh needed.
 * - **Loading state** — Spinner shown while data is being fetched.
 * - **Toast notifications** — Success/error feedback for every mutation.
 * - **Outstanding balance colour-coding** — Red for unpaid, green for zero.
 * - **Currency formatting** — ₦ amounts use Nigerian locale (en-NG).
 *
 * @module (dashboard)/customers/page
 */

'use client';

import { useState, useMemo, type FormEvent, type ChangeEvent } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
// ── Supabase data hooks — replaces old '@/lib/data-service' imports ──
import {
  useCustomers,
  useLocations,
  type AddCustomerInput,
} from '@/hooks/use-supabase-data';
import { updateCustomer } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import styles from './customers.module.css';

// ═══════════════════════════════════════════════════════════════════════════
// ── Constants — Nigerian states dropdown ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List of Nigerian states offered in the "Add Customer" form.
 * Covers the primary Albion distribution footprint; additional states
 * can be appended here without touching any component code.
 */
const NIGERIAN_STATES = [
  'Lagos',
  'Anambra',
  'FCT',
  'Delta',
  'Rivers',
  'Oyo',
  'Kano',
  'Enugu',
  'Ogun',
  'Edo',
  'Kaduna',
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// ── Helpers — Currency formatting ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formats a numeric value as a Naira amount string (no currency symbol).
 * Uses the Nigerian English locale for comma-separated thousands and
 * suppresses decimal places (pharmaceutical invoices are whole-naira).
 *
 * @param value - Raw numeric amount, e.g. `3280000`.
 * @returns Formatted string, e.g. `"3,280,000"`.
 */
function formatCurrency(value: number): string {
  return value.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Types — Form & Toast state shapes ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/** Shape of the toast notification state (null = hidden). */
interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Shape of the Add Customer form's controlled state.
 * All fields start as empty strings / zero and are populated by the user.
 */
interface FormState {
  name: string;
  business_name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  credit_limit: string; // stored as string for the <input>, parsed on submit
  location_id: string;
}

/** Initial/blank form state — used both for first render and after reset. */
const INITIAL_FORM: FormState = {
  name: '',
  business_name: '',
  phone: '',
  email: '',
  address: '',
  state: '',
  credit_limit: '',
  location_id: '',
};

// ═══════════════════════════════════════════════════════════════════════════
// ── CustomersPage — Exported page component ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer directory page — lists every registered customer with search,
 * summary statistics, an interactive data table, and a modal for adding
 * new customers.
 *
 * **Data refresh pattern:**
 * Uses the `useCustomers()` Supabase hook which fetches on mount and
 * auto-refetches after every successful `addCustomer()` call.
 */
export default function CustomersPage() {
  // ── Supabase data hooks ──
  const { user: currentUser } = useAuth();
  const isCeo = currentUser?.role === 'ceo';

  /** Live customer data from Supabase — fetch inactive if CEO */
  const { customers, loading: customersLoading, addCustomer, refetch } = useCustomers(isCeo);
  /** Live location data from Supabase — used in the "Add Customer" modal dropdown. */
  const { locations, loading: locationsLoading } = useLocations();

  /** Combined loading state — true while either dataset is still fetching. */
  const loading = customersLoading || locationsLoading;

  // ── Core state ──
  /** Controlled search input — drives the `filtered` memo. */
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // ── Modal & form state ──
  /** Controls Add Customer modal visibility. */
  const [showModal, setShowModal] = useState(false);

  /** Controlled form field values for the Add Customer modal. */
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  /** Tracks whether the form is currently submitting (prevents double-submit). */
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Toast notification state (null = no toast visible) ──
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', business_name: '', phone: '', email: '', address: '', state: '', credit_limit: 0 });

  const displayCustomers = useMemo(() => {
    return customers.filter(c => {
      if (isCeo && showDeleted) return true; // show all
      return c.is_active !== false; // hide inactive
    });
  }, [customers, isCeo, showDeleted]);

  /**
   * Filtered customer list, recomputed when `search` or `customers` changes.
   * Returns the full list when the search input is blank.
   */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return displayCustomers;
    return displayCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.business_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.state.toLowerCase().includes(q)
    );
  }, [search, displayCustomers]);

  // ── Summary statistics (computed across ALL customers, not filtered) ──

  /** Sum of all outstanding balances across active customers. */
  const totalOutstanding = displayCustomers.reduce(
    (sum, c) => sum + c.outstanding_balance,
    0
  );
  /** Sum of all credit limits across active customers. */
  const totalCredit = displayCustomers.reduce(
    (sum, c) => sum + c.credit_limit,
    0
  );

  // ═════════════════════════════════════════════════════════════════════════
  // ── Handlers — Form input & submission ──────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Generic change handler for all form fields.
   * Updates the corresponding key in the `form` state object.
   * Works with <input>, <select>, and <textarea> elements.
   */
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Opens the Add Customer modal and resets the form to blank state.
   * This ensures the form is always clean when opened, even if the
   * user previously filled out some fields and closed without saving.
   */
  const openModal = () => {
    setForm({ ...INITIAL_FORM, location_id: currentUser?.location_id || '' });
    setShowModal(true);
  };

  /** Closes the Add Customer modal without saving. */
  const closeModal = () => {
    setShowModal(false);
  };

  /**
   * Handles form submission for the Add Customer modal.
   *
   * Flow:
   * 1. Prevents default form behaviour (no page reload)
   * 2. Runs client-side validation on all required fields
   * 3. Calls `addCustomer()` from the data service layer
   * 4. On success → shows success toast, refreshes list, closes modal
   * 5. On failure → shows error toast with the service's error message
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // ── Client-side validation ──
    // These checks run before hitting Supabase, providing instant
    // feedback for missing fields. Supabase has its own constraints
    // too (belt-and-suspenders approach).
    if (!form.name.trim()) {
      setToast({ message: 'Customer name is required.', type: 'error' });
      return;
    }
    if (!form.business_name.trim()) {
      setToast({ message: 'Business name is required.', type: 'error' });
      return;
    }
    if (!form.phone.trim()) {
      setToast({ message: 'Phone number is required.', type: 'error' });
      return;
    }
    if (!form.address.trim()) {
      setToast({ message: 'Address is required.', type: 'error' });
      return;
    }
    if (!form.state) {
      setToast({ message: 'Please select a state.', type: 'error' });
      return;
    }
    if (!form.credit_limit || Number(form.credit_limit) < 0) {
      setToast({ message: 'Credit limit must be 0 or above.', type: 'error' });
      return;
    }
    if (!form.location_id) {
      setToast({ message: 'Please select a location.', type: 'error' });
      return;
    }

    // ── Prevent double-submission ──
    setIsSubmitting(true);

    // ── Build the input object expected by the Supabase hook ──
    const input: AddCustomerInput = {
      name: form.name,
      business_name: form.business_name,
      phone: form.phone,
      email: form.email.trim() || undefined, // optional — omit if blank
      address: form.address,
      state: form.state,
      credit_limit: Number(form.credit_limit),
      location_id: form.location_id,
    };

    // ── Call the Supabase hook's async mutation ──
    const result = await addCustomer(input);

    if (result.success) {
      // Hook auto-refetches after insert — no manual refresh needed
      setToast({
        message: `Customer "${input.name}" added successfully!`,
        type: 'success',
      });
      // Close the modal and reset the form
      closeModal();
    } else {
      // Display the error message returned by Supabase
      setToast({
        message: result.error || 'Failed to add customer.',
        type: 'error',
      });
    }

    setIsSubmitting(false);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // ── Render ──────────────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <>
      <Topbar title="Customers" />

      {/* ── Toast Notification (renders at viewport top-right when active) ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className={styles.page}>
        {/* ── Loading State — shown while Supabase data is being fetched ── */}
        {loading ? (
          <div className={styles.emptyState} style={{ padding: '4rem 0', textAlign: 'center' }}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyText}>Loading customers…</div>
          </div>
        ) : (
        <>
        <div className={styles.headerBar}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, business, phone or state…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isCeo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-navy)', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={showDeleted} 
                  onChange={(e) => setShowDeleted(e.target.checked)} 
                  style={{ accentColor: 'var(--color-navy)', width: '16px', height: '16px' }}
                />
                Show Deleted
              </label>
            )}
            {/* Opens the Add Customer modal if not CEO */}
            {!isCeo && (
              <button className={styles.addBtn} onClick={openModal}>
                <span>＋</span>
                Add Customer
              </button>
            )}
          </div>
        </div>

        {/* ── Summary Cards: high-level KPIs across the full customer base ── */}
        <div className={styles.summaryBar}>
          {/* Card 1: Total customer count */}
          <div className={styles.summaryCard}>
            <span className={styles.summaryIcon}>👥</span>
            <div className={styles.summaryInfo}>
              <span className={styles.summaryLabel}>Total Customers</span>
              <span className={styles.summaryValue}>{displayCustomers.length}</span>
            </div>
          </div>
          {/* Card 2: Aggregate credit limit across all customers */}
          <div className={styles.summaryCard}>
            <span className={styles.summaryIcon}>💳</span>
            <div className={styles.summaryInfo}>
              <span className={styles.summaryLabel}>Total Credit Limit</span>
              <span className={styles.summaryValue}>₦{formatCurrency(totalCredit)}</span>
            </div>
          </div>
          {/* Card 3: Total outstanding (unpaid) balance */}
          <div className={styles.summaryCard}>
            <span className={styles.summaryIcon}>⏳</span>
            <div className={styles.summaryInfo}>
              <span className={styles.summaryLabel}>Outstanding Balance</span>
              <span className={styles.summaryValue}>₦{formatCurrency(totalOutstanding)}</span>
            </div>
          </div>
        </div>

        {/* ── Customer Data Table ── */}
        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Business Name</th>
                  <th>Phone</th>
                  <th>State</th>
                  <th className={styles.amountRight}>Credit Limit (₦)</th>
                  <th className={styles.amountRight}>Outstanding (₦)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🔍</div>
                        <div className={styles.emptyText}>
                          No customers match &ldquo;{search}&rdquo;
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td className={styles.customerName}>{c.name}</td>
                      <td className={styles.businessName}>{c.business_name}</td>
                      <td className={styles.phone}>{c.phone}</td>
                      <td className={styles.state}>{c.state}</td>
                      <td className={`${styles.amount} ${styles.amountRight}`}>
                        {formatCurrency(c.credit_limit)}
                      </td>
                      {/*
                       * Outstanding balance colour-coding:
                       *   > 0 → balancePositive (red/warning — money is owed)
                       *   = 0 → balanceZero     (neutral/green — fully paid)
                       */}
                      <td
                        className={`${styles.amount} ${styles.amountRight} ${
                          c.outstanding_balance > 0
                            ? styles.balancePositive
                            : styles.balanceZero
                        }`}
                      >
                        {formatCurrency(c.outstanding_balance)}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setEditCustomerId(c.id);
                            setEditForm({
                              name: c.name,
                              business_name: c.business_name,
                              phone: c.phone,
                              email: c.email || '',
                              address: c.address,
                              state: c.state,
                              credit_limit: c.credit_limit,
                            });
                          }}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', color: 'var(--color-ocean)', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* ── Table footer: filtered count vs total count ── */}
          <div className={styles.tableFooter}>
            <span>
              Showing {filtered.length} of {displayCustomers.length} customers
            </span>
          </div>
        </div>
        </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ── Add Customer Modal ──
          ═══════════════════════════════════════════════════════════════════
          Uses the shared Modal component for consistent glassmorphic styling.
          The form inside has 8 fields with full validation.
          ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Add New Customer"
        subtitle="Fill in the details below to register a new customer."
        maxWidth="620px"
      >
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* ── Row 1: Name + Business Name (side by side on desktop) ── */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="cust-name">
                Name <span className={styles.required}>*</span>
              </label>
              <input
                id="cust-name"
                type="text"
                name="name"
                className={styles.formInput}
                placeholder="e.g. Chinedu Okafor"
                value={form.name}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="cust-business">
                Business Name <span className={styles.required}>*</span>
              </label>
              <input
                id="cust-business"
                type="text"
                name="business_name"
                className={styles.formInput}
                placeholder="e.g. Okafor Pharma Ltd"
                value={form.business_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* ── Row 2: Phone + Email (side by side) ── */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="cust-phone">
                Phone <span className={styles.required}>*</span>
              </label>
              <input
                id="cust-phone"
                type="tel"
                name="phone"
                className={styles.formInput}
                placeholder="e.g. 08012345678"
                value={form.phone}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="cust-email">
                Email <span className={styles.formHint}>(optional)</span>
              </label>
              <input
                id="cust-email"
                type="email"
                name="email"
                className={styles.formInput}
                placeholder="e.g. chinedu@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* ── Row 3: Address (full width textarea) ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="cust-address">
              Address <span className={styles.required}>*</span>
            </label>
            <textarea
              id="cust-address"
              name="address"
              className={styles.formTextarea}
              placeholder="e.g. 15 New Market Road, Main Market, Onitsha"
              rows={3}
              value={form.address}
              onChange={handleChange}
              required
            />
          </div>

          {/* ── Row 4: State + Location (side by side dropdowns) ── */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="cust-state">
                State <span className={styles.required}>*</span>
              </label>
              <select
                id="cust-state"
                name="state"
                className={styles.formSelect}
                value={form.state}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  — Select State —
                </option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="cust-location">
                Location <span className={styles.required}>*</span>
              </label>
              <select
                id="cust-location"
                name="location_id"
                className={styles.formSelect}
                value={form.location_id}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  — Select Location —
                </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.state})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Row 5: Credit Limit (full width) ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="cust-credit">
              Credit Limit (₦) <span className={styles.required}>*</span>
            </label>
            <input
              id="cust-credit"
              type="number"
              name="credit_limit"
              className={styles.formInput}
              placeholder="e.g. 500000"
              min={0}
              value={form.credit_limit}
              onChange={handleChange}
              required
            />
          </div>

          {/* ── Form Actions: Cancel + Submit ── */}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding…' : '＋ Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editCustomerId !== null}
        onClose={() => setEditCustomerId(null)}
        title="Edit Customer"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editCustomerId) return;
            const result = await updateCustomer(editCustomerId, {
              name: editForm.name,
              business_name: editForm.business_name,
              phone: editForm.phone,
              email: editForm.email || null,
              address: editForm.address,
              state: editForm.state,
              credit_limit: editForm.credit_limit,
            });
            if (result.success) {
              setEditCustomerId(null);
              setToast({ message: 'Customer updated successfully', type: 'success' });
              void refetch();
            } else {
              setToast({ message: result.error || 'Failed to update', type: 'error' });
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Customer Name</label>
            <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Business Name</label>
            <input required value={editForm.business_name} onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Phone</label>
            <input required value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Email</label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Address</label>
            <input required value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>State</label>
            <input required value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Credit Limit (₦)</label>
            <input type="number" min={0} required value={editForm.credit_limit} onChange={(e) => setEditForm({ ...editForm, credit_limit: Number(e.target.value) })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setEditCustomerId(null)} style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)' }}>Cancel</button>
            <button type="submit" style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: 'var(--color-navy)', color: '#fff', cursor: 'pointer' }}>Save Changes</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
