/**
 * @file DashboardPage — AlbionOS Role-Based Dashboard
 *
 * This is the main landing page users see after logging in.  It renders a
 * completely different dashboard layout depending on the authenticated user's
 * role (super_admin, sales_rep, finance_manager, inventory_manager).
 *
 * Architecture
 * ────────────
 * - `StatCard`            — Reusable KPI card shown at the top of every dashboard.
 * - `AdminDashboard`      — CEO view: revenue, receivables, active reps, inventory value,
 *                           recent activity feed, and expiring-stock alerts.
 * - `SalesRepDashboard`   — Field rep view: personal inventory, sales totals, quick
 *                           actions (new invoice, add customer), and recent invoices.
 * - `FinanceDashboard`    — Finance view: receivables, payment verification queue,
 *                           and per-rep balance summaries.
 * - `InventoryDashboard`  — Warehouse manager view: total stock counts, warehouse
 *                           stock table, and recent stock movements.
 * - `DashboardPage`       — Exported page component that switches between the above
 *                           dashboards based on `user.role`.
 *
 * Data is fetched live from Supabase via hooks in `@/hooks/use-supabase-data`.
 *
 * @module (dashboard)/dashboard/page
 */

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Topbar from '@/components/layout/Topbar';
import {
  useInvoices, usePayments, useInventory,
  useProducts, useCustomers, useUsers, useLocations, useStockMovements,
  usePerformanceTargets, usePerformanceReviews,
  findProductById, findCustomerById, findUserById, findLocationById,
} from '@/hooks/use-supabase-data';
import styles from './dashboard.module.css';

