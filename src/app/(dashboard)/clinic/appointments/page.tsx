'use client';

import { useState, useMemo, type FormEvent, type ChangeEvent } from 'react';
import Topbar from '@/components/layout/Topbar';
import { useAuth } from '@/lib/auth-context';
import {
  useClinicAppointments,
  useClinicPatients,
} from '@/hooks/use-supabase-data';
import { addAppointment } from '@/lib/data-service';
import styles from './appointments.module.css';

const SPECIES_ICONS: Record<string, string> = {
  Dog: '🐕',
  Cat: '🐱',
  Bird: '🐦',
  Rabbit: '🐰',
  Fish: '🐟',
  Reptile: '🦎',
  Horse: '🐴',
  Goat: '🐐',
  Sheep: '🐑',
  Cattle: '🐄',
  Poultry: '🐔',
};

function speciesIcon(species: string): string {
  return SPECIES_ICONS[species] || '🐾';
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    scheduled: styles.statusScheduled,
    checked_in: styles.statusCheckedIn,
    in_progress: styles.statusInProgress,
    completed: styles.statusCompleted,
    cancelled: styles.statusCancelled,
    no_show: styles.statusNoShow,
  };
  return map[status] || '';
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface FormState {
  patient_id: string;
  procedure_type: string;
  date: string;
  time: string;
  reason: string;
}

const INITIAL_FORM: FormState = {
  patient_id: '',
  procedure_type: '',
  date: '',
  time: '',
  reason: '',
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { appointments, loading: apptsLoading } = useClinicAppointments();
  const { patients, loading: patientsLoading } = useClinicPatients();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loading = apptsLoading || patientsLoading;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof appointments>();
    const sorted = [...appointments].sort(
      (a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime()
    );
    for (const appt of sorted) {
      const key = appt.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()
    );
  }, [appointments]);

  const openModal = () => {
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.patient_id) return;
    if (!form.date) return;
    if (!form.time) return;

    const patient = patients.find((p) => p.id === form.patient_id);
    if (!patient) return;

    setIsSubmitting(true);
    const result = await addAppointment({
      patient_id: form.patient_id,
      owner_id: patient.owner_id,
      procedure_type: form.procedure_type || undefined,
      date: form.date,
      time: form.time,
      reason: form.reason || undefined,
    });
    if (result.success) {
      closeModal();
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <Topbar title="Appointments" />

      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Appointments</h1>
            <p className={styles.todayDate}>{formatToday()}</p>
          </div>
          <button className={styles.addBtn} onClick={openModal}>
            <span>＋</span>
            New Appointment
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Loading appointments…</div>
        ) : grouped.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <div className={styles.emptyText}>No appointments found</div>
          </div>
        ) : (
          grouped.map(([date, appts]) => (
            <div key={date} className={styles.dateGroup}>
              <span className={styles.dateLabel}>{formatDateLabel(date)}</span>
              {appts.map((appt) => (
                <div key={appt.id} className={styles.appointmentCard}>
                  <div className={styles.appointmentTime}>{appt.time.slice(0, 5)}</div>
                  <div className={styles.appointmentInfo}>
                    <div className={styles.patientName}>
                      {speciesIcon(appt.patient?.species)} {appt.patient?.name || 'Unknown'}
                    </div>
                    <div className={styles.patientSpecies}>
                      {appt.patient?.species || 'Unknown'} · Owner: {appt.owner?.full_name || 'N/A'}
                    </div>
                    {appt.reason && (
                      <div className={styles.appointmentReason}>{appt.reason}</div>
                    )}
                  </div>
                  <span className={`${styles.statusBadge} ${statusClass(appt.status)}`}>
                    {appt.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>New Appointment</h2>
              <button className={styles.modalCloseBtn} onClick={closeModal} type="button">
                ✕
              </button>
            </div>
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="patient-id">Patient</label>
                <select
                  id="patient-id"
                  name="patient_id"
                  className={styles.formSelect}
                  value={form.patient_id}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>— Select Patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {speciesIcon(p.species)} {p.name} ({p.species})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="procedure-type">Procedure Type</label>
                <input
                  id="procedure-type"
                  type="text"
                  name="procedure_type"
                  className={styles.formInput}
                  placeholder="e.g. Vaccination, Check-up, Surgery"
                  value={form.procedure_type}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="appt-date">Date</label>
                <input
                  id="appt-date"
                  type="date"
                  name="date"
                  className={styles.formInput}
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="appt-time">Time</label>
                <input
                  id="appt-time"
                  type="time"
                  name="time"
                  className={styles.formInput}
                  value={form.time}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="appt-reason">Reason</label>
                <input
                  id="appt-reason"
                  type="text"
                  name="reason"
                  className={styles.formInput}
                  placeholder="Reason for visit"
                  value={form.reason}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving…' : '＋ Create Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
