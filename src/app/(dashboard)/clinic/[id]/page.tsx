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
  useCashReconciliations,
  useExpenses,
} from '@/hooks/use-supabase-data';
import styles from './clinic-branch.module.css';

function fmtNgn(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

export default function ClinicBranchPage() {
  const params = useParams();
  const clinicId = params.id as string;

  const { locations } = useLocations();
  const { patients } = useClinicPatients();
  const { appointments } = useClinicAppointments();
  const { treatments } = useClinicTreatments();
  const { inventory } = useInventory();
  const { products } = useProducts();
  const { reconciliations } = useCashReconciliations();
  const { expenses } = useExpenses();

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
  const branchRecs = useMemo(() => reconciliations.filter((r) => r.location_id === clinicId), [reconciliations, clinicId]);
  const branchExp = useMemo(() => expenses.filter((e) => e.location_id === clinicId), [expenses, clinicId]);

  const stockValue = useMemo(() => {
    return branchStock.reduce((sum, i) => sum + (i.quantity || 0) * (productPrice.get(i.product_id) || 0), 0);
  }, [branchStock, productPrice]);

  const revenue = useMemo(() => {
    return (
      branchRecs.reduce((sum, r) => sum + (r.total_actual || 0), 0) +
      branchTx.reduce((sum, t) => sum + (t.total_cost || 0), 0)
    );
  }, [branchRecs, branchTx]);

  const totalExpenses = useMemo(() => {
    return branchExp.reduce((sum, e) => sum + e.amount, 0);
  }, [branchExp]);

  const netMargin = revenue - totalExpenses;

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
              {clinic.address || clinic.state || '—'} &middot; {clinic.region || 'Regional'} Clinic Branch
            </p>
          </div>
        </div>

        {/* ── 4 Reconciled Financial & Operational KPIs ── */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Reconciled Revenue</span>
            <span className={styles.statValue}>{fmtNgn(revenue)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Operating Expenses</span>
            <span className={styles.statValue}>{fmtNgn(totalExpenses)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Net Operating Margin</span>
            <span className={styles.statValue} style={{ color: netMargin >= 0 ? '#15803d' : '#b91c1c' }}>
              {fmtNgn(netMargin)}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Inventory Valuation</span>
            <span className={styles.statValue}>{fmtNgn(stockValue)}</span>
          </div>
        </div>

        {/* ── Cash Register Reconciliations ── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Daily Cash Register Reconciliations</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Shift Date</th>
                  <th>Shift</th>
                  <th>Reconciled By</th>
                  <th>Cash</th>
                  <th>POS / Card</th>
                  <th>Transfer</th>
                  <th>Total Actual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {branchRecs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                      No cash register reconciliations for this branch
                    </td>
                  </tr>
                ) : (
                  branchRecs.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.shift_date}</strong></td>
                      <td style={{ textTransform: 'capitalize' }}>{(r.shift_type || 'full_day').replace('_', ' ')}</td>
                      <td>{r.reconciled_by}</td>
                      <td>{fmtNgn(r.cash_actual)}</td>
                      <td>{fmtNgn(r.pos_card_actual)}</td>
                      <td>{fmtNgn(r.bank_transfer_actual)}</td>
                      <td><strong>{fmtNgn(r.total_actual)}</strong></td>
                      <td>
                        <span className={`${styles.badgePill} ${r.status === 'balanced' ? styles.badgeSuccess : styles.badgeDanger}`}>
                          {r.status?.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Clinical Treatments & Billing ── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Clinical Treatments & Case Billing</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Attending Vet</th>
                  <th>Diagnosis / Service</th>
                  <th>Date</th>
                  <th>Treatment Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {branchTx.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                      No treatments recorded for this branch
                    </td>
                  </tr>
                ) : (
                  branchTx.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.patient?.name || 'Patient'}</strong> ({t.patient?.species || 'Canine'})</td>
                      <td>{t.vet?.full_name || 'Veterinarian'}</td>
                      <td>{t.diagnosis || 'Clinical Investigation'}</td>
                      <td>{t.date}</td>
                      <td><strong>{fmtNgn(t.total_cost || 0)}</strong></td>
                      <td>
                        <span className={`${styles.badgePill} ${styles.badgeSuccess}`}>
                          {t.status?.toUpperCase() || 'COMPLETED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Branch Stock ── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Branch Medication & Supplies Stock</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch Number</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Stock Value</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {branchStock.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                      No stock allocated to this branch
                    </td>
                  </tr>
                ) : (
                  branchStock.map((i) => {
                    const price = productPrice.get(i.product_id) || 0;
                    return (
                      <tr key={i.id}>
                        <td><strong>{products.find((p) => p.id === i.product_id)?.name || i.product_id}</strong></td>
                        <td>{i.batch_number || '—'}</td>
                        <td><strong>{i.quantity} units</strong></td>
                        <td>{fmtNgn(price)}</td>
                        <td><strong>{fmtNgn((i.quantity || 0) * price)}</strong></td>
                        <td>{i.expiry_date ? new Date(i.expiry_date).toLocaleDateString('en-NG') : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Branch Patients ── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Registered Branch Patients ({branchPatients.length})</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Species / Breed</th>
                  <th>Client / Owner</th>
                  <th>Registration Date</th>
                </tr>
              </thead>
              <tbody>
                {branchPatients.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                      No registered patients at this branch
                    </td>
                  </tr>
                ) : (
                  branchPatients.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.species} {p.breed ? `(${p.breed})` : ''}</td>
                      <td>{p.owner?.full_name || '—'}</td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('en-NG') : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}