/* ── Currency formatter — formats Naira values for display ── */
function fmt(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

// ═══════════════════════════════════════════════════════════════════════════
// ── StatCard — Reusable KPI metric card ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Renders a single Key Performance Indicator (KPI) card.
 *
 * Each card displays a label, formatted value, emoji icon, and an optional
 * trend indicator (up ↑ / down ↓) with a descriptive label.
 *
 * @param label      - Human-readable metric name, e.g. "Total Revenue".
 * @param value      - Pre-formatted display value, e.g. "₦12,450,000".
 * @param icon       - Emoji character used as a visual icon.
 * @param trend      - Optional direction indicator: 'up' (green) or 'down' (red).
 * @param trendLabel - Optional descriptive text next to the trend arrow.
 * @param color      - Optional CSS colour for the icon background;
 *                     defaults to `var(--color-ocean)` when omitted.
 */
function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  trend?: 'up' | 'down';
  trendLabel?: string;
  color?: string;
}) {
  return (
    <div className={styles.statCard}>
      {/* ── Top row: metric text on the left, coloured icon on the right ── */}
      <div className={styles.statTop}>
        <div className={styles.statInfo}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue}>{value}</span>
        </div>
        <div
          className={styles.statIcon}
          style={{ background: color || 'var(--color-ocean)' }}
        >
          {icon}
        </div>
      </div>

      {/* ── Trend row: only rendered when a trendLabel is provided ── */}
      {trendLabel && (
        <div className={styles.statTrend}>
          {/* Apply green/red class based on trend direction */}
          <span className={trend === 'up' ? styles.trendUp : styles.trendDown}>
            {trend === 'up' ? '↑' : '↓'} {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── AdminDashboard — CEO / Super-Admin view ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dashboard layout for the `super_admin` (CEO) role.
 *
 * Sections:
 *  1. **Stats Grid** — Four KPI cards: revenue, outstanding receivables,
 *     active sales reps, and inventory value.
 *  2. **Recent Activity** — A chronological feed of the latest system
 *     events (invoices, payments, allocations, registrations, alerts).
 *  3. **Expiring Stock** — Batch-level expiry countdown with colour-coded
 *     badges (danger < 30d, warning < 60d, safe ≥ 60d).
 */
function AdminDashboard() {
  /* ── Fetch live data from Supabase via hooks ── */
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { inventory } = useInventory();
  const { customers } = useCustomers();
  const { products } = useProducts();
  const { movements } = useStockMovements(10);

  const [now] = useState(() => Date.now());
  const timeAgo = (dateStr: string) => {
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  /* ── Compute KPIs from hook data ──
     useMemo recomputes whenever the underlying data arrays change. */
  const stats = useMemo(() => {
    // Revenue = sum of totals from paid/partial invoices
    const totalRevenue = invoices
      .filter((i) => i.status === 'paid' || i.status === 'partial')
      .reduce((sum, i) => sum + i.total, 0);

    // Receivables = sum of totals from sent/partial/overdue invoices
    const receivables = invoices
      .filter((i) => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.total, 0);

    // Inventory value = sum(qty * product_price) for all stock
    const inventoryValue = inventory.reduce((sum, item) => {
      const product = findProductById(products, item.product_id);
      return sum + (product ? product.unit_price * item.quantity : 0);
    }, 0);

    // Pending payments count
    const pendingPayments = payments.filter((p) => p.status === 'pending').length;

    // Expiring soon — items within 90 days, sorted by days remaining
    const now = new Date();
    const expiringItems = inventory
      .filter((item) => {
        const expiry = new Date(item.expiry_date);
        const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
        return days > 0 && days <= 90;
      })
      .map((item) => {
        const product = findProductById(products, item.product_id);
        const days = Math.ceil((new Date(item.expiry_date).getTime() - now.getTime()) / 86400000);
        return {
          name: product?.name || 'Unknown',
          batch: item.batch_number,
          days,
          level: days < 30 ? 'danger' : days < 60 ? 'warning' : 'safe',
        };
      })
      .sort((a, b) => a.days - b.days);

    return { totalRevenue, receivables, inventoryValue, pendingPayments, expiringItems, customers: customers.length };
  }, [invoices, payments, inventory, customers, products]);

  return (
    <>
      {/* ── KPI Stats Row — values computed from real data ── */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Total Revenue"
          value={fmt(stats.totalRevenue)}
          icon="💰"
          trend="up"
          trendLabel="From paid invoices"
          color="var(--color-success-light)"
        />
        <StatCard
          label="Outstanding Receivables"
          value={fmt(stats.receivables)}
          icon="📊"
          color="var(--color-warning-light)"
        />
        <StatCard
          label="Active Customers"
          value={String(stats.customers)}
          icon="👥"
          color="var(--color-info-light)"
        />
        <StatCard
          label="Inventory Value"
          value={fmt(stats.inventoryValue)}
          icon="📦"
          trend="up"
          trendLabel="Across all locations"
          color="var(--color-gold-tint)"
        />
      </div>

      {/* ── Content Cards: Activity Feed + Expiring Stock ── */}
      <div className={styles.contentGrid}>
        {/* Recent Activity feed — real stock movements */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Activity</h3>
          <div className={styles.activityList}>
            {movements.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No recent activity</p>
            ) : (
              movements.slice(0, 5).map((m, i) => (
                <div key={m.id || i} className={styles.activityItem}>
                  <span className={styles.activityIcon}>
                    {m.movement_type === 'allocation' ? '📦' : m.movement_type === 'receipt' ? '📥' : m.movement_type === 'sale' ? '🧾' : m.movement_type === 'adjustment' ? '📋' : '📌'}
                  </span>
                  <div className={styles.activityContent}>
                    <span className={styles.activityText}>
                      {m.movement_type === 'allocation' && `Allocated ${m.quantity}x ${m.product?.name || ''} to ${m.to_location?.name || 'another location'}`}
                      {m.movement_type === 'receipt' && `Received ${m.quantity}x ${m.product?.name || ''} at ${m.to_location?.name || 'warehouse'}`}
                      {m.movement_type === 'sale' && `Sale: ${m.quantity}x ${m.product?.name || ''}`}
                      {m.movement_type === 'adjustment' && `Adjustment: ${m.quantity > 0 ? '+' : ''}${m.quantity}x ${m.product?.name || ''} (stock take)`}
                      {!['allocation', 'receipt', 'sale', 'adjustment'].includes(m.movement_type) && `${m.movement_type}: ${m.quantity}x ${m.product?.name || ''}`}
                    </span>
                    <span className={styles.activityTime}>{timeAgo(m.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expiring Stock card — computed from real inventory data */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Expiring Stock</h3>
          <div className={styles.expiryList}>
            {stats.expiringItems.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No items expiring soon ✅</p>
            ) : (
              stats.expiringItems.slice(0, 5).map((item, i) => (
                <div key={i} className={styles.expiryItem}>
                  <div>
                    <span className={styles.expiryName}>{item.name}</span>
                    <span className={styles.expiryBatch}>Batch: {item.batch}</span>
                  </div>
                  <span className={`${styles.expiryBadge} ${styles[item.level]}`}>
                    {item.days} days
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SalesRepDashboard — Field Sales Representative view ───────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dashboard layout for the `sales_rep` role.
 *
 * Sections:
 *  1. **Stats Grid** — Personal KPIs: allocated inventory, monthly sales,
 *     outstanding customer balances, and customer count.
 *  2. **Quick Actions** — Four shortcut buttons for the most common field
 *     workflows (new invoice, add customer, message finance, stock take).
 *  3. **Recent Invoices** — A summary list of the rep's latest invoices
 *     with colour-coded status badges (Paid / Pending / Overdue).
 */
function SalesRepDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  /* ── Fetch live data from Supabase via hooks ── */
  const { invoices } = useInvoices();
  const { inventory } = useInventory();
  const { customers } = useCustomers();

  /* ── Compute sales rep KPIs from hook data ── */
  const stats = useMemo(() => {
    const totalSales = invoices
      .filter((i) => i.sales_rep_id === user?.id)
      .filter((i) => i.status === 'paid' || i.status === 'partial')
      .reduce((sum, i) => sum + i.total, 0);
      
    const filteredCustomers = customers.filter((c) => c.location_id === user?.location_id);
    const outstandingBal = filteredCustomers.reduce((sum, c) => sum + c.outstanding_balance, 0);
    
    const totalUnits = inventory
      .filter((item) => item.location_id === user?.location_id)
      .reduce((sum, item) => sum + item.quantity, 0);

    // Get last 3 invoices for the Recent Invoices section
    const recentInvoices = invoices.filter((inv) => inv.sales_rep_id === user?.id).slice(0, 3).map((inv) => {
      const customer = findCustomerById(customers, inv.customer_id);
      return {
        id: inv.invoice_number,
        customer: customer?.business_name || customer?.name || 'Unknown',
        amount: fmt(inv.total),
        status: inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
      };
    });

    return { totalUnits, totalSales, outstandingBal, customerCount: filteredCustomers.length, recentInvoices };
  }, [invoices, inventory, customers, user]);

  return (
    <>
      {/* ── KPI Stats Row — computed from real data ── */}
      <div className={styles.statsGrid}>
        <StatCard label="My Inventory" value={`${stats.totalUnits} units`} icon="📦" color="var(--color-info-light)" />
        <StatCard
          label="Total Sales"
          value={fmt(stats.totalSales)}
          icon="💰"
          trend="up"
          trendLabel="From paid invoices"
          color="var(--color-success-light)"
        />
        <StatCard label="Outstanding Balances" value={fmt(stats.outstandingBal)} icon="⏳" color="var(--color-warning-light)" />
        <StatCard label="Customers" value={String(stats.customerCount)} icon="👥" color="var(--color-gold-tint)" />
      </div>

      {/* ── Content Cards: Quick Actions + Recent Invoices ── */}
      <div className={styles.contentGrid}>
        {/* Quick Actions grid — workflow shortcut buttons for the field */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Quick Actions</h3>
          </div>
          <div className={styles.quickActions}>
            <button className={styles.actionBtn} onClick={() => router.push('/invoices')}>
              <span className={styles.actionIcon}>🧾</span>
              <span>New Invoice</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/customers')}>
              <span className={styles.actionIcon}>👤</span>
              <span>Add Customer</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/chat?role=finance_manager')}>
              <span className={styles.actionIcon}>💬</span>
              <span>Message Finance</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/inventory')}>
              <span className={styles.actionIcon}>📋</span>
              <span>Stock Take</span>
            </button>
          </div>
        </div>

        {/* Recent Invoices list — status drives a ternary class selector */}
        {/* Recent Invoices — computed from real data */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Invoices</h3>
          <div className={styles.invoiceList}>
            {stats.recentInvoices.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No recent invoices yet</p>
            ) : (
              stats.recentInvoices.map((inv) => (
                <div key={inv.id} className={styles.invoiceItem}>
                  <div>
                    <span className={styles.invoiceId}>{inv.id}</span>
                    <span className={styles.invoiceCustomer}>{inv.customer}</span>
                  </div>
                  <div className={styles.invoiceRight}>
                    <span className={styles.invoiceAmount}>{inv.amount}</span>
                    <span
                      className={`${styles.invoiceStatus} ${
                        inv.status === 'Paid'
                          ? styles.statusPaid
                          : inv.status === 'Overdue'
                          ? styles.statusOverdue
                          : inv.status === 'Draft'
                          ? styles.statusDraft
                          : styles.statusPending
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── My Performance & Targets Card ── */}
        <div className={styles.card} style={{ gridColumn: 'span 2' }}>
          <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className={styles.cardTitle}>🎯 My Performance & Targets</h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(34,197,94,0.15)', color: '#15803d' }}>
              Q3 Active
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '0.75rem' }}>
            {/* Sales Target Bar */}
            <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--color-gray)' }}>Sales Goal (₦1.5M)</span>
                <span style={{ fontWeight: 700, color: 'var(--color-ocean)' }}>
                  {Math.min(100, Math.round((stats.totalSales / 1500000) * 100))}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.round((stats.totalSales / 1500000) * 100))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #0284c7, #22c55e)',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-gray)' }}>
                {fmt(stats.totalSales)} of ₦1,500,000 achieved
              </p>
            </div>

            {/* Collection Target Bar */}
            <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--color-gray)' }}>Collection Rate</span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>
                  {stats.totalSales > 0 ? Math.round((stats.totalSales / (stats.totalSales + stats.outstandingBal)) * 100) : 100}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${stats.totalSales > 0 ? Math.round((stats.totalSales / (stats.totalSales + stats.outstandingBal)) * 100) : 100}%`,
                    height: '100%',
                    background: '#15803d',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-gray)' }}>
                {fmt(stats.totalSales)} collected / {fmt(stats.outstandingBal)} outstanding
              </p>
            </div>

            {/* Performance Review Badge */}
            <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⭐</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Rating: 3.5 / 5.0</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-gray)' }}>Latest Review — Meets Expectations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── FinanceDashboard — Finance Manager view ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dashboard layout for the `finance_manager` role.
 *
 * Sections:
 *  1. **Stats Grid** — Financial KPIs: total receivables, monthly
 *     collections, pending payment approvals, and 90+ day overdue amounts.
 *  2. **Payment Verification Queue** — List of payments submitted by
 *     sales reps that need finance approval. Each row shows the rep,
 *     customer, amount, and payment method with an "Approve" CTA.
 *  3. **Rep Balance Summary** — Compact overview of each rep's stock
 *     value, collected amounts, and outstanding dues.
 */
function FinanceDashboard() {
  /* ── Fetch live data from Supabase via hooks ── */
  const { user } = useAuth();
  const { invoices } = useInvoices();
  const { payments, approvePayment, rejectPayment } = usePayments();
  const { customers } = useCustomers();
  const { users } = useUsers();
  const { inventory } = useInventory();
  const { products } = useProducts();

  /* ── Approve / reject action state per payment ── */
  const [actionState, setActionState] = useState<Record<string, 'approving' | 'rejecting'>>({});
  const [actionError, setActionError] = useState('');

  const handleApprove = async (paymentId: string) => {
    if (!user) return;
    setActionError('');
    setActionState((s) => ({ ...s, [paymentId]: 'approving' }));
    const res = await approvePayment(paymentId, user.id);
    if (!res.success) setActionError(res.error || 'Failed to approve payment');
    setActionState((s) => {
      const next = { ...s };
      delete next[paymentId];
      return next;
    });
  };

  const handleReject = async (paymentId: string) => {
    if (!user) return;
    setActionError('');
    setActionState((s) => ({ ...s, [paymentId]: 'rejecting' }));
    const res = await rejectPayment(paymentId, user.id);
    if (!res.success) setActionError(res.error || 'Failed to reject payment');
    setActionState((s) => {
      const next = { ...s };
      delete next[paymentId];
      return next;
    });
  };

  /* ── Compute finance KPIs from hook data ── */
  const stats = useMemo(() => {
    const receivables = invoices
      .filter((i) => ['sent', 'partial', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + i.total, 0);
    const approvedTotal = payments
      .filter((p) => p.status === 'approved')
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingCount = payments.filter((p) => p.status === 'pending').length;
    const overdueAmount = invoices
      .filter((i) => i.status === 'overdue')
      .reduce((sum, i) => sum + i.total, 0);

    // Build payment queue for the pending approvals card
    const pendingPayments = payments
      .filter((p) => p.status === 'pending')
      .map((p) => {
        const customer = findCustomerById(customers, p.customer_id);
        const rep = findUserById(users, p.recorded_by);
        return {
          id: p.id,
          rep: rep?.full_name || 'Unknown',
          customer: customer?.business_name || customer?.name || 'Unknown',
          amount: fmt(p.amount),
          method: p.method === 'bank_transfer' ? 'Bank Transfer' : 'Cash',
          time: new Date(p.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
        };
      });

    // Per-rep balance summary computed from real data
    const repSummary = users
      .filter((u) => u.role === 'sales_rep')
      .map((rep) => {
        const stockValue = inventory
          .filter((item) => item.location_id === rep.location_id)
          .reduce((sum, item) => {
            const product = findProductById(products, item.product_id);
            return sum + (product ? product.unit_price * item.quantity : 0);
          }, 0);
        const collected = payments
          .filter((p) => p.status === 'approved' && p.recorded_by === rep.id)
          .reduce((sum, p) => sum + p.amount, 0);
        const outstanding = invoices
          .filter((i) => i.sales_rep_id === rep.id && ['sent', 'partial', 'overdue'].includes(i.status))
          .reduce((sum, i) => sum + i.total, 0);
        return { name: rep.full_name, stockValue, collected, outstanding };
      })
      .filter((r) => r.stockValue > 0 || r.collected > 0 || r.outstanding > 0);

    return { receivables, approvedTotal, pendingCount, overdueAmount, pendingPayments, repSummary };
  }, [invoices, payments, customers, users, inventory, products]);

  return (
    <>
      {/* ── KPI Stats Row — computed from real data ── */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Total Receivables"
          value={fmt(stats.receivables)}
          icon="💰"
          color="var(--color-danger-light)"
        />
        <StatCard
          label="Total Collected"
          value={fmt(stats.approvedTotal)}
          icon="✅"
          trend="up"
          trendLabel="Approved payments"
          color="var(--color-success-light)"
        />
        <StatCard
          label="Pending Approvals"
          value={String(stats.pendingCount)}
          icon="⏳"
          color="var(--color-warning-light)"
        />
        <StatCard label="Overdue" value={fmt(stats.overdueAmount)} icon="🚨" color="var(--color-danger-light)" />
      </div>

      {/* ── Content Cards: Payment Queue + Rep Summary ── */}
      <div className={styles.contentGrid}>
        {/* Payment Verification Queue — payments awaiting finance approval */}
          <div className={styles.card}>
          <h3 className={styles.cardTitle}>Payment Verification Queue</h3>
          {actionError && (
            <p style={{ color: 'var(--color-danger)', marginBottom: '8px' }}>{actionError}</p>
          )}
          <div className={styles.paymentQueue}>
            {stats.pendingPayments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No pending payments ✅</p>
            ) : (
              stats.pendingPayments.map((p, i) => (
                <div key={p.id || i} className={styles.paymentItem}>
                  <div className={styles.paymentInfo}>
                    <span className={styles.paymentRep}>{p.rep}</span>
                    <span className={styles.paymentCustomer}>{p.customer} · {p.method} · {p.time}</span>
                  </div>
                  <div className={styles.paymentActions}>
                    <span className={styles.paymentAmount}>{p.amount}</span>
                    <button
                      className={styles.approveBtn}
                      disabled={!!actionState[p.id]}
                      onClick={() => handleApprove(p.id)}
                    >
                      {actionState[p.id] === 'approving' ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      className={styles.rejectBtn}
                      disabled={!!actionState[p.id]}
                      onClick={() => handleReject(p.id)}
                    >
                      {actionState[p.id] === 'rejecting' ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rep Balance Summary — stock, collected, and outstanding per rep */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Rep Balance Summary</h3>
          <div className={styles.repSummary}>
            {stats.repSummary.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No sales rep balances found</p>
            ) : (
              stats.repSummary.map((r, i) => (
                <div key={i} className={styles.repRow}>
                  <span className={styles.repName}>{r.name}</span>
                  <span className={styles.repStat}>Stock: {fmt(r.stockValue)}</span>
                  <span className={styles.repStat}>Collected: {fmt(r.collected)}</span>
                  <span className={styles.repOutstanding}>Due: {fmt(r.outstanding)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── InventoryDashboard — Warehouse / Inventory Manager view ───────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dashboard layout for the `inventory_manager` role.
 *
 * Sections:
 *  1. **Stats Grid** — Inventory KPIs: total stock units, product count,
 *     items expiring within 30 days, and pending transfer requests.
 *  2. **Warehouse Stock Overview** — Tabular list of products held at the
 *     Onitsha HQ warehouse with quantities, batch numbers, and expiry dates.
 *  3. **Recent Movements** — Chronological feed of stock allocations,
 *     receipts, and stock-take results.
 */
function InventoryDashboard() {
  /* ── Fetch live data from Supabase via hooks ── */
  const { inventory } = useInventory();
  const { products } = useProducts();
  const { locations } = useLocations();
  const { movements } = useStockMovements(10);

  const [now] = useState(() => Date.now());
  const timeAgo = (dateStr: string) => {
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  /* ── Compute inventory KPIs from hook data ── */
  const stats = useMemo(() => {
    const now = new Date();

    const totalUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const expiringUnits = inventory
      .filter((item) => {
        const days = Math.ceil((new Date(item.expiry_date).getTime() - now.getTime()) / 86400000);
        return days > 0 && days <= 30;
      })
      .reduce((sum, item) => sum + item.quantity, 0);

    // Warehouse stock for the table
    const warehouseStock = inventory
      .filter((item) => {
        const loc = findLocationById(locations, item.location_id);
        return loc?.type === 'warehouse';
      })
      .map((item) => {
        const product = findProductById(products, item.product_id);
        return {
          name: product?.name || 'Unknown',
          qty: item.quantity,
          batch: item.batch_number,
          expiry: item.expiry_date,
        };
      });

    const lowStockCount = inventory.filter((item) => item.quantity > 0 && item.quantity < 50).length;

    return { totalUnits, productCount: products.length, expiringUnits, warehouseStock, lowStockCount };
  }, [inventory, products, locations]);

  return (
    <>
      {/* ── KPI Stats Row — computed from real data ── */}
      <div className={styles.statsGrid}>
        <StatCard label="Total Stock" value={`${stats.totalUnits.toLocaleString('en-NG')} units`} icon="📦" color="var(--color-info-light)" />
        <StatCard label="Products" value={String(stats.productCount)} icon="💊" color="var(--color-gold-tint)" />
        <StatCard
          label="Expiring Soon (30d)"
          value={`${stats.expiringUnits} units`}
          icon="⚠️"
          color="var(--color-warning-light)"
        />
        <StatCard label="Low Stock Items" value={String(stats.lowStockCount)} icon="⚠️" color="var(--color-warning-light)" />
      </div>

      {/* ── Content Cards: Stock Table + Movements ── */}
      <div className={styles.contentGrid}>
        {/* Warehouse Stock Overview — grid-style table of current stock */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Warehouse Stock Overview</h3>
          <div className={styles.stockTable}>
            <div className={styles.stockHeader}>
              <span>Product</span>
              <span>Qty</span>
              <span>Batch</span>
              <span>Expiry</span>
            </div>
            {stats.warehouseStock.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No warehouse stock found</p>
            ) : (
              stats.warehouseStock.map((item, i) => (
                <div key={i} className={styles.stockRow}>
                  <span className={styles.stockName}>{item.name}</span>
                  <span className={styles.stockQty}>{item.qty}</span>
                  <span className={styles.stockBatch}>{item.batch}</span>
                  <span className={styles.stockExpiry}>{item.expiry}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Movements feed — allocations, receipts, stock takes */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Movements</h3>
          <div className={styles.activityList}>
            {movements.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No recent movements</p>
            ) : (
              movements.slice(0, 5).map((m, i) => (
                <div key={m.id || i} className={styles.activityItem}>
                  <span className={styles.activityIcon}>
                    {m.movement_type === 'allocation' ? '📤' : m.movement_type === 'receipt' ? '📥' : m.movement_type === 'sale' ? '🧾' : '📋'}
                  </span>
                  <div className={styles.activityContent}>
                    <span className={styles.activityText}>
                      {m.movement_type === 'allocation' && `Allocated ${m.quantity}x ${m.product?.name || 'items'} to ${m.to_location?.name || 'another location'}`}
                      {m.movement_type === 'receipt' && `Received ${m.quantity}x ${m.product?.name || 'items'} at ${m.to_location?.name || 'warehouse'}`}
                      {m.movement_type === 'sale' && `Sold ${m.quantity}x ${m.product?.name || 'items'}`}
                      {m.movement_type === 'adjustment' && `Adjusted ${m.quantity > 0 ? '+' : ''}${m.quantity}x ${m.product?.name || 'items'} (stock take)`}
                    </span>
                    <span className={styles.activityTime}>{timeAgo(m.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── DashboardPage — Exported page component (role-based router) ──────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main dashboard page component — the default route after login.
 *
 * **Role-based rendering:**
 * The component reads `user.role` from the auth context and conditionally
 * renders the matching sub-dashboard.  Each role maps to exactly one
 * dashboard component; no role ever sees another role's dashboard.
 *
 * **Greeting logic:**
 * - The `greetings` record maps each role key to a human-readable title
 *   displayed in the Topbar (e.g. "CEO Dashboard").
 * - The welcome text extracts the user's first name by splitting
 *   `user.full_name` on spaces and taking the first token.
 *
 * @returns The fully rendered dashboard page, or `null` while the auth
 *          context is still loading (user is undefined).
 */
export default function DashboardPage() {
  const { user } = useAuth();

  // Guard: render nothing until the auth context has resolved the user
  if (!user) return null;

  /**
   * Maps each role slug to a friendly Topbar title.
   * Falls back to the generic "Dashboard" if the role is unrecognised.
   */
  const greetings: Record<string, string> = {
    super_admin: 'Admin Dashboard',
    ceo: 'CEO Dashboard',
    sales_rep: 'Sales Dashboard',
    finance_manager: 'Finance Dashboard',
    inventory_manager: 'Inventory Dashboard',
  };

  return (
    <>
      <Topbar title={greetings[user.role] || 'Dashboard'} />
      <div className={styles.page}>
        {/* ── Personalised greeting ── */}
        <div className={styles.greeting}>
          <h2 className={styles.greetingText}>
            {/* Extract first name only — e.g. "Chidi Okafor" → "Chidi" */}
            Welcome back, {user.full_name.split(' ')[0]} 👋
          </h2>
          <p className={styles.greetingSub}>
            Here&apos;s what&apos;s happening at Albion today.
          </p>
        </div>

        {/*
         * ── Role-based dashboard switch ──
         * Only the dashboard matching the user's role is rendered.
         * Each condition is mutually exclusive by design.
         */}
        {(user.role === 'super_admin' || user.role === 'ceo') && <AdminDashboard />}
        {user.role === 'sales_rep' && <SalesRepDashboard />}
        {user.role === 'finance_manager' && <FinanceDashboard />}
        {user.role === 'inventory_manager' && <InventoryDashboard />}
      </div>
    </>
  );
}
