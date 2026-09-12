'use client';

import React, { useState, useMemo } from 'react';
import { useVetServices } from '@/hooks/use-supabase-data';
import { createVetService, updateVetService } from '@/lib/data-service';
import type { VetService, ProcedureMedicationProtocol } from '@/lib/types';
import styles from './procedures.module.css';

export default function ProceduresPage() {
  const { services, loading, refetch } = useVetServices();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<VetService | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'consultation',
    species: 'All',
    price: '',
    duration_minutes: '30',
    description: '',
  });
  const [protocolDrugs, setProtocolDrugs] = useState<ProcedureMedicationProtocol[]>([]);
  const [postOpNotes, setPostOpNotes] = useState<string>('');
  const [viewingProtocolService, setViewingProtocolService] = useState<VetService | null>(null);

  // Filtered Services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCat = selectedCategory === 'all' || s.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.species.toLowerCase().includes(q);

      return matchCat && matchSearch;
    });
  }, [services, selectedCategory, searchTerm]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = services.length;
    const surgeries = services.filter((s) => s.category.toLowerCase() === 'surgery').length;
    const diagnostics = services.filter((s) => s.category.toLowerCase() === 'diagnostic').length;
    const avgPrice =
      services.length > 0
        ? Math.round(services.reduce((acc, s) => acc + s.price, 0) / services.length)
        : 0;

    return { total, surgeries, diagnostics, avgPrice };
  }, [services]);

  const handleOpenAddModal = () => {
    setEditingService(null);
    setFormData({
      name: '',
      category: 'consultation',
      species: 'All',
      price: '',
      duration_minutes: '30',
      description: '',
    });
    setProtocolDrugs([]);
    setPostOpNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: VetService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      species: service.species,
      price: String(service.price),
      duration_minutes: String(service.duration_minutes || 30),
      description: service.description || '',
    });
    setProtocolDrugs(service.medication_protocol ? [...service.medication_protocol] : []);
    setPostOpNotes(service.post_op_notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAddDrug = () => {
    setProtocolDrugs([
      ...protocolDrugs,
      { drug_name: '', dosage: '', frequency: 'q12h', duration: '5 days', is_alternative: false },
    ]);
  };

  const handleUpdateDrug = (index: number, field: keyof ProcedureMedicationProtocol, val: any) => {
    const next = [...protocolDrugs];
    next[index] = { ...next[index], [field]: val };
    setProtocolDrugs(next);
  };

  const handleRemoveDrug = (index: number) => {
    setProtocolDrugs(protocolDrugs.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid procedure fee.');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('Please enter a procedure name.');
      return;
    }

    setSubmitting(true);
    let res;
    if (editingService) {
      res = await updateVetService(editingService.id, {
        name: formData.name.trim(),
        category: formData.category,
        species: formData.species,
        price: priceNum,
        duration_minutes: parseInt(formData.duration_minutes, 10) || 30,
        description: formData.description.trim() || null,
        medication_protocol: protocolDrugs,
        post_op_notes: postOpNotes.trim() || undefined,
      });
    } else {
      res = await createVetService({
        name: formData.name.trim(),
        category: formData.category,
        species: formData.species,
        price: priceNum,
        duration_minutes: parseInt(formData.duration_minutes, 10) || 30,
        description: formData.description.trim() || null,
        medication_protocol: protocolDrugs,
        post_op_notes: postOpNotes.trim() || undefined,
      });
    }

    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      await refetch();
    } else {
      setFormError(res.error || 'Failed to save procedure.');
    }
  };

  const formatNaira = (amt: number) => `₦${amt.toLocaleString('en-NG')}`;

  const getCategoryClass = (category: string) => {
    switch (category.toLowerCase()) {
      case 'surgery':
        return styles.catSurgery;
      case 'diagnostic':
        return styles.catDiagnostic;
      case 'preventive':
        return styles.catPreventive;
      case 'emergency':
        return styles.catEmergency;
      default:
        return styles.catConsultation;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>📋 Procedures & Clinical Fee Schedule</h1>
        <p className={styles.greetingSub}>
          Catalog of standardized veterinary medical consultations, surgical operations, dental scaling, and diagnostic testing fees.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Active Procedures</span>
              <span className={styles.statValue}>{stats.total}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #093961, #1E4F77)' }}>
              📋
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Surgical Services</span>
              <span className={styles.statValue}>{stats.surgeries}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #db2777, #f43f5e)' }}>
              ⚡
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Diagnostic & Lab Panels</span>
              <span className={styles.statValue}>{stats.diagnostics}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}>
              🔬
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Average Procedure Fee</span>
              <span className={styles.statValue}>{formatNaira(stats.avgPrice)}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              💰
            </div>
          </div>
        </div>
      </div>

      {/* Actions & Filters */}
      <div className={styles.actionsBar}>
        <div className={styles.filters}>
          {[
            { id: 'all', label: 'All Services' },
            { id: 'consultation', label: '🩺 Consultations' },
            { id: 'surgery', label: '⚡ Surgeries' },
            { id: 'diagnostic', label: '🔬 Diagnostics' },
            { id: 'preventive', label: '💉 Preventive' },
            { id: 'dental', label: '🦷 Dental' },
            { id: 'emergency', label: '🚨 Emergency' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`${styles.filterBtn} ${selectedCategory === cat.id ? styles.filterBtnActive : ''}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Search procedure name, species..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <button onClick={handleOpenAddModal} className={styles.addBtn}>
            + Add Procedure
          </button>
        </div>
      </div>

      {/* Procedures Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Procedure Name</th>
                <th>Category</th>
                <th>Applicable Species</th>
                <th>Est. Duration</th>
                <th>Medication Protocol</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Standard Fee (₦)</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    Loading procedures catalog...
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    No clinical procedures found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                      {service.name}
                    </td>
                    <td>
                      <span className={`${styles.categoryBadge} ${getCategoryClass(service.category)}`}>
                        {service.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {service.species}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {service.duration_minutes || 30} mins
                    </td>
                    <td>
                      {service.medication_protocol && service.medication_protocol.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setViewingProtocolService(service)}
                          className={styles.protocolPill}
                          title="View clinical medication protocol"
                        >
                          💊 {service.medication_protocol.length} Drug{service.medication_protocol.length > 1 ? 's' : ''}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {service.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }} className={styles.priceCell}>
                      {formatNaira(service.price)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenEditModal(service)}
                        className={styles.editBtn}
                      >
                        ✏️ Edit Fee
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingService ? '✏️ Edit Procedure & Fee' : '📋 Add Clinical Procedure'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className={styles.modalBody}>
                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label>Procedure Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Feline Ovariohysterectomy (Spay)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="consultation">Consultation</option>
                      <option value="surgery">Surgery</option>
                      <option value="diagnostic">Diagnostic / Lab</option>
                      <option value="preventive">Preventive / Vaccine</option>
                      <option value="dental">Dental Care</option>
                      <option value="inpatient">Hospitalization</option>
                      <option value="emergency">Emergency Care</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Applicable Species</label>
                    <input
                      type="text"
                      placeholder="e.g. Dog,Cat or All"
                      value={formData.species}
                      onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Standard Fee (₦) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 35000"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Estimated Duration (Minutes)</label>
                    <input
                      type="number"
                      placeholder="e.g. 45"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                      min="5"
                    />
                  </div>
                </div>

                {/* Medication Protocol Builder */}
                <div className={styles.formGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>💊 Standard Medication Protocol</label>
                    <button
                      type="button"
                      onClick={handleAddDrug}
                      className={styles.addDrugBtn}
                    >
                      + Add Drug / Alternative
                    </button>
                  </div>

                  {protocolDrugs.length === 0 ? (
                    <div style={{ padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                      No standard medications configured. Click &quot;+ Add Drug&quot; to prescribe default pre/intra/post-op drugs.
                    </div>
                  ) : (
                    <div className={styles.protocolBuilder}>
                      {protocolDrugs.map((drug, idx) => (
                        <div key={idx} className={styles.drugRow}>
                          <input
                            type="text"
                            placeholder="Drug name (e.g. Amoxicillin)"
                            value={drug.drug_name}
                            onChange={(e) => handleUpdateDrug(idx, 'drug_name', e.target.value)}
                            style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Dosage (e.g. 10mg/kg)"
                            value={drug.dosage}
                            onChange={(e) => handleUpdateDrug(idx, 'dosage', e.target.value)}
                            style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                          />
                          <input
                            type="text"
                            placeholder="Freq / Duration (e.g. q12h x 5d)"
                            value={drug.frequency ? `${drug.frequency}${drug.duration ? ' ' + drug.duration : ''}` : drug.duration || ''}
                            onChange={(e) => handleUpdateDrug(idx, 'frequency', e.target.value)}
                            style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateDrug(idx, 'is_alternative', !drug.is_alternative)}
                              className={`${styles.orToggleBtn} ${drug.is_alternative ? styles.orToggleBtnActive : ''}`}
                              title="Toggle if this drug is an OR alternative"
                            >
                              {drug.is_alternative ? '⚡ OR ALT' : 'REQ'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDrug(idx)}
                              className={styles.removeDrugBtn}
                              title="Remove drug"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label>Post-Operative & Recovery Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="Wound monitoring, Elizabethan collar instructions, dietary restrictions..."
                    value={postOpNotes}
                    onChange={(e) => setPostOpNotes(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Clinical Description & Scope</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details on procedure scope, preparation, and what is covered..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={styles.cancelBtn}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingService ? '💾 Update Fee' : '✓ Create Procedure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Protocol Details Modal */}
      {viewingProtocolService && (
        <div className={styles.modalBackdrop} onClick={() => setViewingProtocolService(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle} style={{ margin: 0 }}>
                  💊 Protocol: {viewingProtocolService.name}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {viewingProtocolService.category.toUpperCase()} • {viewingProtocolService.species} • {viewingProtocolService.duration_minutes || 30} mins
                </div>
              </div>
              <button onClick={() => setViewingProtocolService(null)} className={styles.closeBtn}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody} style={{ gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '8px' }}>
                  Standard Medications & Alternatives
                </h4>
                {viewingProtocolService.medication_protocol && viewingProtocolService.medication_protocol.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewingProtocolService.medication_protocol.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 14px',
                          background: m.is_alternative ? '#fffbeb' : '#f8fafc',
                          border: `1px solid ${m.is_alternative ? '#fde68a' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-navy)' }}>
                            {m.drug_name}
                            {m.is_alternative && (
                              <span style={{ marginLeft: '8px', fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                OR ALTERNATIVE
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Dosage: {m.dosage || 'Standard'} • Frequency: {m.frequency || 'N/A'} {m.duration ? `• Duration: ${m.duration}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    No specific medication protocols recorded.
                  </div>
                )}
              </div>

              {viewingProtocolService.post_op_notes && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
                    Post-Operative & Care Notes
                  </h4>
                  <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
                    {viewingProtocolService.post_op_notes}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setViewingProtocolService(null)}
                className={styles.submitBtn}
                style={{ width: '100%' }}
              >
                Close Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
