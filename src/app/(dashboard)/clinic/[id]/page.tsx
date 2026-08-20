'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import {
  useLocations,
  useClinicPatients,
  useClinicAppointments,
  useClinicTreatments,
  useInventory,
  useProducts,
} from '@/hooks/use-supabase-data';
import styles from './clinic-branch.module.css';

export default function ClinicBranchPage() {
  const params = useParams();
  const clinicId = params.id as string;

  const { locations } = useLocations();
  const { patients } = useClinicPatients();
  const { appointments } = useClinicAppointments();
  const { treatments } = useClinicTreatments();
  const { inventory } = useInventory();
  const { products } = useProducts();

  const clinic = useMemo(() => locations.find((l) => l.id === clinicId), [locations, clinicId]);

  const productPrice = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.id, p.unit_price || 0);
    return map;
  }, [products]);

  const branchPatients = useMemo(() => patients.filter((p) => p.location_id === clinicId), [patients, clinicId]);
  const branchAppts = useMemo(() => appointments.filter((a) => a.location_id === clinicId), [appointments, clinicId]);
  const branchTx = useMemo(() => treatments.filter((t) => t.location_id === clinicId), [treatments, clinicId]);
  const branchStock = useMemo(() => inventory.filter((i) => i.location_id === clinicId), [inventory, clinicId]);

  const stockValue = branchStock.reduce((sum, i) => sum + (i.quantity || 0) * (productPrice.get(i.product_id) || 0), 0);

  if (!clinic) {
    return (
      <>
        <Topbar title="Clinic Branch" />
        <div className={styles.page} style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Branch not found.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={clinic.name} />
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{clinic.name}</h1>
            <p className={styles.sub}>
              {clinic.address || clinic.state || '—'} &middot; Clinic Branch
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Patients</span>
            <span className={styles.statValue}>{branchPatients.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Appointments</span>
            <span className={styles.statValue}>{branchAppts.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Treatments</span>
            <span className={styles.statValue}>{branchTx.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Stock Value</span>
            <span className={styles.statValue}>₦{stockValue.toLocaleString('en-NG')}</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Patients</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Species</th>
                  <th>Owner</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {branchPatients.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No patients at this branch</td></tr>
                ) : branchPatients.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.species}</td>
                    <td>{p.owner?.full_name || '—'}</td>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('en-NG') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Inventory (Units)</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {branchStock.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No stock at this branch</td></tr>
                ) : branchStock.slice(0, 8).map((i) => (
                  <tr key={i.id}>
                    <td>{products.find((p) => p.id === i.product_id)?.name || i.product_id}</td>
                    <td>{i.batch_number || '—'}</td>
                    <td>{i.quantity}</td>
                    <td>{i.expiry_date ? new Date(i.expiry_date).toLocaleDateString('en-NG') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}