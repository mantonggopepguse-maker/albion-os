'use client';

import React, { useState, useMemo } from 'react';
import { useVetServices } from '@/hooks/use-supabase-data';
import { createVetService, updateVetService } from '@/lib/data-service';
import type { VetService } from '@/lib/types';
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
    setFormError(null);
    setIsModalOpen(true);
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
      });
    } else {
      res = await createVetService({
        name: formData.name.trim(),
        category: formData.category,
        species: formData.species,
        price: priceNum,
        duration_minutes: parseInt(formData.duration_minutes, 10) || 30,
        description: formData.description.trim() || null,
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
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Standard Fee (₦)</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                    Loading procedures catalog...
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
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
                    <td style={{ fontSize: '12px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    </div>
  );
}
