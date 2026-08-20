'use client';

import { useState, useMemo, useEffect } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { useUsers } from '@/hooks/use-supabase-data';
import {
  getPayrollRuns,
  getPayslipsForRun,
  processPayroll,
  findUserById,
} from '@/lib/data-service';
import type { PayrollRun, Payslip } from '@/lib/types';
import styles from './payroll.module.css';

function fmt(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export default function PayrollPage() {
  const { user: currentUser } = useAuth();
  const { users } = useUsers();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  useEffect(() => { getPayrollRuns().then(setPayrollRuns); }, []);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [selectedPayslips, setSelectedPayslips] = useState<Payslip[]>([]);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [processForm, setProcessForm] = useState({
    period_start: '',
    period_end: '',
    payment_date: '',
  });

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'ceo';

  const stats = useMemo(() => {
    const completed = payrollRuns.filter((r) => r.status === 'completed');
    return {
      totalRuns: payrollRuns.length,
      totalPaid: completed.reduce((s, r) => s + r.total_net, 0),
      lastRun: completed.length > 0 ? completed[0] : null,
      employeeCount: completed.length > 0 ? completed[0].employee_count : 0,
    };
  }, [payrollRuns]);

  function openPayslips(run: PayrollRun) {
    setSelectedRun(run);
    setSelectedPayslips([]);
    getPayslipsForRun(run.id).then((payslips) => setSelectedPayslips(payslips));
  }

  async function handleProcessPayroll(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setProcessing(true);

    const result = await processPayroll(
      processForm.period_start,
      processForm.period_end,
      processForm.payment_date,
      currentUser.id
    );

    if (result.success) {
      setPayrollRuns(await getPayrollRuns());
      setShowProcessModal(false);
      setProcessForm({ period_start: '', period_end: '', payment_date: '' });
      setToast({ message: 'Payroll processed successfully', type: 'success' });
    } else {
      setToast({ message: result.error || 'Failed to process payroll', type: 'error' });
    }

    setProcessing(false);
  }

  return (
    <>
      <Topbar title="Payroll Management" />

      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.heading}>Payroll Management</h2>
            <p className={styles.subheading}>Process payroll, view payslips, and manage salary runs</p>
          </div>
          {isAdmin && (
            <button className={styles.processBtn} onClick={() => setShowProcessModal(true)}>
              Process Payroll
            </button>
          )}
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.totalRuns}</span>
            <span className={styles.statLabel}>Total Runs</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>{fmt(stats.totalPaid)}</span>
            <span className={styles.statLabel}>Total Disbursed</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.employeeCount}</span>
            <span className={styles.statLabel}>Employees</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>
              {stats.lastRun ? formatDate(stats.lastRun.payment_date) : 'N/A'}
            </span>
            <span className={styles.statLabel}>Last Payment</span>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Payment Date</th>
                <th>Employees</th>
                <th>Gross Pay</th>
                <th>Deductions</th>
                <th>Net Pay</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No payroll runs found. Click &quot;Process Payroll&quot; to create the first run.
                  </td>
                </tr>
              ) : payrollRuns.map((run) => (
                <tr key={run.id} className={styles.row}>
                  <td>
                    <span className={styles.periodText}>
                      {formatShortDate(run.period_start)} &mdash; {formatShortDate(run.period_end)}
                    </span>
                  </td>
                  <td>{formatDate(run.payment_date)}</td>
                  <td>
                    <span className={styles.empCount}>{run.employee_count}</span>
                  </td>
                  <td>{fmt(run.total_gross)}</td>
                  <td style={{ color: 'var(--color-danger)' }}>-{fmt(run.total_deductions)}</td>
                  <td className={styles.netPayCol}>{fmt(run.total_net)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${
                      run.status === 'completed' ? styles.statusCompleted :
                      run.status === 'processing' ? styles.statusProcessing :
                      run.status === 'draft' ? styles.statusDraft :
                      styles.statusCancelled
                    }`}>
                      {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <button className={styles.viewBtn} onClick={() => openPayslips(run)}>
                      View Payslips
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedRun && (
          <Modal
            isOpen={!!selectedRun}
            onClose={() => { setSelectedRun(null); setSelectedPayslips([]); }}
            title={`Payslips — ${formatShortDate(selectedRun.period_start)} to ${formatShortDate(selectedRun.period_end)}`}
            subtitle={`Payment date: ${formatDate(selectedRun.payment_date)} — Total disbursed: ${fmt(selectedRun.total_net)}`}
          >
            <div className={styles.payslipTableWrap}>
              <table className={styles.payslipTable}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Basic Salary</th>
                    <th>Allowances</th>
                    <th>Gross</th>
                    <th>PAYE</th>
                    <th>Pension</th>
                    <th>NHIS</th>
                    <th>Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPayslips.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No payslips for this run</td></tr>
                  ) : selectedPayslips.map((ps) => {
                    const employee = users.find((u) => u.id === ps.user_id) || findUserById(ps.user_id);
                    return (
                      <tr key={ps.id}>
                        <td style={{ fontWeight: 600 }}>{employee?.full_name || 'Unknown'}</td>
                        <td>{fmt(ps.basic_salary)}</td>
                        <td>{fmt(ps.housing_allowance + ps.transport_allowance + ps.medical_allowance)}</td>
                        <td>{fmt(ps.gross_pay)}</td>
                        <td style={{ color: 'var(--color-danger)' }}>-{fmt(ps.paye_tax)}</td>
                        <td style={{ color: 'var(--color-danger)' }}>-{fmt(ps.pension_deduction)}</td>
                        <td style={{ color: 'var(--color-danger)' }}>-{fmt(ps.nhis_deduction)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-navy)' }}>{fmt(ps.net_pay)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Modal>
        )}

        <Modal
          isOpen={showProcessModal}
          onClose={() => !processing && setShowProcessModal(false)}
          title="Process Payroll"
          subtitle="Calculate and generate payslips for all active employees"
        >
          <form onSubmit={handleProcessPayroll} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Period Start</label>
              <input required type="date" value={processForm.period_start}
                onChange={(e) => setProcessForm({ ...processForm, period_start: e.target.value })}
                style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Period End</label>
              <input required type="date" value={processForm.period_end}
                onChange={(e) => setProcessForm({ ...processForm, period_end: e.target.value })}
                style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Payment Date</label>
              <input required type="date" value={processForm.payment_date}
                onChange={(e) => setProcessForm({ ...processForm, payment_date: e.target.value })}
                style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" disabled={processing}
                onClick={() => setShowProcessModal(false)}
                style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)', opacity: processing ? 0.5 : 1 }}
              >Cancel</button>
              <button type="submit" disabled={processing}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: processing ? '#6b7280' : 'var(--color-navy)', color: '#fff', cursor: processing ? 'not-allowed' : 'pointer' }}
              >{processing ? 'Processing...' : 'Process Payroll'}</button>
            </div>
          </form>
        </Modal>
      </div>

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
