'use client';

import { useAuth } from '@/lib/auth-context';
import Topbar from '@/components/layout/Topbar';
import styles from './clinic.module.css';

function fmt(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statTop}>
        <div className={styles.statInfo}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue}>{value}</span>
        </div>
        <div
          className={styles.statIcon}
          style={{ background: color || 'var(--color-ocean)' }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function TodayAppointments() {
  const appointments = [
    { time: '09:00', patient: 'Max (Golden Retriever)', reason: 'Annual vaccination', status: 'completed' as const },
    { time: '10:30', patient: 'Luna (Siamese Cat)', reason: 'Spay surgery follow-up', status: 'completed' as const },
    { time: '11:45', patient: 'Rex (German Shepherd)', reason: 'Lameness assessment', status: 'scheduled' as const },
    { time: '13:00', patient: 'Bella (Pomeranian)', reason: 'Dental cleaning', status: 'scheduled' as const },
    { time: '14:30', patient: 'Oscar (Parrot)', reason: 'Wing trim & checkup', status: 'scheduled' as const },
  ];

  return (
    <div className={styles.appointmentList}>
      {appointments.map((apt, i) => (
        <div key={i} className={styles.appointmentItem}>
          <span className={styles.appointmentTime}>{apt.time}</span>
          <div className={styles.appointmentInfo}>
            <span className={styles.appointmentName}>{apt.patient}</span>
            <span className={styles.appointmentReason}>{apt.reason}</span>
          </div>
          <span
            className={`${styles.statusBadge} ${
              apt.status === 'completed' ? styles.statusCompleted : styles.statusScheduled
            }`}
          >
            {apt.status}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ClinicPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      <Topbar title="Clinic Dashboard" />
      <div className={styles.page}>
        <div className={styles.greeting}>
          <h2 className={styles.greetingText}>
            Welcome to Albion Pet Clinic 🐾
          </h2>
          <p className={styles.greetingSub}>
            Manage patient records, appointments, treatments, and queue all in one place.
          </p>
        </div>

        <div className={styles.statsGrid}>
          <StatCard label="Total Patients" value="847" icon="🐾" color="var(--color-info-light)" />
          <StatCard label="Today's Appointments" value="12" icon="📅" color="var(--color-gold-tint)" />
          <StatCard label="Queue Waiting" value="4" icon="🚶" color="var(--color-warning-light)" />
          <StatCard label="Active Treatments" value="18" icon="💉" color="var(--color-success-light)" />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Quick Links</h3>
          <div className={styles.actionGrid}>
            <a href="/clinic/patients" className={styles.actionCard}>
              <span className={styles.actionIcon}>🐾</span>
              <span className={styles.actionLabel}>Patients</span>
            </a>
            <a href="/clinic/appointments" className={styles.actionCard}>
              <span className={styles.actionIcon}>📅</span>
              <span className={styles.actionLabel}>Appointments</span>
            </a>
            <a href="/clinic/treatments" className={styles.actionCard}>
              <span className={styles.actionIcon}>💉</span>
              <span className={styles.actionLabel}>Treatments</span>
            </a>
            <a href="/clinic/queue" className={styles.actionCard}>
              <span className={styles.actionIcon}>🚶</span>
              <span className={styles.actionLabel}>Queue</span>
            </a>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Today&apos;s Appointments</h3>
          <TodayAppointments />
        </div>
      </div>
    </>
  );
}
