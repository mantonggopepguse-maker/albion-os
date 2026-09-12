'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useAuth, getRoleLabel, hasRole } from '@/lib/auth-context';
import { useUsers, useLocations, findLocationById, useLeaveRequests } from '@/hooks/use-supabase-data';
import {
  getSalaryForUser,
  getPayslipsForUser,
  getLeaveBalancesForUser,
  getAttendanceLogsForUser,
  getDocumentsForUser,
  getPerformanceTargetsForUser,
  getPerformanceReviewsForUser,
  clockIn,
  clockOut,
  updateStaffUser,
} from '@/lib/data-service';
import type {
  LeaveType,
  Salary,
  Payslip,
  LeaveBalance,
  AttendanceLog,
  EmployeeDocument,
  PerformanceTarget,
  PerformanceReview,
  UserRole,
} from '@/lib/types';
import styles from './staff-detail.module.css';

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: 'sales_rep', label: 'Sales Representative' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'ceo', label: 'Chief Executive Officer' },
  { value: 'clinic_admin', label: 'Clinic Admin' },
  { value: 'vet', label: 'Veterinarian' },
  { value: 'vet_tech', label: 'Vet Technician' },
  { value: 'vet_assistant', label: 'Vet Assistant' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'regional_manager', label: 'Regional Manager' },
  { value: 'security', label: 'Security' },
  { value: 'lab_scientist', label: 'Lab Scientist' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'support_staff', label: 'Support Staff' },
];

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
  const { users, loading: usersLoading, refetch: refetchUsers } = useUsers();
  const { locations } = useLocations();
  const {
    leaveRequests: allLeaveRequests,
    loading: leaveLoading,
    submitLeaveRequest,
    reviewLeaveRequest,
  } = useLeaveRequests();

  const [activeTab, setActiveTab] = useState<Tab>('Salary');
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual' as LeaveType, start_date: '', end_date: '', reason: '' });
  const [roleModal, setRoleModal] = useState(false);
  const [editPrimaryRole, setEditPrimaryRole] = useState<UserRole>('sales_rep');
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [editLocationId, setEditLocationId] = useState<string>('');
  const [savingRoles, setSavingRoles] = useState(false);
  const [clockMsg, setClockMsg] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmReview, setConfirmReview] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null);

  const staff = useMemo(() => users.find((u) => u.id === userId), [users, userId]);
  const location = staff?.location_id ? findLocationById(locations, staff.location_id) : null;
  const isCeo = hasRole(currentUser, 'ceo') || hasRole(currentUser, 'super_admin');
  const isOwnProfile = currentUser?.id === userId;
  const isReviewer = isCeo;

  async function handleSaveRoles(e: React.FormEvent) {
    e.preventDefault();
    if (!staff) return;
    setSavingRoles(true);
    const combinedRoles = Array.from(new Set([editPrimaryRole, ...editRoles]));
    const result = await updateStaffUser(staff.id, {
      role: editPrimaryRole,
      roles: combinedRoles,
      location_id: editLocationId || null,
    });
    setSavingRoles(false);
    if (result.success) {
      setRoleModal(false);
      await refetchUsers();
      setToast({ message: 'Staff roles and permissions updated successfully', type: 'success' });
    } else {
      setToast({ message: result.error || 'Failed to update roles', type: 'error' });
    }
  }

  const [detailsMap, setDetailsMap] = useState<Record<string, {
    salary?: Salary;
    payslips: Payslip[];
    leaveBalances: LeaveBalance[];
    attendanceLogs: AttendanceLog[];
    documents: EmployeeDocument[];
    targets: PerformanceTarget[];
    reviews: PerformanceReview[];
  }>>({});

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    Promise.all([
      getSalaryForUser(staff.id),
      getPayslipsForUser(staff.id),
      getLeaveBalancesForUser(staff.id),
      getAttendanceLogsForUser(staff.id),
      getDocumentsForUser(staff.id),
      getPerformanceTargetsForUser(staff.id),
      getPerformanceReviewsForUser(staff.id),
    ]).then(([salary, payslips, leaveBalances, attendanceLogs, documents, targets, reviews]) => {
      if (cancelled) return;
      setDetailsMap((prev) => ({
        ...prev,
        [staff.id]: { salary, payslips, leaveBalances, attendanceLogs, documents, targets, reviews },
      }));
    }).catch(() => {
      if (cancelled) return;
      setDetailsMap((prev) => ({
        ...prev,
        [staff.id]: { salary: undefined, payslips: [], leaveBalances: [], attendanceLogs: [], documents: [], targets: [], reviews: [] },
      }));
    });
    return () => { cancelled = true; };
  }, [staff]);

  const leaveRequests = useMemo(
    () => staff ? allLeaveRequests.filter((lr) => lr.user_id === staff.id) : [],
    [allLeaveRequests, staff],
  );

  const details = detailsMap[userId];
  const detailsLoading = !details;

  const salary = details?.salary;
  const payslips = details?.payslips ?? [];
  const leaveBalances = details?.leaveBalances ?? [];
  const attendanceLogs = details?.attendanceLogs ?? [];
  const documents = details?.documents ?? [];
  const targets = details?.targets ?? [];
  const reviews = details?.reviews ?? [];

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

  if (detailsLoading) {
    return (
      <>
        <Topbar title={`${staff.full_name} — Staff Profile`} />
        <div className={styles.page} style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Loading staff details...</p>
        </div>
      </>
    );
  }

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

  async function refreshLeaveBalances() {
    if (!staff) return;
    const updated = await getLeaveBalancesForUser(staff.id);
    setDetailsMap((prev) => {
      const current = prev[staff.id];
      if (!current) return prev;
      return {
        ...prev,
        [staff.id]: {
          ...current,
          leaveBalances: updated,
        },
      };
    });
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
      await refreshLeaveBalances();
      setToast({ message: 'Leave request submitted successfully.', type: 'success' });
    } else {
      setToast({ message: result.error || 'Failed to submit leave request', type: 'error' });
    }
  }

  function handleReviewApproval(lr: { id: string }) {
    setConfirmReview({ id: lr.id, status: 'approved' });
  }

  function handleReviewRejection(lr: { id: string }) {
    setConfirmReview({ id: lr.id, status: 'rejected' });
  }

  async function executeLeaveReview() {
    if (!confirmReview) return;
    const { id, status } = confirmReview;
    const result = await reviewLeaveRequest(id, status, status === 'approved' ? 'Approved' : 'Rejected');
    if (result.success) {
      await refreshLeaveBalances();
      setToast({
        message: `Leave request ${status} successfully.`,
        type: 'success',
      });
    } else {
      setToast({
        message: result.error || `Failed to ${status === 'approved' ? 'approve' : 'reject'} leave request`,
        type: 'error',
      });
    }
    setConfirmReview(null);
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
              {staff.roles && staff.roles.length > 1
                ? staff.roles.map((r) => getRoleLabel(r)).join(' · ')
                : getRoleLabel(staff.role)} &middot; {location ? location.name : 'All Locations'}
            </p>
            <p className={styles.profileMeta}>{staff.email} &middot; {staff.phone || '—'}</p>
          </div>
          <div className={styles.profileActions}>
            <span className={`${styles.statusBadge} ${staff.is_active === false ? styles.statusSuspended : styles.statusActive}`}>
              {staff.is_active === false ? 'Suspended' : 'Active'}
            </span>
            {isCeo && (
              <button
                type="button"
                onClick={() => {
                  setEditPrimaryRole(staff.role);
                  setEditRoles(staff.roles && staff.roles.length > 0 ? staff.roles : [staff.role]);
                  setEditLocationId(staff.location_id || '');
                  setRoleModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  background: 'var(--color-navy)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                  transition: 'all 0.15s ease',
                }}
              >
                ⚙️ Edit Roles & Permissions
              </button>
            )}
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
                <h3 className={styles.sectionTitle}>Leave Requests</h3>
                <button className={styles.actionBtn} onClick={() => setLeaveModal(true)}>+ Submit Leave Request</button>
              </div>

              {leaveLoading ? (
                <p style={{ color: 'var(--color-text-muted)' }}>Loading leave requests...</p>
              ) : (
                <>

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
                      {isReviewer && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.length === 0 ? (
                      <tr><td colSpan={isReviewer ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No leave requests found</td></tr>
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
                        {isReviewer && (
                          <td>
                            {lr.status === 'pending' ? (
                              <div className={styles.leaveActions}>
                                <button className={styles.approveBtn} onClick={() => void handleReviewApproval(lr)}>Approve</button>
                                <button className={styles.rejectBtn} onClick={() => void handleReviewRejection(lr)}>Reject</button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </div>
          )}

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

      {/* ── Confirm Leave Review Modal ── */}
      <Modal
        isOpen={!!confirmReview}
        onClose={() => setConfirmReview(null)}
        title={confirmReview?.status === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--color-slate)', lineHeight: 1.5 }}>
            Are you sure you want to <strong>{confirmReview?.status}</strong> this leave request for {staff.full_name}?
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setConfirmReview(null)}
              style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={executeLeaveReview}
              style={{
                padding: '0.5rem 1.25rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                background: confirmReview?.status === 'approved' ? '#15803d' : '#dc2626',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {confirmReview?.status === 'approved' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Roles & Permissions Modal (Super Admin / CEO) ── */}
      {roleModal && (
        <Modal
          isOpen={roleModal}
          onClose={() => setRoleModal(false)}
          title={`Edit Roles & Location — ${staff.full_name}`}
        >
          <form onSubmit={handleSaveRoles} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                Primary Operational Role
              </label>
              <select
                value={editPrimaryRole}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setEditPrimaryRole(newRole);
                  setEditRoles((prev) => Array.from(new Set([newRole, ...prev])));
                }}
                style={{
                  padding: '0.625rem 0.875rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  background: '#fff',
                }}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                Concurrent / Additional Roles ({editRoles.length})
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Select all roles this staff member is authorized to perform
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: '0.5rem',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  background: '#f8fafc',
                }}
              >
                {ALL_ROLES.map((r) => {
                  const isChecked = editRoles.includes(r.value);
                  const isPrimary = editPrimaryRole === r.value;
                  return (
                    <label
                      key={r.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        cursor: isPrimary ? 'not-allowed' : 'pointer',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        background: isChecked ? 'rgba(9, 57, 97, 0.08)' : 'transparent',
                        fontWeight: isChecked ? 600 : 400,
                        color: isChecked ? 'var(--color-navy)' : 'var(--color-text)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isPrimary}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditRoles((prev) =>
                            checked ? [...prev, r.value] : prev.filter((val) => val !== r.value)
                          );
                        }}
                        style={{ accentColor: 'var(--color-navy)' }}
                      />
                      <span>{r.label} {isPrimary && '(Primary)'}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                Facility / Branch Location
              </label>
              <select
                value={editLocationId}
                onChange={(e) => setEditLocationId(e.target.value)}
                style={{
                  padding: '0.625rem 0.875rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  background: '#fff',
                }}
              >
                <option value="">All Locations / Floating</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRoleModal(false)}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingRoles}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--color-navy)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                {savingRoles ? 'Saving Changes...' : 'Save Roles & Permissions'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
