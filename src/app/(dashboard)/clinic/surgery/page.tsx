'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useSurgeries, useClinicPatients } from '@/hooks/use-supabase-data';
import { createSurgery, updateSurgeryStatus } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import type { SurgeryRecord, SurgeryStatus } from '@/lib/types';
import styles from './surgery.module.css';

export default function SurgerySuitePage() {
  const { surgeries, refetch } = useSurgeries();
  const { patients } = useClinicPatients();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New Surgery Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [surgeonName, setSurgeonName] = useState('');
  const [theaterRoom, setTheaterRoom] = useState('OR-1 Main Sterile Suite');
  const [anesthesiaProtocol, setAnesthesiaProtocol] = useState('Propofol Induction + Isoflurane Maintenance');
  const [scheduledDate, setScheduledDate] = useState('');
  const [submittingSurgery, setSubmittingSurgery] = useState(false);

  // Active Theater / Checklist Modal
  const [selectedSurgery, setSelectedSurgery] = useState<SurgeryRecord | null>(null);
  const [checklist, setChecklist] = useState({
    fastingVerified: false,
    bloodworkCleared: false,
    consentSigned: false,
    ivCatheterPatent: false,
    premedAdministered: false,
    etTubeChecked: false,
  });
  const [theaterNotes, setTheaterNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const stats = useMemo(() => {
    const total = surgeries.length;
    const inSurgery = surgeries.filter((s) => s.status === 'in_surgery').length;
    const recovery = surgeries.filter((s) => s.status === 'recovery').length;
    const completed = surgeries.filter((s) => s.status === 'completed').length;
    return { total, inSurgery, recovery, completed };
  }, [surgeries]);

  const filteredSurgeries = useMemo(() => {
    return surgeries.filter((s) => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const patient = patients.find((p) => p.id === s.patient_id);
      const patientName = patient?.name || '';
      const q = search.toLowerCase();
      const matchesSearch =
        s.surgery_number.toLowerCase().includes(q) ||
        s.procedure_name.toLowerCase().includes(q) ||
        (s.surgeon_name || s.primary_surgeon || '').toLowerCase().includes(q) ||
        patientName.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [surgeries, statusFilter, search, patients]);

  const handleCreateSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !procedureName.trim() || !scheduledDate) {
      setToast({ message: 'Patient, procedure, and scheduled date are required', type: 'error' });
      return;
    }
    setSubmittingSurgery(true);
    try {
      const res = await createSurgery({
        patient_id: patientId,
        procedure_name: procedureName.trim(),
        surgeon_name: surgeonName.trim() || user?.full_name || 'Veterinary Surgeon',
        anesthesia_protocol: anesthesiaProtocol,
        theater_room: theaterRoom,
        status: 'scheduled',
        scheduled_date: new Date(scheduledDate).toISOString(),
        location_id: user?.location_id,
      });

      if (res.success) {
        setToast({ message: 'Surgical procedure scheduled successfully', type: 'success' });
        setShowAddModal(false);
        setPatientId('');
        setProcedureName('');
        setScheduledDate('');
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to schedule procedure', type: 'error' });
      }
    } catch {
      setToast({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmittingSurgery(false);
    }
  };

  const openTheaterModal = (s: SurgeryRecord) => {
    setSelectedSurgery(s);
    setTheaterNotes(s.surgical_notes || '');
    setChecklist({
      fastingVerified: s.status !== 'scheduled',
      bloodworkCleared: s.status !== 'scheduled',
      consentSigned: s.status !== 'scheduled',
      ivCatheterPatent: s.status === 'in_surgery' || s.status === 'recovery' || s.status === 'completed',
      premedAdministered: s.status === 'in_surgery' || s.status === 'recovery' || s.status === 'completed',
      etTubeChecked: s.status === 'in_surgery' || s.status === 'recovery' || s.status === 'completed',
    });
  };

  const handleUpdateStatus = async (newStatus: SurgeryStatus) => {
    if (!selectedSurgery) return;
    setUpdatingStatus(true);
    try {
      const res = await updateSurgeryStatus(selectedSurgery.id, newStatus, theaterNotes.trim() || undefined);
      if (res.success) {
        setToast({ message: `Surgery updated to ${newStatus.replace(/_/g, ' ').toUpperCase()}`, type: 'success' });
        setSelectedSurgery(null);
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to update status', type: 'error' });
      }
    } catch {
      setToast({ message: 'Error updating surgery status', type: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className={styles.page}>
      <Topbar title="Surgical Suite & Anesthesia Monitoring" />

      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>⚡ Veterinary Surgical Suite & Theater Management</h1>
        <p className={styles.greetingSub}>
          Operating room scheduling, pre-anesthetic safety checklists, intra-operative depth monitoring, and post-op recovery tracking
        </p>
      </div>

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Procedures</span>
              <span className={styles.statValue}>{stats.total}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#3b82f6' }}>📋</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>🔴 Active In Surgery</span>
              <span className={styles.statValue}>{stats.inSurgery}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#ef4444' }}>🔪</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Post-Op Recovery</span>
              <span className={styles.statValue}>{stats.recovery}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#8b5cf6' }}>🛏️</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Completed Today</span>
              <span className={styles.statValue}>{stats.completed}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#10b981' }}>✅</div>
          </div>
        </div>
      </div>

      {/* Main Suite Schedule Table */}
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div className={styles.searchBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search surgery #, procedure, surgeon, or patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className={styles.primaryBtn} onClick={() => setShowAddModal(true)}>
            + Book Surgical Procedure
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className={styles.tabs}>
          {['all', 'scheduled', 'pre_op', 'in_surgery', 'recovery', 'completed'].map((st) => (
            <button
              key={st}
              className={`${styles.tabBtn} ${statusFilter === st ? styles.tabActive : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All Surgeries' : st.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Surgery #</th>
                <th>Patient</th>
                <th>Procedure</th>
                <th>Surgeon</th>
                <th>Theater</th>
                <th>Scheduled Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSurgeries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No surgical procedures scheduled.
                  </td>
                </tr>
              ) : (
                filteredSurgeries.map((surg) => {
                  const patient = patients.find((p) => p.id === surg.patient_id);
                  return (
                    <tr key={surg.id}>
                      <td style={{ fontWeight: 600 }}>{surg.surgery_number}</td>
                      <td>
                        <strong>{patient?.name || 'Unknown Patient'}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {patient?.species} ({patient?.breed || 'Mixed'}) • {patient?.weight_kg || '—'} kg
                        </div>
                      </td>
                      <td>
                        <strong>{surg.procedure_name}</strong>
                      </td>
                      <td>{surg.surgeon_name}</td>
                      <td>{surg.theater_room || 'OR-1'}</td>
                      <td>{new Date(surg.scheduled_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            surg.status === 'scheduled'
                              ? styles.badgeScheduled
                              : surg.status === 'pre_op'
                              ? styles.badgePreOp
                              : surg.status === 'in_surgery'
                              ? styles.badgeInSurgery
                              : surg.status === 'recovery'
                              ? styles.badgeRecovery
                              : styles.badgeCompleted
                          }`}
                        >
                          {surg.status === 'in_surgery' ? '🔴 IN SURGERY' : surg.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <button className={styles.actionBtn} onClick={() => openTheaterModal(surg)}>
                          ⚡ Open Theater Monitor
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Surgery Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Schedule Surgical Procedure">
        <form onSubmit={handleCreateSurgery}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Patient</label>
            <select
              className={styles.select}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
            >
              <option value="">-- Select Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.species} - Owner: {p.owner?.full_name || 'Client'})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Procedure Name</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Exploratory Laparotomy, Ovariohysterectomy, Fracture Repair"
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Lead Veterinary Surgeon</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Dr. Full Name"
                value={surgeonName}
                onChange={(e) => setSurgeonName(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Theater Room</label>
              <select
                className={styles.select}
                value={theaterRoom}
                onChange={(e) => setTheaterRoom(e.target.value)}
              >
                <option value="OR-1 Main Sterile Suite">OR-1 Main Sterile Suite</option>
                <option value="OR-2 Soft Tissue Theater">OR-2 Soft Tissue Theater</option>
                <option value="OR-3 Dental / Minor Op Suite">OR-3 Dental / Minor Op Suite</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Anesthetic Regimen & Premedication</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Dexmedetomidine + Butorphanol -> Propofol -> Isoflurane"
              value={anesthesiaProtocol}
              onChange={(e) => setAnesthesiaProtocol(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Date & Scheduled Induction Time</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className={styles.tabBtn} onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submittingSurgery}>
              {submittingSurgery ? 'Scheduling...' : 'Confirm Surgical Booking'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Theater Anesthesia & Checklist Monitor Modal */}
      {selectedSurgery && (
        <Modal
          isOpen={!!selectedSurgery}
          onClose={() => setSelectedSurgery(null)}
          title={`Theater Monitor: ${selectedSurgery.procedure_name} (${selectedSurgery.surgery_number})`}
        >
          <div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div><strong>Lead Surgeon:</strong> {selectedSurgery.surgeon_name}</div>
              <div><strong>Operating Suite:</strong> {selectedSurgery.theater_room}</div>
              <div><strong>Anesthesia:</strong> {selectedSurgery.anesthesia_protocol}</div>
              <div><strong>Current Stage:</strong> <span style={{ fontWeight: 700, color: 'var(--color-navy)' }}>{selectedSurgery.status.toUpperCase()}</span></div>
            </div>

            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Pre-Operative Safety Verification</h4>
            <div className={styles.checklistGrid}>
              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={checklist.fastingVerified}
                  onChange={(e) => setChecklist({ ...checklist, fastingVerified: e.target.checked })}
                />
                <span>Fasting Confirmed (12h food / 2h water)</span>
              </label>

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={checklist.bloodworkCleared}
                  onChange={(e) => setChecklist({ ...checklist, bloodworkCleared: e.target.checked })}
                />
                <span>Pre-Op Lab Work Cleared</span>
              </label>

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={checklist.consentSigned}
                  onChange={(e) => setChecklist({ ...checklist, consentSigned: e.target.checked })}
                />
                <span>Surgical & Anesthetic Consent Signed</span>
              </label>

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={checklist.ivCatheterPatent}
                  onChange={(e) => setChecklist({ ...checklist, ivCatheterPatent: e.target.checked })}
                />
                <span>IV Catheter Placed & Patent</span>
              </label>

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={checklist.premedAdministered}
                  onChange={(e) => setChecklist({ ...checklist, premedAdministered: e.target.checked })}
                />
                <span>Premedication Administered</span>
              </label>

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={checklist.etTubeChecked}
                  onChange={(e) => setChecklist({ ...checklist, etTubeChecked: e.target.checked })}
                />
                <span>Endotracheal Tube Sized & Tested</span>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Intra-Operative Notes & Anesthesia Depth Observations</label>
              <textarea
                className={styles.textarea}
                placeholder="Isoflurane %, SpO2 98%, EtCO2 38mmHg, blood loss minimal, suture closure pattern..."
                value={theaterNotes}
                onChange={(e) => setTheaterNotes(e.target.value)}
              />
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Update Procedure Lifecycle:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  style={{ background: '#fef3c7', color: '#92400e', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => handleUpdateStatus('pre_op')}
                >
                  Move to Pre-Op
                </button>
                <button
                  type="button"
                  style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => handleUpdateStatus('in_surgery')}
                >
                  🔴 Start Surgery
                </button>
                <button
                  type="button"
                  style={{ background: '#ede9fe', color: '#6d28d9', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => handleUpdateStatus('recovery')}
                >
                  Move to Recovery
                </button>
                <button
                  type="button"
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => handleUpdateStatus('completed')}
                >
                  ✅ Mark Completed
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
