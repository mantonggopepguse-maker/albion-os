'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import Topbar from '@/components/layout/Topbar';
import { useClinicPatients, useUsers } from '@/hooks/use-supabase-data';
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

export default function PatientsPage() {
  const { user } = useAuth();
  const { patients, loading, refetch } = useClinicPatients();
  const { users } = useUsers();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [saving, setSaving] = useState(false);
  const initialOwnerSet = useRef(false);

  useEffect(() => {
    if (showModal && users.length > 0 && !initialOwnerSet.current) {
      initialOwnerSet.current = true;
      setForm((prev) => ({ ...prev, owner_id: users[0].id }));
    }
    if (!showModal) {
      initialOwnerSet.current = false;
    }
  }, [showModal, users]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        const supabase = (await import('@/lib/supabase/client')).createClient();
        const { error } = await supabase.from('patients').insert({
          owner_id: form.owner_id,
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
          const { addPatient } = await import('@/lib/data-service');
          await addPatient({
            owner_id: form.owner_id,
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
        }
        await refetch();
        setShowModal(false);
        setForm({ ...initialForm });
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
                      {p.owner?.full_name || p.owner?.name || '—'}
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
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Register Patient</h2>
              <button
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>
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
                    <label className={styles.formLabel}>Owner</label>
                    <select
                      className={styles.formSelect}
                      name="owner_id"
                      value={form.owner_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select an owner</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email}
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
                  onClick={() => setShowModal(false)}
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
    </>
  );
}
