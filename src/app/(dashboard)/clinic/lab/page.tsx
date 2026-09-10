'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useLabOrders, useClinicPatients } from '@/hooks/use-supabase-data';
import { createLabOrder, updateLabOrderStatus } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import type { LabOrder, LabStatus, LabTestType, LabResultParameter } from '@/lib/types';
import styles from './lab.module.css';

export default function LabHubPage() {
  const { labOrders, refetch } = useLabOrders();
  const { patients } = useClinicPatients();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New Order Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [testType, setTestType] = useState<LabTestType>('complete_blood_count');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Result Entry / Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [resultsList, setResultsList] = useState<LabResultParameter[]>([]);
  const [pathologySummary, setPathologySummary] = useState('');
  const [newParam, setNewParam] = useState<LabResultParameter>({
    parameter: '',
    value: '',
    unit: '',
    reference_range: '',
    status: 'normal',
  });
  const [aiInterpreting, setAiInterpreting] = useState(false);

  const handleAiInterpret = async () => {
    if (!resultsList || resultsList.length === 0) {
      setToast({ message: 'Please add at least one assay parameter value before running AI interpretation.', type: 'error' });
      return;
    }
    setAiInterpreting(true);
    const pet = selectedOrder ? patients.find((p) => p.id === selectedOrder.patient_id) : undefined;
    try {
      const res = await fetch('/api/ai/lab-interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: pet ? {
            name: pet.name,
            species: pet.species,
            breed: pet.breed,
            gender: pet.gender,
          } : undefined,
          test_type: selectedOrder?.test_type || 'diagnostic_panel',
          clinical_notes: selectedOrder?.clinical_notes,
          parameters: resultsList.map((p) => ({
            parameter: p.parameter || (p as any).name || 'Param',
            value: p.value,
            unit: p.unit,
            reference_range: p.reference_range,
            status: p.status || (p as any).flag || 'normal',
          })),
        }),
      });
      if (!res.ok) throw new Error('Lab interpretation failed');
      const data = await res.json();
      const combined = `${data.pathology_summary}\n\nClinical Impression: ${data.clinical_impression}\n\nRecommended Actions:\n${data.recommended_actions?.map((a: string) => `• ${a}`).join('\n') || 'None'}`;
      setPathologySummary(combined);
      setToast({ message: `AI Clinical Pathology interpretation generated via ${data.provider === 'gemini' ? 'Gemini 2.5 Flash' : 'Expert Engine'}!`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to generate AI lab interpretation.', type: 'error' });
    } finally {
      setAiInterpreting(false);
    }
  };

  const stats = useMemo(() => {
    const total = labOrders.length;
    const pending = labOrders.filter((o) => o.status === 'pending' || o.status === 'sample_collected' || o.status === 'processing').length;
    const ready = labOrders.filter((o) => o.status === 'ready').length;
    const reviewed = labOrders.filter((o) => o.status === 'reviewed').length;
    return { total, pending, ready, reviewed };
  }, [labOrders]);

  const filteredOrders = useMemo(() => {
    return labOrders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const q = search.toLowerCase();
      const patient = patients.find((p) => p.id === order.patient_id);
      const patientName = patient?.name || '';
      const matchesSearch =
        order.order_number.toLowerCase().includes(q) ||
        order.test_type.toLowerCase().includes(q) ||
        patientName.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [labOrders, statusFilter, search, patients]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setToast({ message: 'Please select a patient', type: 'error' });
      return;
    }
    setSubmittingOrder(true);
    try {
      const res = await createLabOrder({
        patient_id: selectedPatientId,
        test_type: testType,
        status: 'pending',
        priority,
        clinical_notes: notes.trim() || undefined,
        location_id: user?.location_id,
      });
      if (res.success) {
        setToast({ message: 'Lab order created successfully', type: 'success' });
        setShowAddModal(false);
        setSelectedPatientId('');
        setNotes('');
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to create order', type: 'error' });
      }
    } catch {
      setToast({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const openDetailModal = (order: LabOrder) => {
    setSelectedOrder(order);
    setResultsList(order.results ? [...order.results] : []);
    setPathologySummary(order.pathology_summary || '');
  };

  const handleAddParam = () => {
    if (!newParam.parameter || !newParam.value) {
      setToast({ message: 'Please enter parameter name and value', type: 'error' });
      return;
    }
    setResultsList([...resultsList, { ...newParam }]);
    setNewParam({ parameter: '', value: '', unit: '', reference_range: '', status: 'normal' });
  };

  const handleRemoveParam = (index: number) => {
    setResultsList(resultsList.filter((_, i) => i !== index));
  };

  const handleSaveResults = async (targetStatus: LabStatus) => {
    if (!selectedOrder) return;
    try {
      const res = await updateLabOrderStatus(
        selectedOrder.id,
        targetStatus,
        resultsList,
        pathologySummary.trim() || undefined,
        user?.full_name || user?.email
      );
      if (res.success) {
        setToast({ message: `Lab order updated to ${targetStatus}`, type: 'success' });
        setSelectedOrder(null);
        await refetch();
      } else {
        setToast({ message: res.error || 'Failed to update order', type: 'error' });
      }
    } catch {
      setToast({ message: 'Error saving results', type: 'error' });
    }
  };

  const formatTestName = (t: string) => t.replace(/_/g, ' ').toUpperCase();

  return (
    <div className={styles.page}>
      <Topbar title="Clinical Lab Hub" />

      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>🔬 Diagnostic Laboratory Hub</h1>
        <p className={styles.greetingSub}>
          Specimen accessioning, automated hematology/biochemistry profiling, and clinical pathology validation
        </p>
      </div>

      {/* KPI Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Specimen Runs</span>
              <span className={styles.statValue}>{stats.total}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#3b82f6' }}>📋</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Processing / In-Flight</span>
              <span className={styles.statValue}>{stats.pending}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#f59e0b' }}>⚙️</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Ready for Review</span>
              <span className={styles.statValue}>{stats.ready}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#10b981' }}>🧪</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Reviewed & Certified</span>
              <span className={styles.statValue}>{stats.reviewed}</span>
            </div>
            <div className={styles.statIcon} style={{ background: '#6366f1' }}>✅</div>
          </div>
        </div>
      </div>

      {/* Main Order Registry */}
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div className={styles.searchBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by order #, test type, or patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className={styles.primaryBtn} onClick={() => setShowAddModal(true)}>
            + New Lab Specimen Order
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className={styles.tabs}>
          {['all', 'pending', 'sample_collected', 'processing', 'ready', 'reviewed'].map((st) => (
            <button
              key={st}
              className={`${styles.tabBtn} ${statusFilter === st ? styles.tabActive : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All Orders' : st.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Patient</th>
                <th>Test Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Accessioned</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    No laboratory orders match the current criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const patient = patients.find((p) => p.id === order.patient_id);
                  return (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600 }}>{order.order_number}</td>
                      <td>
                        <strong>{patient?.name || 'Unknown Patient'}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {patient?.species} ({patient?.breed || 'Mixed'})
                        </div>
                      </td>
                      <td>{formatTestName(order.test_type)}</td>
                      <td>
                        <span className={order.priority === 'urgent' ? styles.priorityUrgent : styles.priorityNormal}>
                          {order.priority === 'urgent' ? '🔴 URGENT STAT' : 'Normal'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            order.status === 'pending'
                              ? styles.badgePending
                              : order.status === 'sample_collected'
                              ? styles.badgeSampleCollected
                              : order.status === 'processing'
                              ? styles.badgeProcessing
                              : order.status === 'ready'
                              ? styles.badgeReady
                              : styles.badgeReviewed
                          }`}
                        >
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>{new Date(order.collected_at).toLocaleDateString()}</td>
                      <td>
                        <button className={styles.actionBtn} onClick={() => openDetailModal(order)}>
                          {order.status === 'ready' || order.status === 'reviewed' ? '👁️ View Results' : '📝 Enter Results'}
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

      {/* New Lab Order Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Accession New Lab Specimen">
        <form onSubmit={handleCreateOrder}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Patient</label>
            <select
              className={styles.select}
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              required
            >
              <option value="">-- Select Inpatient or Outpatient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.species} - {p.owner?.full_name || 'Clinic Owned'})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Test Diagnostic Panel</label>
            <select
              className={styles.select}
              value={testType}
              onChange={(e) => setTestType(e.target.value as LabTestType)}
            >
              <option value="complete_blood_count">Complete Blood Count (CBC / Hemogram)</option>
              <option value="biochemistry">Serum Biochemistry Panel (Comprehensive)</option>
              <option value="urinalysis">Urinalysis & Sediment Microscopic Exam</option>
              <option value="fecal_analysis">Fecal Flotation & Parasite Screen</option>
              <option value="cytology">Cytology / Fine Needle Aspirate</option>
              <option value="rapid_snap_test">In-Clinic Rapid SNAP Assay (Parvo/Giardia/FeLV)</option>
              <option value="other">Other Diagnostic Assay</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Order Priority</label>
            <select
              className={styles.select}
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
            >
              <option value="normal">Routine / Standard Queue</option>
              <option value="urgent">🔴 STAT / Emergency Immediate Priority</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Clinical Indications & Symptoms</label>
            <textarea
              className={styles.textarea}
              placeholder="e.g. Lethargy, pale gums, vomiting x 2 days. Suspected hemolytic anemia."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              className={styles.tabBtn}
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submittingOrder}>
              {submittingOrder ? 'Submitting...' : 'Accession Specimen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Lab Results Detail / Entry Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Lab Analysis: ${selectedOrder.order_number}`}
        >
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div><strong>Test:</strong> {formatTestName(selectedOrder.test_type)}</div>
              <div><strong>Priority:</strong> {(selectedOrder.priority || 'normal').toUpperCase()}</div>
              <div><strong>Collected At:</strong> {new Date(selectedOrder.collected_at).toLocaleString()}</div>
              {selectedOrder.clinical_notes && (
                <div style={{ marginTop: '6px', color: 'var(--color-text-muted)' }}>
                  <strong>Indications:</strong> {selectedOrder.clinical_notes}
                </div>
              )}
            </div>

            <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Parametric Assay Results</h4>

            {resultsList.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No test parameters added yet.</p>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                {resultsList.map((param, idx) => (
                  <div key={idx} className={styles.paramRow}>
                    <strong>{param.parameter || param.name}</strong>
                    <span>{param.value} {param.unit}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Ref: {param.reference_range}</span>
                    <span
                      className={
                        (param.status || param.flag) === 'critical'
                          ? styles.flagCritical
                          : (param.status || param.flag) === 'high'
                          ? styles.flagHigh
                          : (param.status || param.flag) === 'low'
                          ? styles.flagLow
                          : styles.flagNormal
                      }
                    >
                      {(param.status || param.flag || 'normal').toUpperCase()}
                    </span>
                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                      onClick={() => handleRemoveParam(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Parameter Entry Controls */}
            <div style={{ padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-navy)' }}>Add Parameter Value</span>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr auto', gap: '6px', marginTop: '6px' }}>
                <input
                  type="text"
                  placeholder="Param (e.g. PCV)"
                  className={styles.input}
                  value={newParam.parameter}
                  onChange={(e) => setNewParam({ ...newParam, parameter: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Val (e.g. 42)"
                  className={styles.input}
                  value={newParam.value}
                  onChange={(e) => setNewParam({ ...newParam, value: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Unit (%)"
                  className={styles.input}
                  value={newParam.unit}
                  onChange={(e) => setNewParam({ ...newParam, unit: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Ref (37-55)"
                  className={styles.input}
                  value={newParam.reference_range}
                  onChange={(e) => setNewParam({ ...newParam, reference_range: e.target.value })}
                />
                <select
                  className={styles.select}
                  value={newParam.status}
                  onChange={(e) => setNewParam({ ...newParam, status: e.target.value as 'normal' | 'low' | 'high' | 'critical' })}
                >
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button type="button" className={styles.primaryBtn} onClick={handleAddParam}>
                  + Add
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className={styles.label} style={{ marginBottom: 0 }}>Clinical Pathology & Diagnostic Summary</label>
                <button
                  type="button"
                  onClick={handleAiInterpret}
                  disabled={aiInterpreting}
                  style={{
                    background: 'linear-gradient(135deg, #0a2540, #146eb4)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(10, 37, 64, 0.15)',
                  }}
                >
                  {aiInterpreting ? 'Analyzing Parameters...' : '✨ AI Interpret Lab Values'}
                </button>
              </div>
              <textarea
                className={styles.textarea}
                placeholder="Pathologist notes, microscopic findings, and clinical correlation..."
                value={pathologySummary}
                onChange={(e) => setPathologySummary(e.target.value)}
                rows={5}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className={styles.tabBtn}
                onClick={() => handleSaveResults('processing')}
              >
                Save as In-Progress
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => handleSaveResults('ready')}
                >
                  Mark Ready for Review
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => handleSaveResults('reviewed')}
                >
                  ✅ Certify & Finalize Report
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
