'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useHospitalizations, useClinicPatients } from '@/hooks/use-supabase-data';
import { admitToHospital, addICUVital, dischargeHospitalization } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import type { HospitalizationRecord, WardType, HospitalizationStatus } from '@/lib/types';
import styles from './icu.module.css';

export default function ICUBoardPage() {
  const { hospitalizations, refetch } = useHospitalizations();
  const { patients } = useClinicPatients();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Admit Modal
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [wardType, setWardType] = useState<WardType>('icu');
  const [cageNumber, setCageNumber] = useState('');
  const [admittingDiagnosis, setAdmittingDiagnosis] = useState('');
  const [fluidRateMlHr, setFluidRateMlHr] = useState<number>(0);
  const [careInstructions, setCareInstructions] = useState('');
  const [submittingAdmit, setSubmittingAdmit] = useState(false);

  // Vitals Entry Modal
  const [selectedHospForVitals, setSelectedHospForVitals] = useState<HospitalizationRecord | null>(null);
  const [tempC, setTempC] = useState<number>(38.5);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(110);
  const [respRateBpm, setRespRateBpm] = useState<number>(24);
  const [crtSec, setCrtSec] = useState<number>(1.5);
  const [mm, setMm] = useState('Pink / Moist');
  const [painScore, setPainScore] = useState<number>(1);
  const [mentalStatus, setMentalStatus] = useState<'BAR' | 'QAR' | 'depressed' | 'obtunded' | 'comatose'>('BAR');
  const [vitalNotes, setVitalNotes] = useState('');
  const [submittingVital, setSubmittingVital] = useState(false);

  // Discharge Modal
  const [selectedHospForDischarge, setSelectedHospForDischarge] = useState<HospitalizationRecord | null>(null);
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [submittingDischarge, setSubmittingDischarge] = useState(false);

  const stats = useMemo(() => {
    const active = hospitalizations.filter((h) => h.status !== 'discharged');
    const critical = hospitalizations.filter((h) => h.status === 'critical').length;
    const stable = hospitalizations.filter((h) => h.status === 'stable').length;
    const icuCount = hospitalizations.filter((h) => h.ward_type === 'icu' && h.status !== 'discharged').length;
    return { active: active.length, critical, stable, icuCount };
  }, [hospitalizations]);

  const filteredHospitalizations = useMemo(() => {
    return hospitalizations.filter((item) => {
      const matchesWard = wardFilter === 'all' || item.ward_type === wardFilter;
      const patient = patients.find((p) => p.id === item.patient_id);
      const patientName = patient?.name || '';
      const q = search.toLowerCase();
      const matchesSearch =
        item.cage_number.toLowerCase().includes(q) ||
        (item.admitting_diagnosis || item.reason_for_admission || '').toLowerCase().includes(q) ||
        patientName.toLowerCase().includes(q);
      return matchesWard && matchesSearch;
    });
  }, [hospitalizations, wardFilter, search, patients]);

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !cageNumber) {
      setToast({ message: 'Patient and cage number are required', type: 'error' });
      return;
    }
    setSubmittingAdmit(true);
    try {
      const res = await admitToHospital({
        patient_id: patientId,
        ward_type: wardType,
        cage_number: cageNumber.trim(),
        admitting_diagnosis: admittingDiagnosis.trim(),
        status: 'admitted',
        fluid_rate_ml_hr: fluidRateMlHr > 0 ? fluidRateMlHr : undefined,
        special_instructions: careInstructions.trim() || undefined,
        location_id: user?.location_id,
      });

      if (res.success) {
        setToast({ message: 'Patient admitted to inpatient ward', type: 'success' });
        setShowAdmitModal(false);
        setPatientId('');
        setCageNumber('');
        setAdmittingDiagnosis('');
        setCareInstructions('');
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to admit patient', type: 'error' });
      }
    } catch {
      setToast({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmittingAdmit(false);
    }
  };

  const handleAddVitalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospForVitals) return;
    setSubmittingVital(true);
    try {
      const res = await addICUVital(selectedHospForVitals.id, {
        temperature_c: tempC,
        heart_rate_bpm: heartRateBpm,
        respiratory_rate_bpm: respRateBpm,
        capillary_refill_sec: crtSec,
        mucous_membranes: mm,
        pain_score: painScore,
        mental_status: mentalStatus,
        notes: vitalNotes.trim() || undefined,
        logged_by: user?.full_name || user?.email || 'Clinical Staff',
      });

      if (res.success) {
        setToast({ message: 'Vitals logged successfully', type: 'success' });
        setSelectedHospForVitals(null);
        setVitalNotes('');
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to record vitals', type: 'error' });
      }
    } catch {
      setToast({ message: 'Error recording vitals', type: 'error' });
    } finally {
      setSubmittingVital(false);
    }
  };

  const handleDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospForDischarge) return;
    setSubmittingDischarge(true);
    try {
      const res = await dischargeHospitalization(selectedHospForDischarge.id, dischargeSummary.trim());
      if (res.success) {
        setToast({ message: 'Patient discharged successfully', type: 'success' });
        setSelectedHospForDischarge(null);
        setDischargeSummary('');
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to discharge patient', type: 'error' });
      }
    } catch {
      setToast({ message: 'Error during discharge', type: 'error' });
    } finally {
      setSubmittingDischarge(false);
    }
  };

  return (
    <div className={styles.page}>
      <Topbar title="ICU & Hospitalization Board" />

      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>🛏️ Inpatient Hospitalization & ICU Board</h1>
        <p className={styles.greetingSub}>
          Real-time cage occupancy, serial vitals flowcharts, fluid infusion tracking, and critical patient telemetry
        </p>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Active Occupancy</span>
              <span className={styles.statValue}>{stats.active}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#3b82f6' }}>🏥</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>🔴 ICU Critical Watch</span>
              <span className={styles.statValue}>{stats.critical}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#ef4444' }}>⚡</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Stable Inpatients</span>
              <span className={styles.statValue}>{stats.stable}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#10b981' }}>🩺</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>ICU Unit Cages</span>
              <span className={styles.statValue}>{stats.icuCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#8b5cf6' }}>🛏️</div>
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div className={styles.searchBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search cage, patient, or diagnosis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className={styles.primaryBtn} onClick={() => setShowAdmitModal(true)}>
            + Admit Patient to Ward
          </button>
        </div>

        {/* Ward filter tabs */}
        <div className={styles.tabs}>
          {['all', 'icu', 'general_ward', 'isolation', 'post_op', 'quarantine'].map((w) => (
            <button
              key={w}
              className={`${styles.tabBtn} ${wardFilter === w ? styles.tabActive : ''}`}
              onClick={() => setWardFilter(w)}
            >
              {w === 'all' ? 'All Wards' : w.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Cage Grid View */}
        <div className={styles.cageGrid}>
          {filteredHospitalizations.length === 0 ? (
            <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
              No inpatients found in this ward selection.
            </div>
          ) : (
            filteredHospitalizations.map((hosp) => {
              const patient = patients.find((p) => p.id === hosp.patient_id);
              const latestVital = hosp.vitals && hosp.vitals.length > 0 ? hosp.vitals[hosp.vitals.length - 1] : null;

              return (
                <div key={hosp.id} className={styles.cageCard}>
                  <div>
                    <div className={styles.cageHeader}>
                      <div>
                        <span className={styles.cageTag}>{(hosp.ward_type || hosp.ward || 'icu').toUpperCase()} • CAGE {hosp.cage_number}</span>
                        <h3 style={{ margin: '6px 0 2px 0', fontSize: '16px', color: 'var(--color-navy)' }}>
                          {patient?.name || 'Inpatient Patient'}
                        </h3>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {patient?.species} ({patient?.breed || 'Mixed'}) • {patient?.weight_kg || '—'} kg
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background:
                            hosp.status === 'critical'
                              ? '#fee2e2'
                              : hosp.status === 'stable'
                              ? '#dcfce7'
                              : hosp.status === 'discharged'
                              ? '#f1f5f9'
                              : '#fef3c7',
                          color:
                            hosp.status === 'critical'
                              ? '#991b1b'
                              : hosp.status === 'stable'
                              ? '#166534'
                              : hosp.status === 'discharged'
                              ? '#64748b'
                              : '#92400e',
                        }}
                      >
                        {hosp.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                      <strong>Diagnosis:</strong> {hosp.admitting_diagnosis}
                    </div>

                    {hosp.fluid_rate_ml_hr && hosp.fluid_rate_ml_hr > 0 && (
                      <div style={{ fontSize: '12px', color: '#0284c7', marginBottom: '8px', fontWeight: 600 }}>
                        💧 Fluid Infusion Rate: {hosp.fluid_rate_ml_hr} mL/hr
                      </div>
                    )}

                    {/* Latest Vitals Snapshot */}
                    <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                        LATEST VITALS {latestVital ? `(${new Date(latestVital.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : '— NOT LOGGED'}
                      </div>
                      {latestVital ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          <span className={styles.vitalChip}>🌡️ {latestVital.temperature_c}°C</span>
                          <span className={styles.vitalChip}>💓 {latestVital.heart_rate_bpm} bpm</span>
                          <span className={styles.vitalChip}>🫁 {latestVital.respiratory_rate_bpm} rpm</span>
                          <span className={styles.vitalChip}>⏱️ CRT {latestVital.capillary_refill_sec}s</span>
                          <span className={styles.vitalChip}>🧠 {latestVital.mental_status}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Serial vitals check pending</div>
                      )}
                    </div>
                  </div>

                  {hosp.status !== 'discharged' && (
                    <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: 'white',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedHospForVitals(hosp)}
                      >
                        + Log Vitals
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: 'none',
                          background: '#10b981',
                          color: 'white',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedHospForDischarge(hosp)}
                      >
                        Discharge
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Admit Patient Modal */}
      <Modal isOpen={showAdmitModal} onClose={() => setShowAdmitModal(false)} title="Admit Patient to Ward / ICU">
        <form onSubmit={handleAdmitSubmit}>
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
                  {p.name} ({p.species} - Owner: {p.owner?.full_name || 'Clinic'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Ward Classification</label>
              <select
                className={styles.select}
                value={wardType}
                onChange={(e) => setWardType(e.target.value as WardType)}
              >
                <option value="icu">ICU Critical Unit</option>
                <option value="general_ward">General Inpatient Ward</option>
                <option value="isolation">Infectious Disease Isolation</option>
                <option value="post_op">Post-Operative Recovery</option>
                <option value="quarantine">Biosecurity Quarantine</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Cage / Kennel #</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. ICU-01, GW-04"
                value={cageNumber}
                onChange={(e) => setCageNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Admitting Diagnosis</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Acute Hemorrhagic Diarrhea Syndrome, Polytrauma"
              value={admittingDiagnosis}
              onChange={(e) => setAdmittingDiagnosis(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>IV Fluid Rate (mL/hr)</label>
            <input
              type="number"
              className={styles.input}
              placeholder="e.g. 45"
              value={fluidRateMlHr || ''}
              onChange={(e) => setFluidRateMlHr(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Nursing & Special Care Instructions</label>
            <textarea
              className={styles.textarea}
              placeholder="e.g. Q4H vitals, recumbency turns Q2H, monitor urine output..."
              value={careInstructions}
              onChange={(e) => setCareInstructions(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className={styles.tabBtn} onClick={() => setShowAdmitModal(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submittingAdmit}>
              {submittingAdmit ? 'Admitting...' : 'Confirm Admission'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Vitals Modal */}
      {selectedHospForVitals && (
        <Modal
          isOpen={!!selectedHospForVitals}
          onClose={() => setSelectedHospForVitals(null)}
          title={`Serial Vitals: Cage ${selectedHospForVitals.cage_number}`}
        >
          <form onSubmit={handleAddVitalsSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className={styles.input}
                  value={tempC}
                  onChange={(e) => setTempC(parseFloat(e.target.value))}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Heart Rate (BPM)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(parseInt(e.target.value, 10))}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Respiratory Rate (RPM)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={respRateBpm}
                  onChange={(e) => setRespRateBpm(parseInt(e.target.value, 10))}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>CRT (Seconds)</label>
                <input
                  type="number"
                  step="0.5"
                  className={styles.input}
                  value={crtSec}
                  onChange={(e) => setCrtSec(parseFloat(e.target.value))}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Mucous Membranes</label>
                <select className={styles.select} value={mm} onChange={(e) => setMm(e.target.value)}>
                  <option value="Pink / Moist">Pink / Moist (Normal)</option>
                  <option value="Pale">Pale</option>
                  <option value="Cyanotic">Cyanotic / Blue</option>
                  <option value="Icteric / Jaundiced">Icteric / Jaundiced</option>
                  <option value="Injected / Hyperemic">Injected / Hyperemic</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Pain Score (0 - 4)</label>
                <select
                  className={styles.select}
                  value={painScore}
                  onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                >
                  <option value={0}>0 - Comfortable / No pain</option>
                  <option value={1}>1 - Mild tenderness</option>
                  <option value={2}>2 - Moderate discomfort</option>
                  <option value={3}>3 - Severe guarding</option>
                  <option value={4}>4 - Agonizing / Vocalizing</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Mental Demeanor</label>
              <select
                className={styles.select}
                value={mentalStatus}
                onChange={(e) => setMentalStatus(e.target.value as any)}
              >
                <option value="BAR">BAR - Bright, Alert, Responsive</option>
                <option value="QAR">QAR - Quiet, Alert, Responsive</option>
                <option value="depressed">Depressed / Lethargic</option>
                <option value="obtunded">Obtunded / Semi-conscious</option>
                <option value="comatose">Comatose</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nursing Observations</label>
              <textarea
                className={styles.textarea}
                placeholder="Notes on defecation, urination, appetite, surgical wound status..."
                value={vitalNotes}
                onChange={(e) => setVitalNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className={styles.tabBtn} onClick={() => setSelectedHospForVitals(null)}>
                Cancel
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={submittingVital}>
                {submittingVital ? 'Logging...' : 'Save Vitals Entry'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Discharge Modal */}
      {selectedHospForDischarge && (
        <Modal
          isOpen={!!selectedHospForDischarge}
          onClose={() => setSelectedHospForDischarge(null)}
          title="Discharge Inpatient"
        >
          <form onSubmit={handleDischargeSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Clinical Discharge Summary & Take-Home Protocol</label>
              <textarea
                className={styles.textarea}
                placeholder="Condition on discharge, home medications, wound care, and follow-up appointment date..."
                value={dischargeSummary}
                onChange={(e) => setDischargeSummary(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className={styles.tabBtn} onClick={() => setSelectedHospForDischarge(null)}>
                Cancel
              </button>
              <button
                type="submit"
                style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                disabled={submittingDischarge}
              >
                {submittingDischarge ? 'Discharging...' : 'Confirm Discharge'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
