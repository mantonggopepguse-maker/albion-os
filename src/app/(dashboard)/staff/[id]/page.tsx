'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import { useAuth, getRoleLabel } from '@/lib/auth-context';
import { useUsers, useLocations, findLocationById } from '@/hooks/use-supabase-data';
import {
  getSalaryForUser,
  getPayslipsForUser,
  getLeaveRequestsForUser,
  getLeaveBalancesForUser,
  getAttendanceLogsForUser,
  getDocumentsForUser,
  getPerformanceTargetsForUser,
  getPerformanceReviewsForUser,
  clockIn,
  clockOut,
  submitLeaveRequest,
} from '@/lib/data-service';
import type { LeaveType } from '@/lib/types';
import styles from './staff-detail.module.css';

function fmt(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const TABS = ['Salary', 'Leave', 'Attendance', 'Documents', 'Performance'] as const;
type Tab = typeof TABS[number];

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { user: currentUser } = useAuth();
  const { users, loading: usersLoading } = useUsers();
  const { locations } = useLocations();

  const [activeTab, setActiveTab] = useState<Tab>('Salary');
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual' as LeaveType, start_date: '', end_date: '', reason: '' });
  const [clockMsg, setClockMsg] = useState('');

  const staff = useMemo(() => users.find((u) => u.id === userId), [users, userId]);
  const location = staff?.location_id ? findLocationById(locations, staff.location_id) : null;
  const isCeo = currentUser?.role === 'ceo' || currentUser?.role === 'super_admin';
  const isOwnProfile = currentUser?.id === userId;

  const salary = useMemo(() => staff ? getSalaryForUser(staff.id) : undefined, [staff]);
  const payslips = useMemo(() => staff ? getPayslipsForUser(staff.id) : [], [staff]);
  const leaveRequests = useMemo(() => staff ? getLeaveRequestsForUser(staff.id) : [], [staff]);
  const leaveBalances = useMemo(() => staff ? getLeaveBalancesForUser(staff.id) : [], [staff]);
  const attendanceLogs = useMemo(() => staff ? getAttendanceLogsForUser(staff.id) : [], [staff]);
  const documents = useMemo(() => staff ? getDocumentsForUser(staff.id) : [], [staff]);
  const targets = useMemo(() => staff ? getPerformanceTargetsForUser(staff.id) : [], [staff]);
  const reviews = useMemo(() => staff ? getPerformanceReviewsForUser(staff.id) : [], [staff]);

  if (usersLoading) {
    return (
      <>
        <Topbar title="Staff Profile" />
        <div className={styles.page} style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Loading staff profile...</p>
        </div>
      </>
    );
  }

  if (!staff) {
    return (
      <>
        <Topbar title="Staff Profile" />
        <div className={styles.page} style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Staff member not found.</p>
          <button onClick={() => router.push('/staff')} className={styles.backBtn}>Back to Staff</button>
        </div>
      </>
    );
  }

  const initials = staff.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const profile = staff!;

  async function handleClockIn() {
    const result = await clockIn(isOwnProfile ? currentUser!.id : profile.id);
    setClockMsg(result.success ? 'Clocked in successfully' : (result.error || ''));
    setTimeout(() => setClockMsg(''), 3000);
  }

  async function handleClockOut() {
    const result = await clockOut(isOwnProfile ? currentUser!.id : profile.id);
    setClockMsg(result.success ? 'Clocked out successfully' : (result.error || ''));
    setTimeout(() => setClockMsg(''), 3000);
  }

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await submitLeaveRequest({
      user_id: profile.id,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason,
    });
    if (result.success) {
      setLeaveModal(false);
      setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    } else {
      alert(result.error || 'Failed to submit leave request');
    }
  }

  return (
    <>
      <Topbar title={`${staff.full_name} — Staff Profile`} />

      <div className={styles.page}>
        <div className={styles.profileHeader}>
          <div className={styles.profileAvatar}>{initials}</div>
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{staff.full_name}</h1>
            <p className={styles.profileMeta}>
              {getRoleLabel(staff.role)} &middot; {location ? location.name : 'All Locations'}
            </p>
            <p className={styles.profileMeta}>{staff.email} &middot; {staff.phone || '—'}</p>
          </div>
          <div className={styles.profileActions}>
            <span className={`${styles.statusBadge} ${staff.is_active === false ? styles.statusSuspended : styles.statusActive}`}>
              {staff.is_active === false ? 'Suspended' : 'Active'}
            </span>
          </div>
        </div>

        {clockMsg && (
          <div className={styles.clockMsg}>{clockMsg}</div>
        )}

        {activeTab === 'Attendance' && isOwnProfile && (
          <div className={styles.clockActions}>
            <button className={styles.clockBtn} onClick={handleClockIn}>Clock In</button>
            <button className={styles.clockBtn} onClick={handleClockOut}>Clock Out</button>
          </div>
        )}

        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>
          {/* ── Salary Tab ── */}
          {activeTab === 'Salary' && (
            <div className={styles.section}>
              {salary ? (
                <>
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Basic Salary</span>
                      <span className={styles.statCardValue}>{fmt(salary.basic_salary)}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Housing Allowance</span>
                      <span className={styles.statCardValue}>{fmt(salary.housing_allowance)}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Transport Allowance</span>
                      <span className={styles.statCardValue}>{fmt(salary.transport_allowance)}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Medical Allowance</span>
                      <span className={styles.statCardValue}>{fmt(salary.medical_allowance)}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Total Gross</span>
                      <span className={styles.statCardValue} style={{ color: 'var(--color-navy)' }}>{fmt(salary.total_gross)}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Total Deductions</span>
                      <span className={styles.statCardValue} style={{ color: 'var(--color-danger)' }}>-{fmt(salary.total_deductions)}</span>
                    </div>
                    <div className={`${styles.statCard} ${styles.statCardHighlight}`}>
                      <span className={styles.statCardLabel}>Net Pay</span>
                      <span className={styles.statCardValue}>{fmt(salary.net_pay)}</span>
                    </div>
                  </div>

                  <div className={styles.deductionsBar}>
                    <h3 className={styles.sectionTitle}>Deductions Breakdown</h3>
                    <div className={styles.statsGrid}>
                      <div className={styles.statCard}>
                        <span className={styles.statCardLabel}>PAYE Tax ({salary.tax_rate}%)</span>
                        <span className={styles.statCardValue} style={{ color: 'var(--color-danger)' }}>-{fmt(Math.round(salary.total_gross * salary.tax_rate / 100))}</span>
                      </div>
                      <div className={styles.statCard}>
                        <span className={styles.statCardLabel}>Pension ({salary.pension_rate}%)</span>
                        <span className={styles.statCardValue} style={{ color: 'var(--color-danger)' }}>-{fmt(Math.round(salary.total_gross * salary.pension_rate / 100))}</span>
                      </div>
                      <div className={styles.statCard}>
                        <span className={styles.statCardLabel}>NHIS ({salary.nhis_rate}%)</span>
                        <span className={styles.statCardValue} style={{ color: 'var(--color-danger)' }}>-{fmt(Math.round(salary.total_gross * salary.nhis_rate / 100))}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className={styles.sectionTitle}>Payslip History</h3>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Gross Pay</th>
                          <th>Deductions</th>
                          <th>Net Pay</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payslips.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No payslips found</td></tr>
                        ) : payslips.map((ps) => (
                          <tr key={ps.id} className={styles.row}>
                            <td>{formatDate(ps.created_at)}</td>
                            <td>{fmt(ps.gross_pay)}</td>
                            <td style={{ color: 'var(--color-danger)' }}>-{fmt(ps.total_deductions)}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(ps.net_pay)}</td>
                            <td>{formatDate(ps.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <p>No salary record assigned for this staff member.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Leave Tab ── */}
          {activeTab === 'Leave' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Leave Balances</h3>
                {(isCeo || isOwnProfile) && (
                  <button className={styles.actionBtn} onClick={() => setLeaveModal(true)}>Request Leave</button>
                )}
              </div>

              <div className={styles.statsGrid}>
                {leaveBalances.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)' }}>No leave balances set up.</p>
                ) : leaveBalances.map((lb) => (
                  <div key={lb.id} className={styles.statCard}>
                    <span className={styles.statCardLabel}>{lb.leave_type.charAt(0).toUpperCase() + lb.leave_type.slice(1)} Leave</span>
                    <div className={styles.leaveBar}>
                      <div className={styles.leaveBarFill} style={{ width: `${(lb.used_days / lb.total_days) * 100}%` }} />
                    </div>
                    <div className={styles.leaveStats}>
                      <span>{lb.used_days} used</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{lb.remaining_days} remaining</span>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className={styles.sectionTitle}>Leave History</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No leave requests found</td></tr>
                    ) : leaveRequests.map((lr) => (
                      <tr key={lr.id} className={styles.row}>
                        <td><span className={styles.leaveTypeBadge}>{lr.leave_type}</span></td>
                        <td>{formatDate(lr.start_date)} &mdash; {formatDate(lr.end_date)}</td>
                        <td>{lr.duration_days}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lr.reason}</td>
                        <td>
                          <span className={`${styles.leaveStatusBadge} ${
                            lr.status === 'approved' ? styles.leaveApproved :
                            lr.status === 'rejected' ? styles.leaveRejected :
                            lr.status === 'cancelled' ? styles.leaveCancelled :
                            styles.leavePending
                          }`}>
                            {lr.status.charAt(0).toUpperCase() + lr.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Attendance Tab ── */}
          {activeTab === 'Attendance' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Attendance Records</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Hours</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No attendance records found</td></tr>
                    ) : attendanceLogs.map((log) => (
                      <tr key={log.id} className={styles.row}>
                        <td>{formatDate(log.date)}</td>
                        <td>{log.clock_in ? new Date(log.clock_in).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{log.clock_out ? new Date(log.clock_out).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{log.hours_worked ? `${log.hours_worked}h` : '—'}</td>
                        <td>
                          <span className={`${styles.attStatusBadge} ${
                            log.status === 'present' ? styles.attPresent :
                            log.status === 'late' ? styles.attLate :
                            log.status === 'absent' ? styles.attAbsent :
                            log.status === 'half_day' ? styles.attHalf :
                            styles.attLeave
                          }`}>
                            {log.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Documents Tab ── */}
          {activeTab === 'Documents' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Employee Documents</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Expiry</th>
                      <th>Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No documents uploaded</td></tr>
                    ) : documents.map((doc) => (
                      <tr key={doc.id} className={styles.row}>
                        <td>
                          <div className={styles.docCell}>
                            <span className={styles.docIcon}>📄</span>
                            <span>{doc.document_name}</span>
                          </div>
                        </td>
                        <td><span className={styles.docTypeBadge}>{doc.document_type.replace('_', ' ')}</span></td>
                        <td>{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : '—'}</td>
                        <td>{doc.expiry_date ? formatDate(doc.expiry_date) : 'N/A'}</td>
                        <td>
                          <span className={`${styles.verifyBadge} ${doc.is_verified ? styles.verifyYes : styles.verifyNo}`}>
                            {doc.is_verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Performance Tab ── */}
          {activeTab === 'Performance' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Sales Targets</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Type</th>
                      <th>Sales Target</th>
                      <th>Actual Sales</th>
                      <th>Achievement</th>
                      <th>Collections</th>
                      <th>New Customers</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No performance targets found</td></tr>
                    ) : targets.map((t) => {
                      const salesPct = t.sales_target > 0 ? Math.round((t.actual_sales / t.sales_target) * 100) : 0;
                      return (
                        <tr key={t.id} className={styles.row}>
                          <td>{formatDate(t.period_start)} &mdash; {formatDate(t.period_end)}</td>
                          <td><span className={styles.targetTypeBadge}>{t.target_type}</span></td>
                          <td>{fmt(t.sales_target)}</td>
                          <td>{fmt(t.actual_sales)}</td>
                          <td>
                            <div className={styles.targetBar}>
                              <div className={styles.targetBarFill} style={{ width: `${Math.min(salesPct, 100)}%` }} />
                              <span className={styles.targetPct}>{salesPct}%</span>
                            </div>
                          </td>
                          <td>{fmt(t.actual_collection)} / {fmt(t.collection_target)}</td>
                          <td>{t.new_customers_actual} / {t.new_customers_target}</td>
                          <td>
                            <span className={`${styles.targetStatusBadge} ${
                              t.status === 'achieved' ? styles.targetAchieved :
                              t.status === 'missed' ? styles.targetMissed :
                              t.status === 'cancelled' ? styles.targetCancelled :
                              styles.targetActive
                            }`}>
                              {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h3 className={styles.sectionTitle}>Performance Reviews</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Sales Achievement</th>
                      <th>Collection Rate</th>
                      <th>Customer Satisfaction</th>
                      <th>Overall Rating</th>
                      <th>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No performance reviews found</td></tr>
                    ) : reviews.map((r) => (
                      <tr key={r.id} className={styles.row}>
                        <td>{r.review_period}</td>
                        <td>{r.sales_achievement !== null ? `${r.sales_achievement}%` : 'N/A'}</td>
                        <td>{r.collection_rate !== null ? `${r.collection_rate}%` : 'N/A'}</td>
                        <td>{r.customer_satisfaction !== null ? `${r.customer_satisfaction}%` : 'N/A'}</td>
                        <td>
                          <span className={styles.rating}>
                            {r.overall_rating !== null ? `${r.overall_rating} / 5` : 'N/A'}
                          </span>
                        </td>
                        <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {r.comments || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {leaveModal && (
        <Modal isOpen={leaveModal} onClose={() => setLeaveModal(false)} title="Request Leave" subtitle="Submit a leave request for approval">
          <form onSubmit={handleLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Leave Type</label>
              <select
                required value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as LeaveType })}
                style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' }}
              >
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="personal">Personal Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="study">Study Leave</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Start Date</label>
                <input required type="date" value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>End Date</label>
                <input required type="date" value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Reason</label>
              <textarea required value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', minHeight: 80, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setLeaveModal(false)}
                style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)' }}
              >Cancel</button>
              <button type="submit"
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: 'var(--color-navy)', color: '#fff', cursor: 'pointer' }}
              >Submit Request</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
