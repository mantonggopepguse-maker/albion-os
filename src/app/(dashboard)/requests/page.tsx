'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import { useStaffRequests, useProducts, useLocations } from '@/hooks/use-supabase-data';
import { useAuth } from '@/lib/auth-context';
import type { StaffRequestType, StaffRequestStatus } from '@/lib/types';
import styles from './requests.module.css';

export default function RequestsPage() {
  const { user } = useAuth();
  const { requests, loading, createRequest, updateStatus } = useStaffRequests(
    user?.id,
    user?.role
  );
  const { products } = useProducts();
  const { locations } = useLocations();

  const isManager = ['super_admin', 'ceo', 'inventory_manager', 'clinic_admin', 'finance_manager'].includes(
    user?.role || ''
  );

  const [activeTab, setActiveTab] = useState<'my' | 'review'>('my');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [reqType, setReqType] = useState<StaffRequestType>('leave');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  // Leave
  const [leaveType, setLeaveType] = useState<'annual' | 'sick' | 'casual' | 'exam' | 'maternity'>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Transfer
  const [targetLocationId, setTargetLocationId] = useState('');
  // Restock & Return
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'urgent'>('normal');
  const [batchNumber, setBatchNumber] = useState('');
  const [returnCondition, setReturnCondition] = useState<'excess' | 'damaged' | 'near_expiry'>('excess');

  // Review modal state
  const [reviewingReqId, setReviewingReqId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<StaffRequestStatus>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Filter requests
  const myRequests = useMemo(() => {
    return requests.filter((r) => r.user_id === user?.id);
  }, [requests, user?.id]);

  const pendingReviewRequests = useMemo(() => {
    return requests.filter((r) => r.status === 'pending');
  }, [requests]);

  const stats = useMemo(() => {
    const list = isManager && activeTab === 'review' ? requests : myRequests;
    const total = list.length;
    const pending = list.filter((r) => r.status === 'pending').length;
    const approved = list.filter((r) => r.status === 'approved').length;
    const rejected = list.filter((r) => r.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [isManager, activeTab, requests, myRequests]);

  const handleOpenModal = (type: StaffRequestType = 'leave') => {
    setReqType(type);
    setTitle('');
    setReason('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
    setTargetLocationId(locations[0]?.id || '');
    setProductId(products[0]?.id || '');
    setQuantity(10);
    setBatchNumber('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setFormError('Please enter a description / reason.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const selProduct = products.find((p) => p.id === productId);
    const selLocation = locations.find((l) => l.id === targetLocationId);

    let generatedTitle = title.trim();
    if (!generatedTitle) {
      if (reqType === 'leave') {
        generatedTitle = `${leaveType.toUpperCase()} Leave (${startDate} to ${endDate})`;
      } else if (reqType === 'transfer') {
        generatedTitle = `Transfer to ${selLocation?.name || 'New Branch'}`;
      } else if (reqType === 'restock') {
        generatedTitle = `Restock: ${selProduct?.name || 'Product'} (${quantity} units)`;
      } else if (reqType === 'return') {
        generatedTitle = `Return: ${selProduct?.name || 'Product'} (${quantity} units)`;
      } else {
        generatedTitle = 'General Staff Request';
      }
    }

    const res = await createRequest({
      user_id: user?.id || 'emp-user',
      user_name: user?.full_name || 'Staff User',
      user_role: user?.role || 'sales_rep',
      location_id: user?.location_id || null,
      location_name: user?.location_name || null,
      type: reqType,
      title: generatedTitle,
      details: {
        leave_type: reqType === 'leave' ? leaveType : undefined,
        start_date: reqType === 'leave' ? startDate : undefined,
        end_date: reqType === 'leave' ? endDate : undefined,
        target_location_id: reqType === 'transfer' ? targetLocationId : undefined,
        target_location_name: reqType === 'transfer' ? selLocation?.name : undefined,
        product_id: reqType === 'restock' || reqType === 'return' ? productId : undefined,
        product_name: reqType === 'restock' || reqType === 'return' ? selProduct?.name : undefined,
        batch_number: reqType === 'return' ? batchNumber : undefined,
        quantity: reqType === 'restock' || reqType === 'return' ? quantity : undefined,
        urgency: reqType === 'restock' ? urgency : undefined,
        return_condition: reqType === 'return' ? returnCondition : undefined,
        reason: reason.trim(),
      },
    });

    setSubmitting(false);
    if (res.success) {
      setIsModalOpen(false);
    } else {
      setFormError(res.error || 'Failed to submit request.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReqId) return;

    setReviewSubmitting(true);
    await updateStatus(
      reviewingReqId,
      reviewAction,
      user?.id || 'mgr-user',
      `${user?.full_name || 'Manager'} (${user?.role?.replace('_', ' ') || 'Admin'})`,
      reviewNotes.trim() || undefined
    );
    setReviewSubmitting(false);
    setReviewingReqId(null);
    setReviewNotes('');
  };

  const displayedRequests = activeTab === 'review' ? pendingReviewRequests : myRequests;

  return (
    <>
      <Topbar title="Staff Requests Portal" />
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Staff Requests & Approvals</h1>
            <p className={styles.subtitle}>
              Submit leave, branch transfers, product restocks, stock returns, and operational inquiries.
            </p>
          </div>
          <button className={styles.primaryBtn} onClick={() => handleOpenModal('leave')}>
            <span>+</span> Submit New Request
          </button>
        </div>

        {/* Top KPIs */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Requests</div>
            <div className={styles.statValue}>{stats.total}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending Review</div>
            <div className={styles.statValue} style={{ color: '#d97706' }}>{stats.pending}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Approved</div>
            <div className={styles.statValue} style={{ color: '#16a34a' }}>{stats.approved}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Rejected</div>
            <div className={styles.statValue} style={{ color: '#dc2626' }}>{stats.rejected}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'my' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('my')}
          >
            My Submitted Requests ({myRequests.length})
          </button>
          {isManager && (
            <button
              className={`${styles.tab} ${activeTab === 'review' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('review')}
            >
              Review Pending Approvals ({pendingReviewRequests.length})
            </button>
          )}
        </div>

        {/* Requests Table */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Request Title & Description</th>
                {activeTab === 'review' && <th>Submitted By</th>}
                <th>Location / Territory</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRequests.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'review' ? 7 : 6} className={styles.emptyState}>
                    {loading ? 'Loading requests...' : 'No requests found in this view.'}
                  </td>
                </tr>
              ) : (
                displayedRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <span className={styles.typeBadge}>{req.type}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--color-navy)', display: 'block' }}>{req.title}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-slate)' }}>{req.details.reason}</span>
                      {req.review_notes && (
                        <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#15803d', background: 'rgba(34, 197, 94, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                          Note: {req.review_notes} ({req.reviewer_name})
                        </div>
                      )}
                    </td>
                    {activeTab === 'review' && (
                      <td>
                        <strong>{req.user_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{req.user_role}</div>
                      </td>
                    )}
                    <td>{req.location_name || 'Headquarters'}</td>
                    <td>{new Date(req.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</td>
                    <td>
                      {req.status === 'pending' && <span className={styles.badgePending}>⏳ Pending</span>}
                      {req.status === 'approved' && <span className={styles.badgeApproved}>✓ Approved</span>}
                      {req.status === 'rejected' && <span className={styles.badgeRejected}>✕ Rejected</span>}
                    </td>
                    <td>
                      {isManager && req.status === 'pending' ? (
                        <div className={styles.actionBtnGroup}>
                          <button
                            className={styles.btnApprove}
                            onClick={() => {
                              setReviewingReqId(req.id);
                              setReviewAction('approved');
                              setReviewNotes('');
                            }}
                          >
                            Approve
                          </button>
                          <button
                            className={styles.btnReject}
                            onClick={() => {
                              setReviewingReqId(req.id);
                              setReviewAction('rejected');
                              setReviewNotes('');
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {req.status === 'pending' ? 'Awaiting Review' : 'Closed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Request Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Submit Staff Request">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && (
            <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              {formError}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
              Request Category *
            </label>
            <select
              value={reqType}
              onChange={(e) => setReqType(e.target.value as StaffRequestType)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
            >
              <option value="leave">Leave & Time-Off Request</option>
              <option value="restock">Product Restock Request (Routes to Warehouse Manager)</option>
              <option value="return">Stock Return (Excess / Damaged / Near-Expiry)</option>
              <option value="transfer">Location / Branch Transfer</option>
              <option value="general">General / Equipment / Reimbursement</option>
            </select>
          </div>

          {/* Leave Fields */}
          {reqType === 'leave' && (
            <div className={styles.formGrid}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Leave Type
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Medical / Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="exam">Examination / Training Leave</option>
                  <option value="maternity">Maternity / Paternity Leave</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Restock & Return Fields */}
          {(reqType === 'restock' || reqType === 'return') && (
            <div className={styles.formGrid}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Pharmaceutical Product *
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Quantity (Units) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              {reqType === 'restock' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                    Restock Urgency
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  >
                    <option value="normal">Normal (Routine Replenishment)</option>
                    <option value="urgent">Urgent (Stock Depleted in Territory)</option>
                  </select>
                </div>
              )}

              {reqType === 'return' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                      Batch Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. OXY-2026-001"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                      Return Condition
                    </label>
                    <select
                      value={returnCondition}
                      onChange={(e) => setReturnCondition(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                    >
                      <option value="excess">Excess / Surplus Inventory</option>
                      <option value="near_expiry">Near Expiry Product</option>
                      <option value="damaged">Damaged Packaging / Seal</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Transfer Fields */}
          {reqType === 'transfer' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Requested Destination Branch / Territory *
              </label>
              <select
                value={targetLocationId}
                onChange={(e) => setTargetLocationId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
              Reason & Details *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a detailed explanation for this request..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
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
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Modal */}
      <Modal isOpen={!!reviewingReqId} onClose={() => setReviewingReqId(null)} title={`${reviewAction === 'approved' ? 'Approve' : 'Reject'} Staff Request`}>
        <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate)', margin: 0 }}>
            You are about to {reviewAction} this staff request. If approved and it is a stock restock/return, inventory will automatically be reconciled.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
              Reviewer Notes / Instructions
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Optional notes or instructions for the employee..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setReviewingReqId(null)}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reviewSubmitting}
              style={{
                padding: '8px 18px',
                background: reviewAction === 'approved' ? '#16a34a' : '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {reviewSubmitting ? 'Submitting...' : `Confirm ${reviewAction === 'approved' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
