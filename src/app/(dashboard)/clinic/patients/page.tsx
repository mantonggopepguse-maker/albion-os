'use client';

import { useState, useCallback, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Topbar from '@/components/layout/Topbar';
import { useClinicPatients, useClinicClients } from '@/hooks/use-supabase-data';
import type { Species } from '@/lib/types';
import styles from './patients.module.css';

const SPECIES_OPTIONS: Species[] = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Fish', 'Reptile', 'Horse', 'Goat', 'Sheep', 'Cattle', 'Poultry', 'Other'];

const initialForm = {
  name: '',
  species: 'Dog' as Species,
  breed: '',
  gender: 'Male' as 'Male' | 'Female',
  date_of_birth: '',
  weight_kg: '',
  color: '',
  microchip_id: '',
  spayed_neutered: false,
  allergies: '',
  medical_notes: '',
  owner_id: '',
};

const initialQuickClient = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
};

function PatientsPageContent() {
  const { user } = useAuth();
  const { patients, loading, refetch } = useClinicPatients();
  const { clients, refetch: refetchClients } = useClinicClients();

  // Preselection from query parameters (/clinic/patients?clientId=...)
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams ? (searchParams.get('clientId') || searchParams.get('client_id') || searchParams.get('owner_id')) : null;

  const [showModal, setShowModal] = useState(() => Boolean(preselectedClientId));
  const [form, setForm] = useState(() => ({
    ...initialForm,
    owner_id: preselectedClientId || '',
  }));
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [prevClientId, setPrevClientId] = useState(preselectedClientId);
  if (preselectedClientId !== prevClientId) {
    setPrevClientId(preselectedClientId);
    if (preselectedClientId) {
      setShowModal(true);
      setForm((prev) => ({ ...prev, owner_id: preselectedClientId }));
    }
  }

  const handleOpenModal = () => {
    setSubmitError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSubmitError(null);
  };

  // Quick Client inline registration modal state
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [quickClient, setQuickClient] = useState({ ...initialQuickClient });
  const [quickClientSaving, setQuickClientSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleQuickClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setQuickClient((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickClientSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickClient.first_name.trim() || !quickClient.last_name.trim() || !quickClient.phone.trim() || !quickClient.address.trim()) {
      return;
    }
    setQuickClientSaving(true);
    try {
      const { addClinicClient } = await import('@/lib/data-service');
      const res = await addClinicClient({
        first_name: quickClient.first_name.trim(),
        last_name: quickClient.last_name.trim(),
        phone: quickClient.phone.trim(),
        email: quickClient.email.trim() || null,
        address: quickClient.address.trim(),
        city: quickClient.city.trim() || null,
      });
      if (res.success && res.data) {
        await refetchClients();
        setForm((prev) => ({ ...prev, owner_id: res.data!.id }));
        setShowQuickClientModal(false);
        setQuickClient({ ...initialQuickClient });
      }
    } finally {
      setQuickClientSaving(false);
    }
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!form.owner_id) {
        setSubmitError('Please select a registered pet owner.');
        return;
      }
      setSaving(true);
      setSubmitError(null);
      try {
        const { isSupabaseMockMode } = await import('@/lib/supabase/config');
        if (isSupabaseMockMode()) {
          const { addPatient } = await import('@/lib/data-service');
          const res = await addPatient({
            owner_id: form.owner_id,
            clinic_client_id: form.owner_id,
            name: form.name.trim(),
            species: form.species,
            breed: form.breed,
            gender: form.gender,
            date_of_birth: form.date_of_birth || undefined,
            weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
            color: form.color,
            microchip_id: form.microchip_id?.trim() || undefined,
            spayed_neutered: form.spayed_neutered,
            allergies: form.allergies?.trim() || undefined,
            medical_notes: form.medical_notes?.trim() || undefined,
          });
          if (!res.success) {
            setSubmitError(res.error || 'Failed to register patient in demo mode.');
            return;
          }
        } else {
          const supabase = (await import('@/lib/supabase/client')).createClient();
          const { error } = await supabase.from('patients').insert({
            clinic_client_id: form.owner_id,
            owner_id: null,
            name: form.name.trim(),
            species: form.species,
            breed: form.breed || null,
            gender: form.gender,
            date_of_birth: form.date_of_birth || null,
            weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
            color: form.color || null,
            microchip_id: form.microchip_id?.trim() || null,
            spayed_neutered: form.spayed_neutered,
            allergies: form.allergies?.trim() || null,
            medical_notes: form.medical_notes?.trim() || null,
            is_active: true,
          });
          if (error) {
            setSubmitError(`Database error: ${error.message}`);
            return;
          }
        }
        await refetch();
        handleCloseModal();
        setForm({ ...initialForm });
      } catch (err: any) {
        setSubmitError(err.message || 'An error occurred while saving patient record.');
      } finally {
        setSaving(false);
      }
    },
    [form, refetch],
  );

  if (!user) return null;

  return (
    <>
      <Topbar title="Patients" />
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Patients</h1>
            <p className={styles.subtitle}>Manage registered pets</p>
          </div>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            + Register Patient
          </button>
        </div>

        <div className="table-container">
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>Name</th>
                <th className={styles.tableHeader}>Species</th>
                <th className={styles.tableHeader}>Breed</th>
                <th className={styles.tableHeader}>Gender</th>
                <th className={styles.tableHeader}>Owner</th>
                <th className={styles.tableHeader}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className={styles.tableCell} colSpan={6}>
                    <div className={styles.loading}>Loading patients...</div>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td className={styles.tableCell} colSpan={6}>
                    <div className={styles.loading}>No patients registered yet.</div>
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>{p.name}</td>
                    <td className={styles.tableCell}>{p.species}</td>
                    <td className={styles.tableCell}>{p.breed || '—'}</td>
                    <td className={styles.tableCell}>{p.gender}</td>
                    <td className={styles.tableCell}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                          {p.owner?.full_name || p.owner?.name || '—'}
                        </div>
                        {p.owner?.phone && (
                          <a
                            href={`tel:${p.owner.phone}`}
                            style={{ fontSize: '0.75rem', color: 'var(--color-ocean)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            📞 {p.owner.phone}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <span
                        className={`${styles.badge} ${
                          p.is_active !== false
                            ? styles.badgeActive
                            : styles.badgeInactive
                        }`}
                      >
                        {p.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Register Patient</h2>
              <button
                className={styles.modalClose}
                onClick={handleCloseModal}
                type="button"
              >
                ✕
              </button>
            </div>
            {submitError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', margin: '14px 24px 0' }}>
                ⚠️ {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className={styles.modalContent}>
                <div className={styles.form}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Name</label>
                    <input
                      className={styles.formInput}
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Pet name"
                      required
                    />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Species</label>
                      <select
                        className={styles.formSelect}
                        name="species"
                        value={form.species}
                        onChange={handleChange}
                      >
                        {SPECIES_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Breed</label>
                      <input
                        className={styles.formInput}
                        name="breed"
                        value={form.breed}
                        onChange={handleChange}
                        placeholder="e.g. Golden Retriever"
                      />
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Gender</label>
                      <select
                        className={styles.formSelect}
                        name="gender"
                        value={form.gender}
                        onChange={handleChange}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Date of Birth</label>
                      <input
                        className={styles.formInput}
                        type="date"
                        name="date_of_birth"
                        value={form.date_of_birth}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Weight (kg)</label>
                      <input
                        className={styles.formInput}
                        type="number"
                        step="0.1"
                        name="weight_kg"
                        value={form.weight_kg}
                        onChange={handleChange}
                        placeholder="e.g. 12.5"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Color</label>
                      <input
                        className={styles.formInput}
                        name="color"
                        value={form.color}
                        onChange={handleChange}
                        placeholder="e.g. Brown & White"
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <label className={styles.formLabel} style={{ margin: 0 }}>Owner (Client) *</label>
                      <button
                        type="button"
                        onClick={() => setShowQuickClientModal(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-ocean)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        + Quick Add Client
                      </button>
                    </div>
                    <select
                      className={styles.formSelect}
                      name="owner_id"
                      value={form.owner_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select a pet owner / client</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Microchip ID</label>
                      <input
                        className={styles.formInput}
                        name="microchip_id"
                        value={form.microchip_id}
                        onChange={handleChange}
                        placeholder="e.g. 985141001234567"
                      />
                    </div>
                    <div className={styles.formGroup} style={{ justifyContent: 'center', paddingTop: '1.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>
                        <input
                          type="checkbox"
                          name="spayed_neutered"
                          checked={form.spayed_neutered}
                          onChange={handleChange}
                          style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--color-navy)' }}
                        />
                        Spayed / Neutered
                      </label>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Allergies</label>
                    <input
                      className={styles.formInput}
                      name="allergies"
                      value={form.allergies}
                      onChange={handleChange}
                      placeholder="e.g. Penicillin, Chicken protein"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Medical Notes</label>
                    <textarea
                      className={styles.formInput}
                      name="medical_notes"
                      value={form.medical_notes}
                      onChange={handleChange}
                      placeholder="Pre-existing conditions, behavioral notes, etc."
                      style={{ minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={saving || !form.name.trim() || !form.owner_id}
                >
                  {saving ? 'Saving...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuickClientModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }} onClick={() => setShowQuickClientModal(false)}>
          <div className={styles.modal} style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Quick Add Client (Pet Owner)</h2>
              <button
                className={styles.modalClose}
                onClick={() => setShowQuickClientModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleQuickClientSubmit}>
              <div className={styles.modalContent}>
                <div className={styles.form}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>First Name *</label>
                      <input
                        className={styles.formInput}
                        name="first_name"
                        value={quickClient.first_name}
                        onChange={handleQuickClientChange}
                        placeholder="e.g. Amina"
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Last Name *</label>
                      <input
                        className={styles.formInput}
                        name="last_name"
                        value={quickClient.last_name}
                        onChange={handleQuickClientChange}
                        placeholder="e.g. Bello"
                        required
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Phone Number *</label>
                    <input
                      className={styles.formInput}
                      name="phone"
                      value={quickClient.phone}
                      onChange={handleQuickClientChange}
                      placeholder="+234 803 111 2233"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Residential Address *</label>
                    <input
                      className={styles.formInput}
                      name="address"
                      value={quickClient.address}
                      onChange={handleQuickClientChange}
                      placeholder="e.g. 14 Admiralty Way, Lekki"
                      required
                    />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Email (Optional)</label>
                      <input
                        className={styles.formInput}
                        type="email"
                        name="email"
                        value={quickClient.email}
                        onChange={handleQuickClientChange}
                        placeholder="amina@example.com"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>City / State</label>
                      <input
                        className={styles.formInput}
                        name="city"
                        value={quickClient.city}
                        onChange={handleQuickClientChange}
                        placeholder="Lekki, Lagos"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowQuickClientModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={quickClientSaving || !quickClient.first_name.trim() || !quickClient.last_name.trim() || !quickClient.phone.trim() || !quickClient.address.trim()}
                >
                  {quickClientSaving ? 'Adding...' : 'Add & Select Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading Patients...</div>}>
      <PatientsPageContent />
    </Suspense>
  );
}
