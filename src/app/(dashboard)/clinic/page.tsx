'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import {
  useLocations,
  useClinicPatients,
  useClinicAppointments,
  useClinicTreatments,
  useInventory,
  useProducts,
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

function BranchCard({ clinic, patients, appointments, treatments, stockUnits, stockValue }: {
  clinic: Location;
  patients: number;
  appointments: number;
  treatments: number;
  stockUnits: number;
  stockValue: string;
}) {
  return (
    <Link href={`/clinic/${clinic.id}`} className={styles.branchCard}>
      <div className={styles.branchHeader}>
        <span className={styles.branchIcon}>🏥</span>
        <div className={styles.branchHeadInfo}>
          <span className={styles.branchName}>{clinic.name}</span>
          <span className={styles.branchMeta}>
            {clinic.state || clinic.region || '—'} &middot; Clinic
          </span>
        </div>
      </div>
      <div className={styles.branchStats}>
        <div className={styles.branchStat}>
          <span className={styles.branchStatValue}>{patients}</span>
          <span className={styles.branchStatLabel}>Patients</span>
        </div>
        <div className={styles.branchStat}>
          <span className={styles.branchStatValue}>{appointments}</span>
          <span className={styles.branchStatLabel}>Appointments</span>
        </div>
        <div className={styles.branchStat}>
          <span className={styles.branchStatValue}>{treatments}</span>
          <span className={styles.branchStatLabel}>Treatments</span>
        </div>
      </div>
      <div className={styles.branchFoot}>
        <span>{stockUnits.toLocaleString('en-NG')} units in stock</span>
        <span className={styles.branchValue}>{stockValue}</span>
      </div>
    </Link>
  );
}

export default function ClinicPage() {
  const { locations } = useLocations();
  const { patients } = useClinicPatients();
  const { appointments } = useClinicAppointments();
  const { treatments } = useClinicTreatments();
  const { inventory } = useInventory();
  const { products } = useProducts();

  const productPrice = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.id, p.unit_price || 0);
    return map;
  }, [products]);

  const clinics = useMemo(() => locations.filter((l) => l.type === 'clinic'), [locations]);

  const branchStats = useMemo(() => {
    return clinics.map((clinic) => {
      const clinicPatients = patients.filter((p) => p.location_id === clinic.id).length;
      const clinicAppts = appointments.filter((a) => a.location_id === clinic.id).length;
      const clinicTx = treatments.filter((t) => t.location_id === clinic.id).length;
      const stock = inventory.filter((i) => i.location_id === clinic.id);
      const stockUnits = stock.reduce((sum, i) => sum + (i.quantity || 0), 0);
      const stockValue = stock.reduce((sum, i) => sum + (i.quantity || 0) * (productPrice.get(i.product_id) || 0), 0);
      return { clinic, clinicPatients, clinicAppts, clinicTx, stockUnits, stockValue };
    });
  }, [clinics, patients, appointments, treatments, inventory, productPrice]);

  const totalPatients = patients.length;
  const totalAppts = appointments.length;
  const totalStockValue = branchStats.reduce((sum, b) => sum + b.stockValue, 0);

  return (
    <>
      <Topbar title="Clinic Branches" />
      <div className={styles.page}>
        <div className={styles.greeting}>
          <h2 className={styles.greetingText}>
            Clinic Branch Performance
          </h2>
          <p className={styles.greetingSub}>
            Track progress, inventory, and performance across your clinic branches.
          </p>
        </div>

        <div className={styles.statsGrid}>
          <StatCard label="Clinics" value={String(clinics.length)} icon="🏥" color="var(--color-ocean)" />
          <StatCard label="Total Patients" value={totalPatients.toLocaleString('en-NG')} icon="🐾" color="var(--color-info-light)" />
          <StatCard label="Appointments" value={totalAppts.toLocaleString('en-NG')} icon="📅" color="var(--color-gold-tint)" />
          <StatCard label="Inventory Value" value={fmtNgn(totalStockValue)} icon="💊" color="var(--color-success-light)" />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Branch Overview</h3>
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
                  appointments={b.clinicAppts}
                  treatments={b.clinicTx}
                  stockUnits={b.stockUnits}
                  stockValue={fmtNgn(b.stockValue)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}