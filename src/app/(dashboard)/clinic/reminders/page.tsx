'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import styles from './reminders.module.css';
import { usePatientReminders, useClinicPatients } from '@/hooks/use-supabase-data';
import { createPatientReminder, updatePatientReminderStatus } from '@/lib/data-service';
import { PatientReminder, ReminderType, ReminderStatus } from '@/lib/types';

export default function PatientRemindersPage() {
  const { reminders, loading, refetch } = usePatientReminders();
  const { patients } = useClinicPatients();

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formPatientId, setFormPatientId] = useState('');
  const [formType, setFormType] = useState<ReminderType>('vaccination');
  const [formTitle, setFormTitle] = useState('');
  const [formDueDate, setFormDueDate] = useState(() =>
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formNotes, setFormNotes] = useState('');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const inSevenDaysStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Auto populate title when reminder type changes
  const handleTypeChange = (type: ReminderType) => {
    setFormType(type);
    if (!formTitle || formTitle.includes('Recall') || formTitle.includes('Check') || formTitle.includes('Vaccine')) {
      switch (type) {
        case 'vaccination':
          setFormTitle('Annual DHPPi / Rabies Booster');
          break;
        case 'deworming':
          setFormTitle('Quarterly Broad-Spectrum Deworming');
          break;
        case 'suture_removal':
          setFormTitle('Post-Op Suture Removal & Wound Inspection');
          break;
        case 'medication_refill':
          setFormTitle('Chronic Medication Refill Check');
          break;
        case 'wellness_check':
          setFormTitle('Bi-annual Senior Pet Wellness Checkup');
          break;
      }
    }
  };

  // Filtered Reminders
  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      const matchType = selectedType === 'all' || r.reminder_type === selectedType;
      const matchStatus = selectedStatus === 'all' || r.status === selectedStatus;
      const matchSearch =
        !searchTerm ||
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.patient_name && r.patient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.owner_name && r.owner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.owner_phone && r.owner_phone.includes(searchTerm));
      return matchType && matchStatus && matchSearch;
    });
  }, [reminders, selectedType, selectedStatus, searchTerm]);

  // KPIs
  const overdueCount = useMemo(() => {
    return reminders.filter((r) => r.status !== 'completed' && r.status !== 'cancelled' && r.due_date < todayStr).length;
  }, [reminders, todayStr]);

  const dueSoonCount = useMemo(() => {
    return reminders.filter(
      (r) => r.status !== 'completed' && r.status !== 'cancelled' && r.due_date >= todayStr && r.due_date <= inSevenDaysStr
    ).length;
  }, [reminders, todayStr, inSevenDaysStr]);

  const activeCount = useMemo(() => {
    return reminders.filter((r) => r.status === 'pending' || r.status === 'sent').length;
  }, [reminders]);

  const completedCount = useMemo(() => {
    return reminders.filter((r) => r.status === 'completed').length;
  }, [reminders]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPatientId || !formTitle || !formDueDate) return;

    setSubmitting(true);
    const pet = patients.find((p) => p.id === formPatientId);

    const res = await createPatientReminder({
      patient_id: formPatientId,
      patient_name: pet?.name || 'Pet',
      owner_id: pet?.owner_id,
      owner_name: pet?.owner?.full_name || undefined,
      owner_phone: pet?.owner?.phone || undefined,
      species: pet?.species,
      reminder_type: formType,
      title: formTitle,
      due_date: formDueDate,
      notes: formNotes,
    });

    setSubmitting(false);
    if (res.success) {
      setShowModal(false);
      setFormPatientId('');
      setFormTitle('');
      setFormNotes('');
      await refetch();
    } else {
      alert(res.error || 'Failed to schedule recall reminder');
    }
  };

  const handleUpdateStatus = async (id: string, status: ReminderStatus) => {
    await updatePatientReminderStatus(id, status);
    await refetch();
  };

  const exportCSV = () => {
    const headers = ['Due Date', 'Patient', 'Species', 'Owner', 'Phone', 'Type', 'Title', 'Status', 'Notes'];
    const rows = filteredReminders.map((r) => [
      r.due_date,
      r.patient_name || '',
      r.species || '',
      r.owner_name || '',
      r.owner_phone || '',
      r.reminder_type,
      `"${r.title.replace(/"/g, '""')}"`,
      r.status,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `patient_recalls_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadgeClass = (type: ReminderType) => {
    switch (type) {
      case 'vaccination':
        return styles.typeVaccination;
      case 'deworming':
        return styles.typeDeworming;
      case 'suture_removal':
        return styles.typeSuture;
      case 'medication_refill':
        return styles.typeRefill;
      case 'wellness_check':
        return styles.typeWellness;
      default:
        return '';
    }
  };

  const getStatusBadgeClass = (status: ReminderStatus) => {
    switch (status) {
      case 'pending':
        return styles.statusPending;
      case 'sent':
        return styles.statusSent;
      case 'completed':
        return styles.statusCompleted;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return '';
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>Preventive Care & Patient Recalls</h1>
        <p className={styles.greetingSub}>
          Automated booster schedules, post-surgical suture removal tracking, deworming cycles, and client re-engagement.
        </p>
      </div>

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Active Recalls</span>
              <span className={styles.statValue}>{activeCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #0a2540, #146eb4)' }}>
              🔔
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Overdue Follow-ups</span>
              <span className={styles.statValue} style={{ color: '#dc2626' }}>{overdueCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}>
              ⚠️
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Due This Week</span>
              <span className={styles.statValue} style={{ color: '#d97706' }}>{dueSoonCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
              ⏳
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Completed Recalls</span>
              <span className={styles.statValue} style={{ color: '#16a34a' }}>{completedCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
              ✅
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className={styles.actionsBar}>
        <div className={styles.filters}>
          {(['all', 'vaccination', 'deworming', 'suture_removal', 'medication_refill', 'wellness_check'] as const).map(
            (type) => (
              <button
                key={type}
                className={`${styles.filterBtn} ${selectedType === type ? styles.filterBtnActive : ''}`}
                onClick={() => setSelectedType(type)}
              >
                {type === 'all' ? 'All Types' : type.replace('_', ' ').toUpperCase()}
              </button>
            )
          )}
        </div>

        <div className={styles.searchWrap}>
          <select
            className={styles.selectInput}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Notice</option>
            <option value="sent">Notice Sent / Contacted</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            type="text"
            placeholder="Search pet, owner, or title..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button className={styles.exportBtn} onClick={exportCSV}>
            📥 Export CSV
          </button>

          <button className={styles.addBtn} onClick={() => { setShowModal(true); handleTypeChange('vaccination'); }}>
            + Schedule Recall
          </button>
        </div>
      </div>

      {/* Recalls Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Patient</th>
                <th>Owner & Contact</th>
                <th>Recall Category</th>
                <th>Protocol Title</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading preventive care & recall schedule...
                  </td>
                </tr>
              ) : filteredReminders.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    No recalls found matching your filter criteria. Click &quot;+ Schedule Recall&quot; to set up preventive reminders.
                  </td>
                </tr>
              ) : (
                filteredReminders.map((reminder: PatientReminder) => {
                  const isOverdue =
                    reminder.status !== 'completed' &&
                    reminder.status !== 'cancelled' &&
                    reminder.due_date < todayStr;
                  const isDueSoon =
                    reminder.status !== 'completed' &&
                    reminder.status !== 'cancelled' &&
                    reminder.due_date >= todayStr &&
                    reminder.due_date <= inSevenDaysStr;

                  return (
                    <tr key={reminder.id}>
                      <td
                        className={
                          isOverdue ? styles.dateUrgent : isDueSoon ? styles.dateUpcoming : styles.dateNormal
                        }
                      >
                        {isOverdue && '⚠️ '}
                        {new Date(reminder.due_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <div className={styles.patientCell}>
                          <div className={styles.patientAvatar}>
                            {reminder.species === 'Cat' ? '🐱' : reminder.species === 'Bird' ? '🦜' : '🐶'}
                          </div>
                          <div>
                            <div className={styles.patientName}>{reminder.patient_name}</div>
                            <div className={styles.patientMeta}>{reminder.species || 'Canine'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.ownerCell}>
                          <span className={styles.ownerName}>{reminder.owner_name || 'Pet Parent'}</span>
                          {reminder.owner_phone && (
                            <a href={`tel:${reminder.owner_phone}`} className={styles.ownerPhone}>
                              📞 {reminder.owner_phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.typeBadge} ${getTypeBadgeClass(reminder.reminder_type)}`}>
                          {reminder.reminder_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <strong>{reminder.title}</strong>
                        {reminder.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {reminder.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(reminder.status)}`}>
                          {reminder.status}
                        </span>
                        {reminder.last_notified_at && (
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Notified {new Date(reminder.last_notified_at).toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionBtnGroup}>
                          {reminder.status === 'pending' && (
                            <button
                              className={styles.actionBtnSmall}
                              onClick={() => handleUpdateStatus(reminder.id, 'sent')}
                              title="Mark Client Contacted"
                            >
                              📞 Log Sent
                            </button>
                          )}
                          {reminder.status !== 'completed' && reminder.status !== 'cancelled' && (
                            <button
                              className={`${styles.actionBtnSmall} ${styles.actionBtnSuccess}`}
                              onClick={() => handleUpdateStatus(reminder.id, 'completed')}
                              title="Mark as Completed"
                            >
                              ✅ Complete
                            </button>
                          )}
                          <Link
                            href={`/clinic/appointments?patientId=${reminder.patient_id}`}
                            className={styles.actionBtnSmall}
                            title="Book Appointment"
                          >
                            📅 Book
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Recall Modal */}
      {showModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Schedule Preventive Care Recall</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Select Patient</label>
                  <select
                    value={formPatientId}
                    onChange={(e) => setFormPatientId(e.target.value)}
                    required
                  >
                    <option value="">Choose registered pet...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.species}) — Owner: {p.owner?.full_name || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Recall Category</label>
                    <select
                      value={formType}
                      onChange={(e) => handleTypeChange(e.target.value as ReminderType)}
                      required
                    >
                      <option value="vaccination">Vaccination Booster</option>
                      <option value="deworming">Deworming & Parasite Prevention</option>
                      <option value="suture_removal">Suture / Wound Inspection</option>
                      <option value="medication_refill">Medication Refill</option>
                      <option value="wellness_check">Annual / Senior Wellness Check</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Recall Protocol Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Annual Rabies Booster"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Clinical Notes / Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Inform owner to bring vaccination booklet. Fast pet 2 hours prior if booster requires blood panel."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Scheduling...' : 'Set Recall Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
