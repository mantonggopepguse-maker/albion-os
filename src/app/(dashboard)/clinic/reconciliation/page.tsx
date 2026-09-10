'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useCashReconciliations } from '@/hooks/use-supabase-data';
import { submitCashReconciliation } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import styles from './reconciliation.module.css';

export default function CashReconciliationPage() {
  const { reconciliations, refetch } = useCashReconciliations();
  const { user } = useAuth();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // Form State
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [cashExpected, setCashExpected] = useState<number>(0);
  const [cashActual, setCashActual] = useState<number>(0);
  const [posExpected, setPosExpected] = useState<number>(0);
  const [posActual, setPosActual] = useState<number>(0);
  const [transferExpected, setTransferExpected] = useState<number>(0);
  const [transferActual, setTransferActual] = useState<number>(0);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live calculation
  const totalExpected = useMemo(() => {
    return cashExpected + posExpected + transferExpected;
  }, [cashExpected, posExpected, transferExpected]);

  const totalActual = useMemo(() => {
    return cashActual + posActual + transferActual;
  }, [cashActual, posActual, transferActual]);

  const liveVariance = useMemo(() => {
    return totalActual - totalExpected;
  }, [totalActual, totalExpected]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalRuns = reconciliations.length;
    const balancedRuns = reconciliations.filter((r) => r.status === 'balanced').length;
    const discrepancyRuns = reconciliations.filter((r) => r.status === 'discrepancy').length;
    const netVariance = reconciliations.reduce((sum, r) => sum + r.variance, 0);
    const totalVolume = reconciliations.reduce((sum, r) => sum + r.total_actual, 0);
    return { totalRuns, balancedRuns, discrepancyRuns, netVariance, totalVolume };
  }, [reconciliations]);

  const handleSubmitReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalExpected === 0 && totalActual === 0) {
      setToast({ message: 'Please enter amounts for the shift', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitCashReconciliation({
        date: shiftDate,
        cashier_id: user?.id || 'cashier-1',
        cash_expected: cashExpected,
        cash_actual: cashActual,
        pos_card_expected: posExpected,
        pos_card_actual: posActual,
        bank_transfer_expected: transferExpected,
        bank_transfer_actual: transferActual,
        discrepancy_reason: discrepancyReason.trim() || undefined,
        approved_by: user?.full_name || 'Front Desk Lead',
        location_id: user?.location_id,
      });

      if (res.success) {
        setToast({ message: 'End-of-shift reconciliation recorded successfully', type: 'success' });
        setShowFormModal(false);
        setCashExpected(0);
        setCashActual(0);
        setPosExpected(0);
        setPosActual(0);
        setTransferExpected(0);
        setTransferActual(0);
        setDiscrepancyReason('');
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to submit reconciliation', type: 'error' });
      }
    } catch {
      setToast({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Topbar title="Daily Cash Register Reconciliation" />

      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>💵 End-of-Shift Register & Cash Reconciliation</h1>
        <p className={styles.greetingSub}>
          Physical drawer cash counting, POS card batch settlement, and direct bank transfer balance verification
        </p>
      </div>

      {/* KPI Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Reconciled</span>
              <span className={styles.statValue}>₦{stats.totalVolume.toLocaleString()}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#3b82f6' }}>💰</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Balanced Shifts</span>
              <span className={styles.statValue}>{stats.balancedRuns} / {stats.totalRuns}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#10b981' }}>✅</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Discrepancy Audits</span>
              <span className={styles.statValue}>{stats.discrepancyRuns}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#f59e0b' }}>⚠️</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Cumulative Variance</span>
              <span className={styles.statValue} style={{ color: stats.netVariance === 0 ? '#10b981' : stats.netVariance < 0 ? '#ef4444' : '#f59e0b' }}>
                {stats.netVariance >= 0 ? `+₦${stats.netVariance.toLocaleString()}` : `-₦${Math.abs(stats.netVariance).toLocaleString()}`}
              </span>
            </div>
            <div className={styles.statIcon} style={{ background: '#8b5cf6' }}>⚖️</div>
          </div>
        </div>
      </div>

      {/* Reconciliation Ledger Card */}
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Audit Reconciliation Ledger
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              Historical cash drawer balancing and settlement reports
            </p>
          </div>
          <button className={styles.primaryBtn} onClick={() => setShowFormModal(true)}>
            + Perform Shift Reconciliation
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Physical Cash (Count / Exp)</th>
                <th>POS Card Terminal</th>
                <th>Bank Transfer</th>
                <th>Total Counted</th>
                <th>Variance</th>
                <th>Status</th>
                <th>Sign-off</th>
              </tr>
            </thead>
            <tbody>
              {reconciliations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No cash reconciliations found.
                  </td>
                </tr>
              ) : (
                reconciliations.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 600 }}>{rec.date}</td>
                    <td>
                      <strong>₦{rec.cash_actual.toLocaleString()}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Exp: ₦{rec.cash_expected.toLocaleString()}</div>
                    </td>
                    <td>
                      <strong>₦{rec.pos_card_actual.toLocaleString()}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Exp: ₦{rec.pos_card_expected.toLocaleString()}</div>
                    </td>
                    <td>
                      <strong>₦{rec.bank_transfer_actual.toLocaleString()}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Exp: ₦{rec.bank_transfer_expected.toLocaleString()}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                      ₦{rec.total_actual.toLocaleString()}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: rec.variance === 0 ? '#166534' : rec.variance < 0 ? '#dc2626' : '#d97706',
                        }}
                      >
                        {rec.variance === 0 ? '₦0.00' : rec.variance > 0 ? `+₦${rec.variance.toLocaleString()}` : `-₦${Math.abs(rec.variance).toLocaleString()}`}
                      </span>
                    </td>
                    <td>
                      <span className={rec.status === 'balanced' ? styles.badgeBalanced : styles.badgeDiscrepancy}>
                        {rec.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>{rec.approved_by || 'Verified'}</div>
                      {rec.discrepancy_reason && (
                        <div style={{ fontSize: '10px', color: '#ef4444', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Note: {rec.discrepancy_reason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Perform Shift Reconciliation Modal */}
      <Modal isOpen={showFormModal} onClose={() => setShowFormModal(false)} title="Perform Shift Cash Reconciliation">
        <form onSubmit={handleSubmitReconciliation}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Shift Business Date</label>
            <input
              type="date"
              className={styles.input}
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGrid}>
            {/* Stream 1: Physical Cash */}
            <div className={styles.streamCard}>
              <div className={styles.streamTitle}>💵 Physical Cash Drawer</div>
              <div className={styles.formGroup}>
                <label className={styles.label}>System Expected (₦)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={cashExpected || ''}
                  onChange={(e) => setCashExpected(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Drawer Count Actual (₦)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={cashActual || ''}
                  onChange={(e) => setCashActual(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Stream 2: POS Card Terminal */}
            <div className={styles.streamCard}>
              <div className={styles.streamTitle}>💳 POS Terminal Receipts</div>
              <div className={styles.formGroup}>
                <label className={styles.label}>System Expected (₦)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={posExpected || ''}
                  onChange={(e) => setPosExpected(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Batch Settlement Slip (₦)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={posActual || ''}
                  onChange={(e) => setPosActual(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Stream 3: Bank Transfer */}
            <div className={styles.streamCard}>
              <div className={styles.streamTitle}>🏦 Direct Bank Transfers</div>
              <div className={styles.formGroup}>
                <label className={styles.label}>System Expected (₦)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={transferExpected || ''}
                  onChange={(e) => setTransferExpected(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Verified Credits (₦)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={transferActual || ''}
                  onChange={(e) => setTransferActual(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Real-time Variance Banner */}
          <div className={`${styles.varianceBanner} ${liveVariance === 0 ? styles.bannerBalanced : styles.bannerDiscrepancy}`}>
            <div>
              <strong>Reconciliation Status: {liveVariance === 0 ? 'BALANCED ✅' : 'DISCREPANCY DETECTED ⚠️'}</strong>
              <div style={{ fontSize: '12px' }}>
                Total Expected: ₦{totalExpected.toLocaleString()} | Total Actual Counted: ₦{totalActual.toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>
              {liveVariance === 0 ? '₦0.00' : liveVariance > 0 ? `+₦${liveVariance.toLocaleString()}` : `-₦${Math.abs(liveVariance).toLocaleString()}`}
            </div>
          </div>

          {liveVariance !== 0 && (
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label className={styles.label}>Discrepancy Explanation / Incident Notes</label>
              <textarea
                className={styles.textarea}
                placeholder="Explain the shortage or overage (e.g. Unreconciled POS network decline, bank transfer delay...)"
                value={discrepancyReason}
                onChange={(e) => setDiscrepancyReason(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" className={styles.tabBtn} onClick={() => setShowFormModal(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Record & Seal Shift Reconciliation'}
            </button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
