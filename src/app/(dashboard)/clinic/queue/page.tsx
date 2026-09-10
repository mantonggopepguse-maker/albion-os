'use client';

import { useState, useMemo, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useClinicQueue, useClinicPatients, useUsers } from '@/hooks/use-supabase-data';
import { addToQueue, updateQueueStatus } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import type { QueuePriority, QueueStatus } from '@/lib/types';
import styles from './queue.module.css';

export default function ClinicQueuePage() {
  const { queue, loading, refetch } = useClinicQueue();
  const { patients } = useClinicPatients();
  const { users } = useUsers();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'waiting' | 'in_consultation' | 'completed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [department, setDepartment] = useState('Consultation');
  const [priority, setPriority] = useState<QueuePriority>('normal');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Computed stats
  const stats = useMemo(() => {
    const total = queue.length;
    const waiting = queue.filter((q) => q.status === 'waiting').length;
    const inConsultation = queue.filter((q) => q.status === 'in_consultation').length;
    const completed = queue.filter((q) => q.status === 'completed').length;
    return { total, waiting, inConsultation, completed };
  }, [queue]);

  // Filtered queue
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      const matchesTab = activeTab === 'all' || item.status === activeTab;
      const patientName = item.patient?.name || '';
      const ownerName = item.owner?.full_name || '';
      const reasonText = item.reason || '';
      const q = search.toLowerCase();
      const matchesSearch =
        patientName.toLowerCase().includes(q) ||
        ownerName.toLowerCase().includes(q) ||
        reasonText.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [queue, activeTab, search]);

  const handleStatusChange = async (
    id: string,
    newStatus: 'waiting' | 'in_consultation' | 'completed' | 'cancelled'
  ) => {
    try {
      const res = await updateQueueStatus(id, newStatus, user?.id);
      if (res.success) {
        setToast({ message: `Queue entry marked as ${newStatus}`, type: 'success' });
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to update status', type: 'error' });
      }
    } catch {
      setToast({ message: 'An unexpected error occurred', type: 'error' });
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setToast({ message: 'Please select a patient', type: 'error' });
      return;
    }
    const patientObj = patients.find((p) => p.id === selectedPatientId);
    if (!patientObj) return;

    setSubmitting(true);
    try {
      const res = await addToQueue({
        patient_id: selectedPatientId,
        owner_id: patientObj.owner_id,
        location_id: patientObj.location_id || user?.location_id,
        department,
        priority,
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        setToast({ message: 'Patient successfully checked into queue', type: 'success' });
        setShowAddModal(false);
        setSelectedPatientId('');
        setReason('');
        setPriority('normal');
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to add patient to queue', type: 'error' });
      }
    } catch {
      setToast({ message: 'An error occurred while checking in', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const priorityClass = (p: QueuePriority) => {
    if (p === 'emergency') return styles.badgeEmergency;
    if (p === 'urgent') return styles.badgeUrgent;
    return styles.badgeNormal;
  };

  const statusClass = (s: QueueStatus) => {
    if (s === 'waiting') return styles.badgeWaiting;
    if (s === 'in_consultation') return styles.badgeInConsultation;
    if (s === 'completed') return styles.badgeCompleted;
    return styles.badgeCancelled;
  };

  return (
    <>
      <Topbar title="Patient Queue & Triage" />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.page}>
        <div className={styles.greeting}>
          <h2 className={styles.greetingText}>Live Clinical Queue</h2>
          <p className={styles.greetingSub}>
            Monitor triage priority, patient waiting times, and active consultations in real time.
          </p>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Total Today</span>
                <span className={styles.statValue}>{stats.total}</span>
              </div>
              <div className={styles.statIcon} style={{ background: '#0284c7' }}>
                📋
              </div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Waiting</span>
                <span className={styles.statValue}>{stats.waiting}</span>
              </div>
              <div className={styles.statIcon} style={{ background: '#d97706' }}>
                ⏳
              </div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>In Consultation</span>
                <span className={styles.statValue}>{stats.inConsultation}</span>
              </div>
              <div className={styles.statIcon} style={{ background: '#8b5cf6' }}>
                🩺
              </div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Completed</span>
                <span className={styles.statValue}>{stats.completed}</span>
              </div>
              <div className={styles.statIcon} style={{ background: '#16a34a' }}>
                ✅
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All ({stats.total})
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'waiting' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('waiting')}
              >
                Waiting ({stats.waiting})
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'in_consultation' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('in_consultation')}
              >
                In Consultation ({stats.inConsultation})
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'completed' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                Completed ({stats.completed})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                className={styles.searchBar}
                placeholder="Search pet, owner, or reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className={styles.primaryBtn} onClick={() => setShowAddModal(true)}>
                + Check In Patient
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Owner</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      {loading ? 'Loading queue entries...' : 'No patients currently in queue.'}
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.patient?.name || 'Unknown Patient'}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {item.patient?.species || 'Animal'}
                        </div>
                      </td>
                      <td>
                        {item.owner?.full_name || 'Walk-in'}
                        {item.owner?.phone && (
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{item.owner.phone}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#093961' }}>{item.department}</span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${priorityClass(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td>{item.reason || '—'}</td>
                      <td>
                        <span className={`${styles.badge} ${statusClass(item.status)}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {item.status === 'waiting' && (
                            <button
                              className={styles.actionBtn}
                              style={{ background: '#8b5cf6', color: 'white', borderColor: '#8b5cf6' }}
                              onClick={() => handleStatusChange(item.id, 'in_consultation')}
                            >
                              Call Vet
                            </button>
                          )}
                          {item.status === 'in_consultation' && (
                            <button
                              className={styles.actionBtn}
                              style={{ background: '#16a34a', color: 'white', borderColor: '#16a34a' }}
                              onClick={() => handleStatusChange(item.id, 'completed')}
                            >
                              Complete
                            </button>
                          )}
                          {item.status !== 'completed' && item.status !== 'cancelled' && (
                            <button
                              className={styles.actionBtn}
                              style={{ color: '#ef4444' }}
                              onClick={() => handleStatusChange(item.id, 'cancelled')}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Check In Modal */}
        {showAddModal && (
          <Modal title="Check In Patient to Queue" onClose={() => setShowAddModal(false)}>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Select Registered Patient *
                </label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.species}) — Owner: {p.owner?.full_name || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Surgery">Surgery</option>
                    <option value="Vaccination">Vaccination</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Pharmacy">Pharmacy</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Triage Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as QueuePriority)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="normal">Normal (Routine)</option>
                    <option value="urgent">Urgent (Priority)</option>
                    <option value="emergency">Emergency (Critical)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Chief Complaint / Reason for Visit
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Lethargy, vomiting since yesterday morning..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: '#093961',
                    color: 'white',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? 'Checking In...' : 'Check In'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
}
