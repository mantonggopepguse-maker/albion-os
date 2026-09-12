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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Topbar from '@/components/layout/Topbar';
import AnnouncementBanner from '@/components/ui/AnnouncementBanner';
import Modal from '@/components/ui/Modal';
import { applyCompensationAdjustment } from '@/lib/data-service';
import {
  useInvoices, usePayments, useInventory,
  useProducts, useCustomers, useUsers, useLocations, useStockMovements,
  useClinicPatients, useClinicAppointments, useClinicTreatments,
  useExpenses, useCashReconciliations,
  findProductById, findCustomerById, findUserById, findLocationById,
} from '@/hooks/use-supabase-data';
import { getRoleLabel } from '@/lib/navigation';
import type { UserRole } from '@/lib/types';
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
// ── UnifiedSuperAdminDashboard — CEO / Super-Admin Bento Grid Command Center ──
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Executive Dashboard for the `super_admin` (CEO) role.
 *
 * Focuses strictly on executive management:
 *  - Commercial sales vs. veterinary clinic revenues
 *  - Territory allocations and sales rep performance
 *  - Clinic facility performance, expenses, and branch stock
 *  - Inventory expiry risk and governance approvals
 */
function UnifiedSuperAdminDashboard() {
  const router = useRouter();
  /* ── Live data across both divisions ── */
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { inventory } = useInventory();
  const { customers } = useCustomers();
  const { products } = useProducts();
  const { users } = useUsers();
  const { locations } = useLocations();
  const { expenses } = useExpenses();
  const { treatments } = useClinicTreatments();
  const { patients } = useClinicPatients();
  const { reconciliations } = useCashReconciliations();

  /* ── Compute Executive KPIs & Operational Summaries ── */
  const stats = useMemo(() => {
    // 1. Commercial wholesale revenue (paid & partial)
    const pharmaRevenue = invoices
      .filter((i) => i.status === 'paid' || i.status === 'partial')
      .reduce((sum, i) => sum + i.total, 0);

    // 2. Accounts Receivable
    const receivables = invoices
      .filter((i) => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.total, 0);

    // 3. Total Inventory Value (across all facilities)
    const totalInventoryValue = inventory.reduce((sum, item) => {
      const product = findProductById(products, item.product_id);
      return sum + (product ? product.unit_price * item.quantity : 0);
    }, 0);

    // 4. Sales Rep Allocations & Performance Breakdown
    const salesReps = users.filter((u) => u.role === 'sales_rep');
    const repSummaries = salesReps.map((rep) => {
      const repInvoices = invoices.filter((i) => i.sales_rep_id === rep.id);
      const repSales = repInvoices
        .filter((i) => i.status === 'paid' || i.status === 'partial')
        .reduce((sum, i) => sum + i.total, 0);

      const repStock = inventory.filter((item) => item.location_id === rep.location_id);
      const repUnits = repStock.reduce((sum, item) => sum + item.quantity, 0);
      const repVal = repStock.reduce((sum, item) => {
        const product = findProductById(products, item.product_id);
        return sum + (product ? product.unit_price * item.quantity : 0);
      }, 0);

      const repCustomers = customers.filter((c) => c.location_id === rep.location_id);
      const repReceivables = repCustomers.reduce((sum, c) => sum + c.outstanding_balance, 0);
      const territory = locations.find((l) => l.id === rep.location_id);

      return {
        id: rep.id,
        name: rep.full_name,
        territory: territory?.name || 'Sales Territory',
        sales: repSales,
        allocatedUnits: repUnits,
        allocatedValue: repVal,
        receivables: repReceivables,
      };
    });

    const repAllocationsValue = repSummaries.reduce((sum, r) => sum + r.allocatedValue, 0);

    // 5. Clinic Network Breakdown & Stock Allocations (100% reconciled with clinic views)
    const clinicLocations = locations.filter((l) => l.type === 'clinic');
    const clinicSummaries = clinicLocations.map((clinic) => {
      const clinicItems = inventory.filter((item) => item.location_id === clinic.id);
      const stockUnits = clinicItems.reduce((sum, item) => sum + item.quantity, 0);
      const stockVal = clinicItems.reduce((sum, item) => {
        const product = findProductById(products, item.product_id);
        return sum + (product ? product.unit_price * item.quantity : 0);
      }, 0);

      const branchReconciliations = reconciliations.filter((r) => r.location_id === clinic.id);
      const branchTx = treatments.filter((t) => t.location_id === clinic.id);
      const branchRevenue =
        branchReconciliations.reduce((sum, r) => sum + (r.total_actual || 0), 0) +
        branchTx.reduce((sum, t) => sum + (t.total_cost || 0), 0);

      const branchExpenses = expenses.filter((e) => e.location_id === clinic.id);
      const totalBranchExpenses = branchExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netMargin = branchRevenue - totalBranchExpenses;

      const branchPatients = patients.filter((p) => p.location_id === clinic.id);

      return {
        id: clinic.id,
        name: clinic.name,
        state: clinic.state || clinic.region || 'Nigeria',
        stockUnits,
        stockValue: stockVal,
        expenses: totalBranchExpenses,
        revenue: branchRevenue,
        netMargin,
        treatmentCount: branchTx.length > 0 ? branchTx.length : branchPatients.length,
      };
    });

    const clinicAllocationsValue = clinicSummaries.reduce((sum, c) => sum + c.stockValue, 0);
    const totalClinicRevenue = clinicSummaries.reduce((sum, c) => sum + c.revenue, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const pendingPaymentApprovals = payments.filter((p) => p.status === 'pending').length;

    // 6. Expiring stock countdown
    const nowDate = new Date();
    const expiringItems = inventory
      .filter((item) => {
        const expiry = new Date(item.expiry_date);
        const days = Math.ceil((expiry.getTime() - nowDate.getTime()) / 86400000);
        return days > 0 && days <= 90;
      })
      .map((item) => {
        const product = findProductById(products, item.product_id);
        const days = Math.ceil((new Date(item.expiry_date).getTime() - nowDate.getTime()) / 86400000);
        const loc = locations.find((l) => l.id === item.location_id);
        return {
          name: product?.name || 'Unknown Item',
          batch: item.batch_number,
          location: loc?.name || 'Central Warehouse',
          days,
          level: days < 30 ? 'danger' : days < 60 ? 'warning' : 'safe',
        };
      })
      .sort((a, b) => a.days - b.days);

    return {
      pharmaRevenue,
      clinicRevenue: totalClinicRevenue,
      totalRevenue: pharmaRevenue + totalClinicRevenue,
      receivables,
      totalInventoryValue,
      repAllocationsValue,
      clinicAllocationsValue,
      totalExpenses,
      repSummaries,
      clinicSummaries,
      pendingPaymentApprovals,
      expiringItems,
      clinicCount: clinicLocations.length,
      staffCount: users.length,
    };
  }, [invoices, payments, inventory, customers, products, locations, users, expenses, treatments, patients]);

  return (
    <>
      {/* ── Executive Overview Header (Clean Business Tone) ── */}
      <div className={styles.bentoHero}>
        <div className={styles.bentoHeroHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className={styles.bentoPill} style={{ background: '#093961', color: '#fff', border: 'none' }}>
                EXECUTIVE DASHBOARD
              </span>
              <span className={styles.bentoPill} style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#15803d', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                ● Operations Active
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-0.02em' }}>
              Albion Pharmaceuticals & Veterinary Practice Group
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Executive overview of commercial wholesale distribution, veterinary clinic operations, inventory allocations, and group financials.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className={styles.bentoPill}>
              📅 Fiscal Year 2026
            </span>
            <span className={styles.bentoPill}>
              🏢 2 Operating Divisions
            </span>
            <span className={styles.bentoPill}>
              📍 {stats.clinicCount} Clinics & {stats.repSummaries.length} Territories
            </span>
          </div>
        </div>
      </div>

      {/* ── 6 Master Executive KPIs ── */}
      <div className={styles.statsGridSix}>
        <StatCard
          label="Pharma Sales"
          value={fmt(stats.pharmaRevenue)}
          icon="💰"
          trend="up"
          trendLabel="Wholesale receipts"
          color="var(--color-success-light)"
        />
        <StatCard
          label="Clinic Revenue"
          value={fmt(stats.clinicRevenue)}
          icon="🏥"
          trend="up"
          trendLabel="Practice receipts"
          color="rgba(168, 85, 247, 0.15)"
        />
        <StatCard
          label="Receivables"
          value={fmt(stats.receivables)}
          icon="📊"
          trendLabel="Uncollected balance"
          color="var(--color-warning-light)"
        />
        <StatCard
          label="Total Inventory"
          value={fmt(stats.totalInventoryValue)}
          icon="📦"
          trend="up"
          trendLabel="Central + all branches"
          color="var(--color-gold-tint)"
        />
        <StatCard
          label="Rep Allocations"
          value={fmt(stats.repAllocationsValue)}
          icon="💼"
          trendLabel="Stock in field"
          color="var(--color-info-light)"
        />
        <StatCard
          label="Clinic Stock"
          value={fmt(stats.clinicAllocationsValue)}
          icon="🩺"
          trendLabel="Stock at clinics"
          color="rgba(14, 165, 233, 0.15)"
        />
      </div>

      {/* ── Core Divisions Grid: Sales Reps & Allocations vs. Clinic Network ── */}
      <div className={styles.bentoGridTwo}>
        {/* Column 1: Commercial Distribution & Sales Rep Allocations */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Commercial Sales Reps & Allocations</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Stock allocated to field reps, current sales volume, and territory receivables
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(9, 57, 97, 0.08)', color: '#093961' }}>
              {stats.repSummaries.length} Active Reps
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Link href="/inventory" prefetch={true} className={styles.actionBtn} style={{ padding: '8px', minHeight: 'auto' }}>
              <span className={styles.actionIcon} style={{ width: '26px', height: '26px', fontSize: '13px' }}>📦</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Allocate Stock</span>
            </Link>
            <Link href="/invoices" prefetch={true} className={styles.actionBtn} style={{ padding: '8px', minHeight: 'auto' }}>
              <span className={styles.actionIcon} style={{ width: '26px', height: '26px', fontSize: '13px' }}>🧾</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Invoices</span>
            </Link>
            <Link href="/staff" prefetch={true} className={styles.actionBtn} style={{ padding: '8px', minHeight: 'auto' }}>
              <span className={styles.actionIcon} style={{ width: '26px', height: '26px', fontSize: '13px' }}>👥</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Sales Team</span>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {stats.repSummaries.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No sales reps found</p>
            ) : (
              stats.repSummaries.map((rep) => (
                <Link key={rep.id} href={`/staff/${rep.id}`} prefetch={true} className={styles.invoiceItem} style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-navy)' }}>
                        {rep.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(9, 57, 97, 0.08)', color: '#093961' }}>
                        {rep.territory}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Allocated Stock: <strong style={{ color: 'var(--color-navy)' }}>{rep.allocatedUnits} units</strong> ({fmt(rep.allocatedValue)})
                    </span>
                  </div>
                  <div className={styles.invoiceRight} style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#16a34a' }}>
                      {fmt(rep.sales)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: rep.receivables > 0 ? '#b45309' : 'var(--color-text-muted)' }}>
                      Receivables: {fmt(rep.receivables)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Veterinary Clinic Network Performance (Reconciled with Clinic Detail) */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Veterinary Clinic Network</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Branch performance, stock allocations, operating overheads & case volume
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(168, 85, 247, 0.12)', color: '#7c3aed' }}>
              {stats.clinicCount} Facilities
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Link href="/clinic" prefetch={true} className={styles.actionBtn} style={{ padding: '8px', minHeight: 'auto' }}>
              <span className={styles.actionIcon} style={{ width: '26px', height: '26px', fontSize: '13px' }}>🏥</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>All Clinics</span>
            </Link>
            <Link href="/expenses" prefetch={true} className={styles.actionBtn} style={{ padding: '8px', minHeight: 'auto' }}>
              <span className={styles.actionIcon} style={{ width: '26px', height: '26px', fontSize: '13px' }}>📉</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Expenses</span>
            </Link>
            <Link href="/inventory" prefetch={true} className={styles.actionBtn} style={{ padding: '8px', minHeight: 'auto' }}>
              <span className={styles.actionIcon} style={{ width: '26px', height: '26px', fontSize: '13px' }}>📦</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Clinic Stock</span>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {stats.clinicSummaries.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No clinic facilities found</p>
            ) : (
              stats.clinicSummaries.map((clinic) => (
                <Link key={clinic.id} href={`/clinic/${clinic.id}`} prefetch={true} className={styles.invoiceItem} style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-navy)' }}>
                        {clinic.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.1)', color: '#7c3aed' }}>
                        {clinic.state}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Allocated Stock: <strong style={{ color: 'var(--color-navy)' }}>{clinic.stockUnits} units</strong> ({fmt(clinic.stockValue)})
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      Overheads: {fmt(clinic.expenses)} · {clinic.treatmentCount} Cases
                    </span>
                  </div>
                  <div className={styles.invoiceRight} style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                      {fmt(clinic.revenue)}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: clinic.netMargin >= 0 ? '#15803d' : '#dc2626' }}>
                      Net: {fmt(clinic.netMargin)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-ocean)' }}>
                      View Branch →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Expiry Watchlist & Executive Management Actions ── */}
      <div className={styles.bentoGridTwo}>
        {/* Expiring Stock Watchlist */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Expiring Stock Watchlist</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Batches expiring within 90 days across central warehouse and branches
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
              {stats.expiringItems.length} Monitored
            </span>
          </div>
          <div className={styles.expiryList}>
            {stats.expiringItems.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No items expiring soon ✅</p>
            ) : (
              stats.expiringItems.slice(0, 4).map((item, i) => (
                <div key={i} className={styles.expiryItem}>
                  <div>
                    <span className={styles.expiryName}>{item.name}</span>
                    <span className={styles.expiryBatch}>Batch: {item.batch} &middot; {item.location}</span>
                  </div>
                  <span className={`${styles.expiryBadge} ${styles[item.level]}`}>
                    {item.days} days
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Executive Management Actions & Governance */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Management & Governance</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Executive reporting, workforce oversight, and institutional controls
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7' }}>
              Executive Controls
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
            <button className={styles.actionBtn} onClick={() => router.push('/reports')}>
              <span className={styles.actionIcon}>📈</span>
              <span style={{ fontWeight: 600 }}>Financial & BI Audits</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Revenue, taxes & P&L</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/staff')}>
              <span className={styles.actionIcon}>👥</span>
              <span style={{ fontWeight: 600 }}>Workforce & HR</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Profiles, roles & leave</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/clinic')}>
              <span className={styles.actionIcon}>🏥</span>
              <span style={{ fontWeight: 600 }}>Clinic Facilities</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Locations & capacity</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/payroll')}>
              <span className={styles.actionIcon}>💳</span>
              <span style={{ fontWeight: 600 }}>Corporate Payroll</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Runs, payslips & tax</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/audit')}>
              <span className={styles.actionIcon}>🛡️</span>
              <span style={{ fontWeight: 600 }}>Audit Trail Vault</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Compliance & logs</span>
            </button>
            <button className={styles.actionBtn} onClick={() => router.push('/chat')}>
              <span className={styles.actionIcon}>💬</span>
              <span style={{ fontWeight: 600 }}>Internal Comms</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Direct messaging</span>
            </button>
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
  const router = useRouter();
  /* ── Fetch live data from Supabase via hooks ── */
  const { user } = useAuth();
  const { invoices } = useInvoices();
  const { payments, approvePayment, rejectPayment } = usePayments();
  const { customers } = useCustomers();
  const { users } = useUsers();
  const { inventory } = useInventory();
  const { products } = useProducts();
  const { locations } = useLocations();
  const { treatments } = useClinicTreatments();
  const { expenses } = useExpenses();

  /* ── Approve / reject action state per payment ── */
  const [actionState, setActionState] = useState<Record<string, 'approving' | 'rejecting'>>({});
  const [actionError, setActionError] = useState('');

  /* ── Grouped View Tab ── */
  const [financeTab, setFinanceTab] = useState<'reps' | 'clinics' | 'staff'>('reps');

  /* ── Financial Adjustment Modal State ── */
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjEmployeeId, setAdjEmployeeId] = useState('');
  const [adjType, setAdjType] = useState<'increase' | 'reduction' | 'bonus' | 'incentive'>('bonus');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjSuccess, setAdjSuccess] = useState('');
  const [adjError, setAdjError] = useState('');

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

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(adjAmount);
    if (!adjEmployeeId) {
      setAdjError('Please select a staff employee.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setAdjError('Please enter a valid amount.');
      return;
    }
    if (!adjReason.trim()) {
      setAdjError('Please enter a justification reason.');
      return;
    }

    setAdjSubmitting(true);
    setAdjError('');
    setAdjSuccess('');

    const res = await applyCompensationAdjustment(
      adjEmployeeId,
      adjType,
      amt,
      adjReason.trim(),
      user?.id || 'finance-manager'
    );

    setAdjSubmitting(false);
    if (res.success) {
      setAdjSuccess(`Successfully processed ${adjType.toUpperCase()} of ₦${amt.toLocaleString('en-NG')}!`);
      setAdjAmount('');
      setAdjReason('');
      setTimeout(() => {
        setShowAdjustmentModal(false);
        setAdjSuccess('');
      }, 1500);
    } else {
      setAdjError(res.error || 'Failed to apply adjustment.');
    }
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

    // Per-rep summary computed from real data
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
        return { id: rep.id, name: rep.full_name, stockValue, collected, outstanding };
      });

    // Clinic Branches summary
    const clinicBranches = locations
      .filter((l) => l.type === 'clinic')
      .map((clinic) => {
        const branchTreatments = treatments.filter((t) => t.location_id === clinic.id);
        const branchTreatmentRev = branchTreatments.reduce((sum, t) => sum + (t.total_cost || 0), 0);
        const branchInvoices = invoices.filter((inv) => inv.location_id === clinic.id && inv.status === 'paid');
        const branchInvoiceRev = branchInvoices.reduce((sum, inv) => sum + (inv.paid_amount || inv.total || 0), 0);
        const totalRev = branchTreatmentRev + branchInvoiceRev;
        const branchExpenses = expenses.filter((e) => e.location_id === clinic.id);
        const totalExp = branchExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netMargin = totalRev - totalExp;
        return {
          id: clinic.id,
          name: clinic.name,
          revenue: totalRev,
          expenses: totalExp,
          netMargin,
        };
      });

    return { receivables, approvedTotal, pendingCount, overdueAmount, pendingPayments, repSummary, clinicBranches };
  }, [invoices, payments, customers, users, inventory, products, locations, treatments, expenses]);

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

      {/* ── Financial Operations Tiles ── */}
      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Financial Operations & Controls</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(34, 197, 94, 0.12)', color: '#15803d' }}>
            Treasury & Ledger
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
          <button className={styles.actionBtn} onClick={() => router.push('/payments')}>
            <span className={styles.actionIcon}>💸</span>
            <span style={{ fontWeight: 600 }}>Payments Ledger</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Verify & approve collections</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/invoices')}>
            <span className={styles.actionIcon}>🧾</span>
            <span style={{ fontWeight: 600 }}>Invoices & Billing</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Due balances & aging</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/expenses')}>
            <span className={styles.actionIcon}>📊</span>
            <span style={{ fontWeight: 600 }}>Expenses & Receipts</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Operating overheads</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/payroll')}>
            <span className={styles.actionIcon}>💳</span>
            <span style={{ fontWeight: 600 }}>Payroll Center</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Staff salary payouts</span>
          </button>
          <button className={styles.actionBtn} onClick={() => { setShowAdjustmentModal(true); setAdjSuccess(''); setAdjError(''); }}>
            <span className={styles.actionIcon}>⚖️</span>
            <span style={{ fontWeight: 600 }}>Salary Adjustments</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Bonus, incentive & deductions</span>
          </button>
        </div>
      </div>

      {/* ── Content Cards: Payment Queue + Grouped Breakdown ── */}
      <div className={styles.contentGrid}>
        {/* Payment Verification Queue */}
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
                    <span className={styles.paymentAmount}>{p.amount}</span>
                    <span className={styles.paymentCustomer}>{p.customer}</span>
                    <span className={styles.paymentMeta}>
                      Rep: {p.rep} · {p.method} · {p.time}
                    </span>
                  </div>
                  <div className={styles.paymentActions}>
                    <button
                      className={`${styles.btnAction} ${styles.btnApprove}`}
                      onClick={() => handleApprove(p.id)}
                      disabled={actionState[p.id] === 'approving'}
                    >
                      {actionState[p.id] === 'approving' ? '…' : '✓'}
                    </button>
                    <button
                      className={`${styles.btnAction} ${styles.btnReject}`}
                      onClick={() => handleReject(p.id)}
                      disabled={actionState[p.id] === 'rejecting'}
                    >
                      {actionState[p.id] === 'rejecting' ? '…' : '✕'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Grouped Breakdown Tabs (Reps, Clinics, Staff) */}
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className={styles.cardTitle} style={{ margin: 0 }}>Financial Breakdown</h3>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
              <button
                onClick={() => setFinanceTab('reps')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: financeTab === 'reps' ? 'var(--color-navy)' : 'transparent',
                  color: financeTab === 'reps' ? '#fff' : 'var(--color-slate)',
                  cursor: 'pointer',
                }}
              >
                By Reps
              </button>
              <button
                onClick={() => setFinanceTab('clinics')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: financeTab === 'clinics' ? 'var(--color-navy)' : 'transparent',
                  color: financeTab === 'clinics' ? '#fff' : 'var(--color-slate)',
                  cursor: 'pointer',
                }}
              >
                By Clinics
              </button>
              <button
                onClick={() => setFinanceTab('staff')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: financeTab === 'staff' ? 'var(--color-navy)' : 'transparent',
                  color: financeTab === 'staff' ? '#fff' : 'var(--color-slate)',
                  cursor: 'pointer',
                }}
              >
                By Staff
              </button>
            </div>
          </div>

          {financeTab === 'reps' && (
            <div className={styles.repSummary}>
              {stats.repSummary.map((r) => (
                <div key={r.id} className={styles.repRow}>
                  <div>
                    <strong className={styles.repName}>{r.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Stock Held: {fmt(r.stockValue)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-success)' }}>
                      Collected: {fmt(r.collected)}
                    </div>
                    <div className={styles.repOutstanding}>Due: {fmt(r.outstanding)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {financeTab === 'clinics' && (
            <div className={styles.repSummary}>
              {stats.clinicBranches.map((c) => (
                <div key={c.id} className={styles.repRow}>
                  <div>
                    <strong className={styles.repName}>{c.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Overheads: {fmt(c.expenses)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                      Revenue: {fmt(c.revenue)}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: c.netMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                      Margin: {fmt(c.netMargin)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {financeTab === 'staff' && (
            <div className={styles.repSummary}>
              {users.slice(0, 8).map((u) => (
                <div key={u.id} className={styles.repRow} style={{ alignItems: 'center' }}>
                  <div>
                    <strong className={styles.repName}>{u.full_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {getRoleLabel(u.role)} · {u.location_id ? findLocationById(locations, u.location_id)?.name || 'HQ' : 'Headquarters'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAdjEmployeeId(u.id);
                      setShowAdjustmentModal(true);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: 'rgba(9, 57, 97, 0.08)',
                      border: '1px solid rgba(9, 57, 97, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: 'var(--color-navy)',
                    }}
                  >
                    Adjust Pay
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Salary & Compensation Adjustment Modal */}
      <Modal isOpen={showAdjustmentModal} onClose={() => setShowAdjustmentModal(false)} title="Staff Salary & Incentive Adjustment">
        <form onSubmit={handleAdjustmentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {adjError && (
            <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              {adjError}
            </div>
          )}
          {adjSuccess && (
            <div style={{ padding: '8px 12px', background: '#dcfce7', color: '#15803d', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              {adjSuccess}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
              Select Staff Employee *
            </label>
            <select
              required
              value={adjEmployeeId}
              onChange={(e) => setAdjEmployeeId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
            >
              <option value="">-- Choose Employee --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({getRoleLabel(u.role)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Adjustment Type
              </label>
              <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
              >
                <option value="bonus">Performance Bonus 🎁</option>
                <option value="incentive">Sales Incentive 🚀</option>
                <option value="increase">Base Salary Increase 📈</option>
                <option value="reduction">Base Salary Reduction 📉</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Amount (₦) *
              </label>
              <input
                type="number"
                min="1000"
                step="500"
                required
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="e.g. 50000"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
              Reason & Financial Justification *
            </label>
            <textarea
              required
              rows={3}
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="e.g. Exceeded Q2 territory collection target by 120% / Field hazard allowance"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setShowAdjustmentModal(false)}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjSubmitting}
              style={{
                padding: '8px 18px',
                background: 'var(--color-navy)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {adjSubmitting ? 'Applying...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
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
  const router = useRouter();
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

      {/* ── Warehouse & Supply Operations Tiles ── */}
      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Warehouse & Supply Operations</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7' }}>
            Inventory Management
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <button className={styles.actionBtn} onClick={() => router.push('/inventory')}>
            <span className={styles.actionIcon}>📦</span>
            <span style={{ fontWeight: 600 }}>Stock Allocations</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Allocate to reps & clinics</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/products')}>
            <span className={styles.actionIcon}>💊</span>
            <span style={{ fontWeight: 600 }}>Product Catalog</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>SKUs, pricing & formulations</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/suppliers')}>
            <span className={styles.actionIcon}>🏭</span>
            <span style={{ fontWeight: 600 }}>Suppliers & Intake</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Purchase receipts & orders</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/chat')}>
            <span className={styles.actionIcon}>💬</span>
            <span style={{ fontWeight: 600 }}>Team Dispatch</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Coordinate field reps</span>
          </button>
        </div>
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
// ── Clinical & Enterprise Division Sections ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dashboard section for `clinic_admin`.
 */
function ClinicAdminSection() {
  const router = useRouter();
  const { patients } = useClinicPatients();
  const { appointments } = useClinicAppointments();
  const { treatments } = useClinicTreatments();

  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const todayAppointments = appointments.length;
    const inCare = treatments.filter((t) => t.status === 'ongoing').length;
    const completedTreatments = treatments.length;
    return { totalPatients, todayAppointments, inCare, completedTreatments };
  }, [patients, appointments, treatments]);

  return (
    <>
      <div className={styles.statsGrid}>
        <StatCard label="Registered Patients" value={String(stats.totalPatients)} icon="🐾" color="var(--color-info-light)" />
        <StatCard label="Today's Appointments" value={String(stats.todayAppointments)} icon="📅" color="var(--color-gold-tint)" />
        <StatCard label="In-Care Treatments" value={String(stats.inCare)} icon="🩺" color="var(--color-warning-light)" />
        <StatCard label="Completed Treatments" value={String(stats.completedTreatments)} icon="✅" color="var(--color-success-light)" />
      </div>

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Clinical Operations & Scheduling</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(13, 148, 136, 0.12)', color: '#0f766e' }}>
            Clinic Administration
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <Link href="/clinic/appointments" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>📅</span>
            <span style={{ fontWeight: 600 }}>Appointments</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Schedule consultations</span>
          </Link>
          <Link href="/clinic/treatments" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🩺</span>
            <span style={{ fontWeight: 600 }}>Treatments & EHR</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Medical records & SOAP notes</span>
          </Link>
          <Link href="/clinic/patients" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🐾</span>
            <span style={{ fontWeight: 600 }}>Patient Directory</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Medical records & owners</span>
          </Link>
          <Link href="/staff" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>👥</span>
            <span style={{ fontWeight: 600 }}>Clinic Staff</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Vets, techs & rosters</span>
          </Link>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Clinical Treatments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {treatments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No treatments recorded</p>
            ) : (
              treatments.slice(0, 5).map((t) => (
                <div key={t.id} className={styles.invoiceItem}>
                  <div>
                    <span className={styles.invoiceId}>{t.patient?.name || 'Patient'} · {t.diagnosis || 'Clinical Assessment'}</span>
                    <span className={styles.invoiceCustomer}>Vet: {t.vet?.full_name || 'Dr. On Duty'} · {t.date}</span>
                  </div>
                  <div className={styles.invoiceRight}>
                    <span className={`${styles.badgePill} ${styles.statusPaid}`}>
                      {t.status?.toUpperCase() || 'COMPLETED'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Upcoming Appointments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {appointments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No upcoming appointments scheduled</p>
            ) : (
              appointments.slice(0, 5).map((a) => (
                <div key={a.id} className={styles.invoiceItem}>
                  <div>
                    <span className={styles.invoiceId}>{a.patient?.name || 'Patient'} ({a.patient?.species})</span>
                    <span className={styles.invoiceCustomer}>{a.service_type || 'Consultation'} · {a.date} {a.start_time}</span>
                  </div>
                  <div className={styles.invoiceRight}>
                    <span className={`${styles.badgePill} ${a.status === 'confirmed' ? styles.statusPaid : a.status === 'cancelled' ? styles.statusOverdue : styles.statusPending}`}>
                      {a.status?.toUpperCase()}
                    </span>
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

/**
 * Dashboard section for `vet` (Veterinarian Surgeon).
 */
function VeterinarianSection() {
  const router = useRouter();
  const { appointments } = useClinicAppointments();
  const { treatments } = useClinicTreatments();
  const { patients } = useClinicPatients();

  const stats = useMemo(() => {
    const scheduledAppts = appointments.filter((a) => a.status === 'confirmed' || a.status === 'scheduled').length;
    const inCare = treatments.filter((t) => t.status === 'ongoing').length;
    const totalTreatments = treatments.length;
    const totalPatients = patients.length;
    return { scheduledAppts, inCare, totalTreatments, totalPatients };
  }, [appointments, treatments, patients]);

  return (
    <>
      <div className={styles.statsGrid}>
        <StatCard label="Booked Consultations" value={String(stats.scheduledAppts)} icon="📅" color="var(--color-info-light)" />
        <StatCard label="In-Progress Treatments" value={String(stats.inCare)} icon="🩺" color="var(--color-warning-light)" />
        <StatCard label="Completed Cases" value={String(stats.totalTreatments)} icon="📋" color="var(--color-gold-tint)" />
        <StatCard label="Patient Records" value={String(stats.totalPatients)} icon="🐾" color="var(--color-success-light)" />
      </div>

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Clinical Diagnosis & Veterinary Care</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}>
            Veterinary Surgeon
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <Link href="/clinic/appointments" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>📅</span>
            <span style={{ fontWeight: 600 }}>Consultation Schedule</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>View booked patients</span>
          </Link>
          <Link href="/clinic/treatments" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>📝</span>
            <span style={{ fontWeight: 600 }}>SOAP Clinical Notes</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>EHR records & diagnosis</span>
          </Link>
          <Link href="/clinic/patients" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🐾</span>
            <span style={{ fontWeight: 600 }}>Patient Medical History</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Vaccinations & surgeries</span>
          </Link>
          <Link href="/inventory" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>💊</span>
            <span style={{ fontWeight: 600 }}>Pharmacy & Rx Formulations</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Drug stock & dosages</span>
          </Link>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Today&apos;s Consultations & Bookings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {appointments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No consultations booked for today ✅</p>
            ) : (
              appointments.slice(0, 5).map((a) => (
                <div key={a.id} className={styles.invoiceItem}>
                  <div>
                    <span className={styles.invoiceId}>{a.patient?.name || 'Pet'} ({a.patient?.species || 'Animal'})</span>
                    <span className={styles.invoiceCustomer}>Service: {a.service_type} · Time: {a.date} {a.start_time}</span>
                  </div>
                  <div className={styles.invoiceRight}>
                    <span className={`${styles.badgePill} ${a.status === 'confirmed' ? styles.statusPaid : styles.statusPending}`}>
                      {a.status?.toUpperCase() || 'BOOKED'}
                    </span>
                    <Link
                      href="/clinic/treatments"
                      prefetch={true}
                      style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ocean)', textDecoration: 'none', padding: '2px 0' }}
                    >
                      Examine →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Clinical Cases & Diagnoses</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {treatments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No recent consultation records</p>
            ) : (
              treatments.slice(0, 5).map((t) => (
                <div key={t.id} className={styles.invoiceItem}>
                  <div>
                    <span className={styles.invoiceId}>{t.patient?.name || 'Patient'} · {t.diagnosis || 'Clinical Assessment'}</span>
                    <span className={styles.invoiceCustomer}>Vet: {t.vet?.full_name || 'Dr. On Duty'} · {t.date}</span>
                  </div>
                  <div className={styles.invoiceRight}>
                    <span className={`${styles.badgePill} ${styles.statusPaid}`}>
                      {t.status?.toUpperCase() || 'COMPLETED'}
                    </span>
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

/**
 * Dashboard section for `vet_tech` and `vet_assistant`.
 */
function VetTechSection() {
  const { appointments } = useClinicAppointments();
  const { treatments } = useClinicTreatments();
  const { inventory } = useInventory();

  const stats = useMemo(() => {
    const scheduledVisits = appointments.filter((a) => a.status === 'confirmed' || a.status === 'scheduled').length;
    const inCare = treatments.filter((t) => t.status === 'ongoing').length;
    const stockItems = inventory.length;
    const totalTreatments = treatments.length;
    return { scheduledVisits, inCare, stockItems, totalTreatments };
  }, [appointments, inventory, treatments]);

  return (
    <>
      <div className={styles.statsGrid}>
        <StatCard label="Scheduled Visits" value={String(stats.scheduledVisits)} icon="📅" color="var(--color-warning-light)" />
        <StatCard label="In-Care Patients" value={String(stats.inCare)} icon="💉" color="var(--color-info-light)" />
        <StatCard label="Medication SKUs" value={String(stats.stockItems)} icon="💊" color="var(--color-gold-tint)" />
        <StatCard label="Cases Handled" value={String(stats.totalTreatments)} icon="📋" color="var(--color-success-light)" />
      </div>

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Nursing & Clinical Support</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce' }}>
            Veterinary Nursing & Prep
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <Link href="/clinic/appointments" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>📅</span>
            <span style={{ fontWeight: 600 }}>Clinical Schedule</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Appointments & vital checks</span>
          </Link>
          <Link href="/inventory" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>💉</span>
            <span style={{ fontWeight: 600 }}>Medication Stock</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Vaccines, antibiotics & drips</span>
          </Link>
          <Link href="/clinic/patients" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🐾</span>
            <span style={{ fontWeight: 600 }}>Patient Directory</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Microchips & patient profiles</span>
          </Link>
          <Link href="/chat" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>💬</span>
            <span style={{ fontWeight: 600 }}>Clinical Chat</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Alert veterinarians</span>
          </Link>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Scheduled Clinical Appointments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {appointments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No upcoming appointments</p>
            ) : (
              appointments.slice(0, 5).map((a) => {
                const petName = a.patient?.name || 'Pet Patient';
                const species = a.patient?.species || 'Canine';
                return (
                  <div key={a.id} className={styles.invoiceItem}>
                    <div>
                      <span className={styles.invoiceId}>{petName} {species ? `(${species})` : ''}</span>
                      <span className={styles.invoiceCustomer}>Service: {a.service_type || 'Consultation'} · {a.date}</span>
                    </div>
                    <div className={styles.invoiceRight}>
                      <span className={`${styles.badgePill} ${a.status === 'confirmed' ? styles.statusPaid : a.status === 'completed' ? styles.statusDraft : styles.statusPending}`}>
                        {a.status?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{a.start_time || 'Pending'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Clinical Treatments Log</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {treatments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No treatments recorded</p>
            ) : (
              treatments.slice(0, 5).map((t) => (
                <div key={t.id} className={styles.invoiceItem}>
                  <div>
                    <span className={styles.invoiceId}>{t.patient?.name || 'Patient'}</span>
                    <span className={styles.invoiceCustomer}>Dx: {t.diagnosis || 'Observation'} · {t.date}</span>
                  </div>
                  <div className={styles.invoiceRight}>
                    <span className={`${styles.badgePill} ${styles.statusPaid}`}>{t.status || 'Done'}</span>
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

/**
 * Dashboard section for `receptionist` (Front Desk Receptionist).
 */
function ReceptionistSection() {
  const { appointments } = useClinicAppointments();
  const { patients } = useClinicPatients();
  const { invoices } = useInvoices();
  const { customers } = useCustomers();

  const stats = useMemo(() => {
    const scheduledAppointments = appointments.filter((a) => a.status === 'confirmed' || a.status === 'scheduled').length;
    const todayAppointments = appointments.length;
    const registeredPets = patients.length;
    const totalInvoices = invoices.length;
    return { scheduledAppointments, todayAppointments, registeredPets, totalInvoices };
  }, [appointments, patients, invoices]);

  return (
    <>
      <div className={styles.statsGrid}>
        <StatCard label="Active Appointments" value={String(stats.scheduledAppointments)} icon="📅" color="var(--color-warning-light)" />
        <StatCard label="Total Booked" value={String(stats.todayAppointments)} icon="🗓️" color="var(--color-info-light)" />
        <StatCard label="Registered Patients" value={String(stats.registeredPets)} icon="🐾" color="var(--color-gold-tint)" />
        <StatCard label="Invoices & Billing" value={String(stats.totalInvoices)} icon="🧾" color="var(--color-success-light)" />
      </div>

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Front Desk & Patient Services</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(249, 115, 22, 0.12)', color: '#ea580c' }}>
            Front Desk Reception
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <Link href="/clinic/appointments" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>📅</span>
            <span style={{ fontWeight: 600 }}>Book Appointment</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Schedule clinic visits</span>
          </Link>
          <Link href="/clinic/patients" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🐾</span>
            <span style={{ fontWeight: 600 }}>Register Pet & Owner</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Create patient file</span>
          </Link>
          <Link href="/invoices" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🧾</span>
            <span style={{ fontWeight: 600 }}>Point of Sale / Billing</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Issue receipt & invoice</span>
          </Link>
          <Link href="/chat" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>💬</span>
            <span style={{ fontWeight: 600 }}>Internal Chat</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Coordinate with clinic staff</span>
          </Link>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Appointments Schedule</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {appointments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No appointments booked</p>
            ) : (
              appointments.slice(0, 5).map((a) => {
                const foundPatient = patients.find((p) => p.id === a.patient_id);
                const petName = a.patient?.name || foundPatient?.name || 'Pet Patient';
                const species = a.patient?.species || foundPatient?.species || '';
                return (
                  <div key={a.id} className={styles.invoiceItem}>
                    <div>
                      <span className={styles.invoiceId}>{petName} {species ? `(${species})` : ''}</span>
                      <span className={styles.invoiceCustomer}>{a.service_type || 'General Checkup'} · {a.date} {a.start_time}</span>
                    </div>
                    <div className={styles.invoiceRight}>
                      <span className={`${styles.badgePill} ${a.status === 'confirmed' ? styles.statusPaid : a.status === 'cancelled' ? styles.statusOverdue : styles.statusPending}`}>
                        {a.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Invoices</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {invoices.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No invoices recorded</p>
            ) : (
              invoices.slice(0, 5).map((inv) => {
                const customer = findCustomerById(customers, inv.customer_id);
                return (
                  <div key={inv.id} className={styles.invoiceItem}>
                    <div>
                      <span className={styles.invoiceId}>{inv.invoice_number}</span>
                      <span className={styles.invoiceCustomer}>
                        {customer?.name || 'Customer'} · {inv.due_date}
                      </span>
                    </div>
                    <div className={styles.invoiceRight}>
                      <span className={styles.invoiceAmount}>{fmt(inv.total)}</span>
                      <span className={`${styles.badgePill} ${inv.status === 'paid' ? styles.statusPaid : styles.statusPending}`}>
                        {inv.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Dashboard section for `lab_scientist`.
 */
function LabScientistSection() {
  const { patients } = useClinicPatients();
  const { treatments } = useClinicTreatments();
  const { inventory } = useInventory();

  return (
    <>
      <div className={styles.statsGrid}>
        <StatCard label="Patient Records" value={String(patients.length)} icon="🐾" color="var(--color-info-light)" />
        <StatCard label="Clinical Diagnostic Cases" value={String(treatments.length)} icon="🔬" color="rgba(168, 85, 247, 0.15)" />
        <StatCard label="Laboratory Reagents & SKUs" value={String(inventory.length)} icon="🧪" color="var(--color-gold-tint)" />
        <StatCard label="Completed Analyses" value={String(treatments.filter((t) => t.status === 'completed').length)} icon="🏥" color="var(--color-success-light)" />
      </div>

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Diagnostic Laboratory & Pathology</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(217, 70, 239, 0.12)', color: '#a21caf' }}>
            Laboratory Scientist
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <Link href="/clinic/patients" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🐾</span>
            <span style={{ fontWeight: 600 }}>Patient Health Records</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Look up histories & species</span>
          </Link>
          <Link href="/clinic/treatments" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🔬</span>
            <span style={{ fontWeight: 600 }}>Diagnostic Treatments</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Review clinical notes & tests</span>
          </Link>
          <Link href="/inventory" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>🧪</span>
            <span style={{ fontWeight: 600 }}>Reagents & Lab Supplies</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Test kits, slides & reagents</span>
          </Link>
          <Link href="/chat" prefetch={true} className={styles.actionBtn}>
            <span className={styles.actionIcon}>💬</span>
            <span style={{ fontWeight: 600 }}>Clinical Chat</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Report results to veterinarians</span>
          </Link>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Clinical Diagnoses & Lab Cases</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {treatments.length === 0 ? (
              <p style={{ color: 'var(--color-gray)', textAlign: 'center', padding: '16px' }}>No diagnostic cases logged</p>
            ) : (
              treatments.slice(0, 5).map((t) => (
                <div key={t.id} className={styles.invoiceItem}>
                  <div>
                    <span className={styles.invoiceId}>{t.patient?.name || 'Patient'} · {t.diagnosis || 'Lab Investigation'}</span>
                    <span className={styles.invoiceCustomer}>Vet: {t.vet?.full_name || 'Veterinarian'} · {t.date}</span>
                  </div>
                  <div className={styles.invoiceRight}>
                    <span className={`${styles.badgePill} ${styles.statusPaid}`}>{t.status || 'Active'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Diagnostic Reagents & Stock</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {inventory.slice(0, 5).map((item) => (
              <div key={item.id} className={styles.invoiceItem}>
                <div>
                  <span className={styles.invoiceId}>Batch: {item.batch_number}</span>
                  <span className={styles.invoiceCustomer}>Expires: {item.expiry_date}</span>
                </div>
                <div className={styles.invoiceRight}>
                  <span className={styles.invoiceAmount}>{item.quantity} units</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Dashboard section for `support_staff`.
 */
function SupportStaffSection() {
  const router = useRouter();
  const { locations } = useLocations();
  const { inventory } = useInventory();
  const { users } = useUsers();

  return (
    <>
      <div className={styles.statsGrid}>
        <StatCard label="Active Clinic Facilities" value={String(locations.filter(l => l.type === 'clinic').length || 1)} icon="🏥" color="var(--color-info-light)" />
        <StatCard label="Total Locations" value={String(locations.length)} icon="📍" color="var(--color-gold-tint)" />
        <StatCard label="Facility Supplies" value={String(inventory.length)} icon="📦" color="var(--color-warning-light)" />
        <StatCard label="On-Duty Personnel" value={String(users.length)} icon="👥" color="var(--color-success-light)" />
      </div>

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Support, Facilities & Operational Supplies</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(100, 116, 139, 0.12)', color: '#475569' }}>
            Support Staff
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <button className={styles.actionBtn} onClick={() => router.push('/clinic')}>
            <span className={styles.actionIcon}>🏥</span>
            <span style={{ fontWeight: 600 }}>Clinic Facilities</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Hospital branches & rooms</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/inventory')}>
            <span className={styles.actionIcon}>📦</span>
            <span style={{ fontWeight: 600 }}>Supplies & Logistics</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Warehouse & clinic stock</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/chat')}>
            <span className={styles.actionIcon}>💬</span>
            <span style={{ fontWeight: 600 }}>Team Dispatch</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Coordinate maintenance & tasks</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/reports')}>
            <span className={styles.actionIcon}>📈</span>
            <span style={{ fontWeight: 600 }}>Reports</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Operational summaries</span>
          </button>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Hospital Facilities & Locations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {locations.map((loc) => (
              <div key={loc.id} className={styles.invoiceItem}>
                <div>
                  <span className={styles.invoiceId}>{loc.name}</span>
                  <span className={styles.invoiceCustomer}>{loc.address || 'Enterprise Facility'}</span>
                </div>
                <div className={styles.invoiceRight}>
                  <span className={`${styles.badgePill} ${styles.statusPaid}`}>{loc.type.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Operational Supplies Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {inventory.slice(0, 5).map((item) => (
              <div key={item.id} className={styles.invoiceItem}>
                <div>
                  <span className={styles.invoiceId}>Batch {item.batch_number}</span>
                  <span className={styles.invoiceCustomer}>Location SKU</span>
                </div>
                <div className={styles.invoiceRight}>
                  <span className={styles.invoiceAmount}>{item.quantity} units</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── DashboardPage — Exported page component (role & multi-role router) ────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main dashboard page component — the default route after login.
 *
 * **Role-based & Multi-role rendering:**
 * - Single application architecture for all users.
 * - If user has super_admin or ceo role: renders the unified Bento-Tile Command Center.
 * - If user has multiple roles (e.g. Clinic Admin + Vet): stacks all role dashboards
 *   simultaneously without requiring the user to manually switch views.
 * - If user has a single role: renders their dedicated division dashboard.
 */
export default function DashboardPage() {
  const { user } = useAuth();

  // Guard: render nothing until the auth context has resolved the user
  if (!user) return null;

  // Multi-role resolution: check user.roles array first, fallback to user.role
  const userRoles = (user.roles && user.roles.length > 0 ? user.roles : [user.role]) as UserRole[];
  const isSuperAdmin = userRoles.includes('super_admin') || userRoles.includes('ceo');
  const isMultiRole = !isSuperAdmin && userRoles.length > 1;

  /**
   * Generates a context-aware Topbar title.
   */
  const title = isSuperAdmin
    ? 'Executive Dashboard'
    : isMultiRole
    ? `Unified Workspace (${userRoles.map((r) => getRoleLabel(r)).join(' + ')})`
    : `${getRoleLabel(user.role)} Dashboard`;

  // Helper to render section for a specific role
  const renderRoleDashboard = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
      case 'ceo':
        return <UnifiedSuperAdminDashboard />;
      case 'sales_rep':
        return <SalesRepDashboard />;
      case 'finance_manager':
        return <FinanceDashboard />;
      case 'inventory_manager':
      case 'pharmacist':
        return <InventoryDashboard />;
      case 'clinic_admin':
        return <ClinicAdminSection />;
      case 'vet':
        return <VeterinarianSection />;
      case 'vet_tech':
      case 'vet_assistant':
        return <VetTechSection />;
      case 'receptionist':
        return <ReceptionistSection />;
      case 'lab_scientist':
        return <LabScientistSection />;
      case 'support_staff':
        return <SupportStaffSection />;
      default:
        return <SalesRepDashboard />;
    }
  };

  return (
    <>
      <Topbar title={title} />
      <div className={styles.page}>
        <AnnouncementBanner />
        {/* ── Personalised greeting ── */}
        <div className={styles.greeting}>
          <h2 className={styles.greetingText}>
            Welcome back, {user.full_name.split(' ')[0]} 👋
          </h2>
          <p className={styles.greetingSub}>
            {isSuperAdmin
              ? 'Executive overview of commercial distribution, veterinary clinic network, and group financials.'
              : isMultiRole
              ? `You are signed in with multiple roles: ${userRoles.map((r) => getRoleLabel(r)).join(', ')}. All capabilities are unified below without switching.`
              : "Here's what's happening at Albion today."}
          </p>
        </div>

        {/* ── Super Admin / CEO Dashboard (Bento Grid) ── */}
        {isSuperAdmin && <UnifiedSuperAdminDashboard />}

        {/* ── Multi-Role Simultaneous View ── */}
        {isMultiRole && (
          <>
            <div className={styles.bentoHero} style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4) var(--space-6)' }}>
              <div className={styles.bentoHeroHeader}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.75px', color: '#093961' }}>
                    MULTI-ROLE ACTIVE WORKSPACE
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', color: 'var(--color-navy)', fontWeight: 700 }}>
                    Unified Operations for {userRoles.map((r) => getRoleLabel(r)).join(' & ')}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    All features, metrics, and workflows from your assigned roles are stacked concurrently. No manual view toggling required.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {userRoles.map((r) => (
                    <span key={r} className={styles.bentoPill} style={{ background: 'rgba(9, 57, 97, 0.08)', color: '#093961' }}>
                      👤 {getRoleLabel(r)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {userRoles.map((role) => (
              <div key={role} style={{ marginBottom: 'var(--space-8)' }}>
                <div className={styles.multiRoleHeader}>
                  <h3 className={styles.multiRoleTitle}>
                    {role === 'clinic_admin' && '🏥 Clinic Administration & Fleet Operations'}
                    {role === 'vet' && '🩺 Clinical Consultations & Veterinary Surgery'}
                    {(role === 'vet_tech' || role === 'vet_assistant') && '🐾 Veterinary Nursing & Triage Support'}
                    {role === 'receptionist' && '📋 Front Desk, Check-In & Patient Reception'}
                    {role === 'lab_scientist' && '🔬 Laboratory Diagnostics & Pathology'}
                    {role === 'sales_rep' && '💼 Field Sales & Territory Portfolio'}
                    {role === 'finance_manager' && '💳 Treasury, Payments & Financial Ledger'}
                    {role === 'inventory_manager' && '📦 Central Warehouse & Supply Logistics'}
                    {role === 'pharmacist' && '💊 Clinical Pharmacy & Formulations'}
                    {role === 'support_staff' && '🧹 Support, Facilities & Operations'}
                  </h3>
                  <span className={styles.badgePill} style={{ background: 'rgba(9, 57, 97, 0.1)', color: '#093961' }}>
                    {getRoleLabel(role)}
                  </span>
                </div>
                {renderRoleDashboard(role)}
              </div>
            ))}
          </>
        )}

        {/* ── Single Role View ── */}
        {!isSuperAdmin && !isMultiRole && renderRoleDashboard(user.role)}
      </div>
    </>
  );
}

