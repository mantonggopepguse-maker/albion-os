'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import {
  useLocations,
  useClinicPatients,
  useClinicTreatments,
  useInventory,
  useProducts,
  useCashReconciliations,
  useExpenses,
} from '@/hooks/use-supabase-data';
import type { Location } from '@/lib/types';
import styles from './clinic.module.css';

function fmtNgn(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className={styles.statCard}>
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
    </div>
  );
}

function BranchCard({
  clinic,
  patients,
  treatments,
  stockUnits,
  stockValue,
  revenue,
  expenses,
  netMargin,
}: {
  clinic: Location;
  patients: number;
  treatments: number;
  stockUnits: number;
  stockValue: string;
  revenue: number;
  expenses: number;
  netMargin: number;
}) {
  return (
    <Link href={`/clinic/${clinic.id}`} prefetch={true} className={styles.branchCard}>
      <div className={styles.branchHeader}>
        <span className={styles.branchIcon}>🏥</span>
        <div className={styles.branchHeadInfo}>
          <span className={styles.branchName}>{clinic.name}</span>
          <span className={styles.branchMeta}>
            {clinic.state || clinic.region || '—'} &middot; Clinic Branch
          </span>
        </div>
      </div>
      <div className={styles.branchStats}>
        <div className={styles.branchStat}>
          <span className={styles.branchStatValue}>{fmtNgn(revenue)}</span>
          <span className={styles.branchStatLabel}>Revenue</span>
        </div>
        <div className={styles.branchStat}>
          <span className={styles.branchStatValue}>{fmtNgn(expenses)}</span>
          <span className={styles.branchStatLabel}>Overheads</span>
        </div>
        <div className={styles.branchStat}>
          <span className={styles.branchStatValue} style={{ color: netMargin >= 0 ? '#15803d' : '#b91c1c' }}>
            {fmtNgn(netMargin)}
          </span>
          <span className={styles.branchStatLabel}>Net Margin</span>
        </div>
      </div>
      <div className={styles.branchFoot}>
        <span>{patients} patients · {treatments} treatments</span>
        <span className={styles.branchValue}>{stockValue}</span>
      </div>
    </Link>
  );
}

export default function ClinicPage() {
  const { locations } = useLocations();
  const { patients } = useClinicPatients();
  const { treatments } = useClinicTreatments();
  const { inventory } = useInventory();
  const { products } = useProducts();
  const { reconciliations } = useCashReconciliations();
  const { expenses } = useExpenses();

  const productPrice = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.id, p.unit_price || 0);
    return map;
  }, [products]);

  const clinics = useMemo(() => locations.filter((l) => l.type === 'clinic'), [locations]);

  const branchStats = useMemo(() => {
    return clinics.map((clinic) => {
      const clinicPatients = patients.filter((p) => p.location_id === clinic.id).length;
      const clinicTx = treatments.filter((t) => t.location_id === clinic.id);
      const branchReconciliations = reconciliations.filter((r) => r.location_id === clinic.id);

      const revenue =
        branchReconciliations.reduce((sum, r) => sum + (r.total_actual || 0), 0) +
        clinicTx.reduce((sum, t) => sum + (t.total_cost || 0), 0);

      const branchExpenses = expenses.filter((e) => e.location_id === clinic.id);
      const totalExpenses = branchExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netMargin = revenue - totalExpenses;

      const stock = inventory.filter((i) => i.location_id === clinic.id);
      const stockUnits = stock.reduce((sum, i) => sum + (i.quantity || 0), 0);
      const stockValue = stock.reduce((sum, i) => sum + (i.quantity || 0) * (productPrice.get(i.product_id) || 0), 0);

      return {
        clinic,
        clinicPatients,
        clinicTxCount: clinicTx.length,
        stockUnits,
        stockValue,
        revenue,
        expenses: totalExpenses,
        netMargin,
      };
    });
  }, [clinics, patients, treatments, inventory, productPrice, reconciliations, expenses]);

  const totalClinicRevenue = useMemo(() => branchStats.reduce((sum, b) => sum + b.revenue, 0), [branchStats]);
  const totalClinicExpenses = useMemo(() => branchStats.reduce((sum, b) => sum + b.expenses, 0), [branchStats]);
  const totalClinicNetMargin = totalClinicRevenue - totalClinicExpenses;

  return (
    <>
      <Topbar title="Clinic Branches" />
      <div className={styles.page}>
        <div className={styles.greeting}>
          <h2 className={styles.greetingText}>
            Clinic Practice Performance
          </h2>
          <p className={styles.greetingSub}>
            Financial oversight, cash reconciliations, treatments, and inventory valuation across your veterinary clinics.
          </p>
        </div>

        <div className={styles.statsGrid}>
          <StatCard label="Operating Clinics" value={String(clinics.length)} icon="🏥" color="var(--color-ocean)" />
          <StatCard label="Practice Revenue" value={fmtNgn(totalClinicRevenue)} icon="💰" color="rgba(168, 85, 247, 0.15)" />
          <StatCard label="Operating Overheads" value={fmtNgn(totalClinicExpenses)} icon="📊" color="var(--color-warning-light)" />
          <StatCard label="Net Operating Margin" value={fmtNgn(totalClinicNetMargin)} icon="📈" color="var(--color-success-light)" />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Branch Financial & Operational Overview</h3>
          {branchStats.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No clinic branches found. Add a location with type &ldquo;Clinic&rdquo; to get started.</p>
            </div>
          ) : (
            <div className={styles.branchGrid}>
              {branchStats.map((b) => (
                <BranchCard
                  key={b.clinic.id}
                  clinic={b.clinic}
                  patients={b.clinicPatients}
                  treatments={b.clinicTxCount}
                  stockUnits={b.stockUnits}
                  stockValue={fmtNgn(b.stockValue)}
                  revenue={b.revenue}
                  expenses={b.expenses}
                  netMargin={b.netMargin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}