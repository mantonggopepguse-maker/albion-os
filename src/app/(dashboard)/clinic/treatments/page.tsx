'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useClinicTreatments, useClinicPatients } from '@/hooks/use-supabase-data';
import { createTreatment } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import type { TreatmentStatus } from '@/lib/types';
import styles from './treatments.module.css';

function fmtNgn(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

export default function ClinicTreatmentsPage() {
  const { treatments, loading, refetch } = useClinicTreatments();
  const { patients } = useClinicPatients();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'ongoing' | 'completed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [patientId, setPatientId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [cost, setCost] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // AI Copilot state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any | null>(null);

  const handleAiSuggest = async () => {
    if (!complaint.trim()) {
      setToast({ message: 'Please enter a chief complaint first to run AI diagnostic assistant.', type: 'error' });
      return;
    }
    setAiLoading(true);
    const selPatient = patients.find((p) => p.id === patientId);
    try {
      const res = await fetch('/api/ai/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: selPatient ? {
            name: selPatient.name,
            species: selPatient.species,
            breed: selPatient.breed,
            gender: selPatient.gender,
            weight_kg: selPatient.weight_kg,
          } : undefined,
          chief_complaint: complaint,
          clinical_notes: assessment,
        }),
      });
      if (!res.ok) throw new Error('AI analysis failed');
      const data = await res.json();
      setAiSuggestions(data);
      setToast({ message: `AI Copilot generated ${data.differential_diagnoses?.length || 0} differential diagnoses!`, type: 'success' });
    } catch {
      setToast({ message: 'Could not connect to AI diagnostic assistant.', type: 'error' });
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = (item: { diagnosis: string }) => {
    setDiagnosis(item.diagnosis);
    if (aiSuggestions?.suggested_assessment) {
      setAssessment(aiSuggestions.suggested_assessment);
    }
    if (aiSuggestions?.suggested_plan) {
      setPlan(aiSuggestions.suggested_plan);
    }
    setToast({ message: 'Applied AI differential diagnosis and SOAP plan!', type: 'success' });
  };

  // Selected treatment for detail modal
  const [viewTreatment, setViewTreatment] = useState<any | null>(null);

  const stats = useMemo(() => {
    const total = treatments.length;
    const ongoing = treatments.filter((t) => t.status === 'ongoing').length;
    const completed = treatments.filter((t) => t.status === 'completed').length;
    const totalRevenue = treatments.reduce((sum, t) => sum + (t.total_cost || 0), 0);
    return { total, ongoing, completed, totalRevenue };
  }, [treatments]);

  const filteredTreatments = useMemo(() => {
    return treatments.filter((t) => {
      const matchesTab = activeTab === 'all' || t.status === activeTab;
      const patientName = t.patient?.name || '';
      const diag = t.diagnosis || '';
      const comp = t.chief_complaint || '';
      const q = search.toLowerCase();
      const matchesSearch =
        patientName.toLowerCase().includes(q) ||
        diag.toLowerCase().includes(q) ||
        comp.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [treatments, activeTab, search]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !complaint.trim() || !diagnosis.trim()) {
      setToast({ message: 'Patient, Chief Complaint, and Diagnosis are required', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await createTreatment({
        patient_id: patientId,
        vet_id: user?.id,
        location_id: user?.location_id,
        chief_complaint: complaint.trim(),
        diagnosis: diagnosis.trim(),
        assessment: assessment.trim() || undefined,
        plan: plan.trim() || undefined,
        status: 'ongoing',
        total_cost: cost,
      });

      if (res.success) {
        setToast({ message: 'Treatment record created successfully', type: 'success' });
        setShowAddModal(false);
        setPatientId('');
        setComplaint('');
        setDiagnosis('');
        setAssessment('');
        setPlan('');
        setCost(0);
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to create treatment', type: 'error' });
      }
    } catch {
      setToast({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadgeClass = (s: TreatmentStatus) => {
    if (s === 'ongoing') return styles.badgeOngoing;
    if (s === 'completed') return styles.badgeCompleted;
    return styles.badgeReferred;
  };

  return (
    <>
      <Topbar title="Clinical Treatments & EHR" />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.page}>
        <div className={styles.greeting}>
          <h2 className={styles.greetingText}>Veterinary Medical Records</h2>
          <p className={styles.greetingSub}>
            Document consultations, clinical assessments, SOAP treatment plans, and prescribed medications.
          </p>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Total Treatments</span>
                <span className={styles.statValue}>{stats.total}</span>
              </div>
              <div className={styles.statIcon} style={{ background: '#0284c7' }}>
                🩺
              </div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Ongoing Cases</span>
                <span className={styles.statValue}>{stats.ongoing}</span>
              </div>
              <div className={styles.statIcon} style={{ background: '#d97706' }}>
                ⏳
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
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Treatment Billings</span>
                <span className={styles.statValue}>{fmtNgn(stats.totalRevenue)}</span>
              </div>
              <div className={styles.statIcon} style={{ background: '#8b5cf6' }}>
                💳
              </div>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Records ({stats.total})
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'ongoing' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('ongoing')}
              >
                Ongoing ({stats.ongoing})
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
                placeholder="Search patient, diagnosis, complaint..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Link
                href="/clinic/treatments/new"
                className={styles.primaryBtn}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                🩺 Dedicated Treatment Workflow
              </Link>
              <button
                className={styles.primaryBtn}
                onClick={() => setShowAddModal(true)}
                style={{ background: '#f1f5f9', color: 'var(--color-navy)', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}
              >
                + Quick Add
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Attending Vet</th>
                  <th>Chief Complaint</th>
                  <th>Diagnosis</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTreatments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      {loading ? 'Loading treatment history...' : 'No treatments recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredTreatments.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>
                        <strong>{t.patient?.name || 'Unknown'}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{t.patient?.species}</div>
                      </td>
                      <td>{t.vet?.full_name || 'Assigned Vet'}</td>
                      <td>{t.chief_complaint}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#093961' }}>{t.diagnosis}</span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${statusBadgeClass(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>{fmtNgn(t.total_cost || 0)}</td>
                      <td>
                        <button
                          onClick={() => setViewTreatment(t)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: 'white',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View Treatment Modal */}
        {viewTreatment && (
          <Modal title={`Medical Record — ${viewTreatment.patient?.name || 'Patient'}`} onClose={() => setViewTreatment(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Date:</span>
                  <div style={{ fontWeight: 600 }}>{viewTreatment.date}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Attending Clinician:</span>
                  <div style={{ fontWeight: 600 }}>{viewTreatment.vet?.full_name || 'Veterinarian'}</div>
                </div>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Chief Complaint:</span>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{viewTreatment.chief_complaint}</div>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Diagnosis:</span>
                <div style={{ fontWeight: 600, color: '#093961', marginTop: '2px' }}>{viewTreatment.diagnosis}</div>
              </div>

              {viewTreatment.assessment && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Clinical Assessment:</span>
                  <div style={{ marginTop: '2px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                    {viewTreatment.assessment}
                  </div>
                </div>
              )}

              {viewTreatment.plan && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Treatment Plan & Prescriptions:</span>
                  <div style={{ marginTop: '2px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                    {viewTreatment.plan}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Total Treatment Cost:</span>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#093961' }}>{fmtNgn(viewTreatment.total_cost || 0)}</div>
                </div>
                <button
                  onClick={() => setViewTreatment(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: '#093961', color: 'white', border: 'none', fontWeight: 600 }}
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* New Treatment Form Modal */}
        {showAddModal && (
          <Modal title="Record New Patient Treatment" onClose={() => setShowAddModal(false)}>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Patient *
                </label>
                <select
                  required
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Select Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.species}) — Owner: {p.owner?.full_name || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Chief Complaint *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lethargic, refusing food for 2 days, vomiting bile"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                    style={{
                      background: 'linear-gradient(135deg, #0a2540, #146eb4)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(10, 37, 64, 0.15)',
                    }}
                  >
                    {aiLoading ? 'Analyzing Clinical Signs...' : '✨ AI Copilot: Suggest Diagnosis & SOAP Plan'}
                  </button>
                </div>
              </div>

              {/* AI Copilot Suggestions Box */}
              {aiSuggestions && (
                <div
                  style={{
                    background: 'linear-gradient(145deg, #f0fdf4 0%, #eff6ff 100%)',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#093961', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🧠 AI Differential Diagnoses ({aiSuggestions.provider === 'gemini' ? 'Gemini 2.5 Flash' : 'Clinical Expert Engine'})
                    </strong>
                    <button
                      type="button"
                      onClick={() => setAiSuggestions(null)}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {aiSuggestions.differential_diagnoses?.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'white',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div>
                          <strong>{item.diagnosis}</strong>
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>
                            {item.confidence}% Match
                          </span>
                          {item.rationale && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {item.rationale}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => applyAiSuggestion(item)}
                          style={{
                            background: '#0a2540',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Apply SOAP
                        </button>
                      </div>
                    ))}
                  </div>

                  {aiSuggestions.recommended_tests?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}>
                      <strong>Recommended Lab Orders:</strong> {aiSuggestions.recommended_tests.join(', ')}
                    </div>
                  )}

                  {aiSuggestions.suggested_medications?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#334155' }}>
                      <strong>Suggested Medications:</strong> {aiSuggestions.suggested_medications.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Diagnosis *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parvoviral enteritis / Gastritis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Clinical Assessment
                </label>
                <textarea
                  rows={2}
                  placeholder="Clinical observations, vitals, temperature..."
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Treatment Plan & Medications
                </label>
                <textarea
                  rows={3}
                  placeholder="IV therapy, dosages, prescription instructions..."
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Estimated Treatment Fee (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
                  style={{ padding: '8px 20px', borderRadius: '8px', background: '#093961', color: 'white', border: 'none', fontWeight: 600 }}
                >
                  {submitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
}
