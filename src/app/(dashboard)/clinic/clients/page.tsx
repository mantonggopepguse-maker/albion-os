/**
 * @file (dashboard)/clinic/clients/page.tsx
 * @description Dedicated Veterinary Clinic Client & Pet Owner Management Hub.
 *
 * Provides complete client management for veterinary clinics:
 *   - Searchable & filterable directory of pet owners with avatar, phone, email, address, and emergency contact.
 *   - Real-time aggregation of linked pets/patients per client.
 *   - Comprehensive "Register New Client" and "Edit Client" modal form.
 *   - Detailed Client Overview modal showing linked pets, clinical notes, and quick action to register new pets.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { useClinicClients, useClinicPatients, useLocations } from '@/hooks/use-supabase-data';
import { addClinicClient, updateClinicClient } from '@/lib/data-service';
import type { ClinicClient, AddClinicClientInput, PreferredContactMethod } from '@/lib/types';
import styles from './clients.module.css';

export default function ClinicClientsPage() {
  const { clients, loading: clientsLoading, refetch: refetchClients } = useClinicClients();
  const { patients, loading: patientsLoading } = useClinicPatients();
  const { locations } = useLocations();

  // ── Filters & Search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // ── Modals State ──
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClinicClient | null>(null);
  const [viewingClient, setViewingClient] = useState<ClinicClient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // ── Form State ──
  const [formState, setFormState] = useState<AddClinicClientInput>({
    first_name: '',
    last_name: '',
    phone: '',
    alternate_phone: '',
    email: '',
    address: '',
    city: '',
    state: 'Lagos',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    preferred_contact: 'Phone',
    referral_source: '',
    notes: '',
    location_id: '',
  });

  // Map clinic locations
  const clinicLocations = useMemo(() => {
    return locations.filter((loc) => loc.type === 'clinic');
  }, [locations]);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((l) => map.set(l.id, l.name));
    return map;
  }, [locations]);

  // Map patients by client ID
  const patientsByClientId = useMemo(() => {
    const map = new Map<string, typeof patients>();
    patients.forEach((p) => {
      const existing = map.get(p.owner_id) || [];
      existing.push(p);
      map.set(p.owner_id, existing);
    });
    return map;
  }, [patients]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (selectedLocation !== 'all' && c.location_id !== selectedLocation) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const ownedPets = patientsByClientId.get(c.id) || [];
      const matchesPet = ownedPets.some((p) =>
        p.name.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        (p.breed && p.breed.toLowerCase().includes(q))
      );

      return (
        c.full_name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.address.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        matchesPet
      );
    });
  }, [clients, selectedLocation, searchQuery, patientsByClientId]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const totalClients = clients.length;
    let activePetOwners = 0;
    clients.forEach((c) => {
      if ((patientsByClientId.get(c.id) || []).length > 0) {
        activePetOwners += 1;
      }
    });
    const totalPatients = patients.length;
    const branchesWithClients = new Set(clients.map((c) => c.location_id).filter(Boolean)).size;

    return { totalClients, activePetOwners, totalPatients, branchesWithClients };
  }, [clients, patientsByClientId, patients]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormState({
      first_name: '',
      last_name: '',
      phone: '',
      alternate_phone: '',
      email: '',
      address: '',
      city: '',
      state: 'Lagos',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: '',
      preferred_contact: 'Phone',
      referral_source: '',
      notes: '',
      location_id: clinicLocations[0]?.id || '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (client: ClinicClient) => {
    setEditingClient(client);
    setFormState({
      first_name: client.first_name,
      last_name: client.last_name,
      phone: client.phone,
      alternate_phone: client.alternate_phone || '',
      email: client.email || '',
      address: client.address,
      city: client.city || '',
      state: client.state || 'Lagos',
      emergency_contact_name: client.emergency_contact_name || '',
      emergency_contact_phone: client.emergency_contact_phone || '',
      emergency_contact_relation: client.emergency_contact_relation || '',
      preferred_contact: client.preferred_contact || 'Phone',
      referral_source: client.referral_source || '',
      notes: client.notes || '',
      location_id: client.location_id || '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Close Modal
  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingClient(null);
    setFormError(null);
  };

  // Handle Submit (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formState.first_name?.trim()) {
      setFormError('First name is required');
      return;
    }
    if (!formState.last_name?.trim()) {
      setFormError('Last name is required');
      return;
    }
    if (!formState.phone?.trim()) {
      setFormError('Primary phone number is required');
      return;
    }
    if (!formState.address?.trim()) {
      setFormError('Residential address is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingClient) {
        const res = await updateClinicClient(editingClient.id, {
          first_name: formState.first_name.trim(),
          last_name: formState.last_name.trim(),
          full_name: `${formState.first_name.trim()} ${formState.last_name.trim()}`,
          phone: formState.phone.trim(),
          alternate_phone: formState.alternate_phone?.trim() || null,
          email: formState.email?.trim() || null,
          address: formState.address.trim(),
          city: formState.city?.trim() || null,
          state: formState.state?.trim() || 'Lagos',
          emergency_contact_name: formState.emergency_contact_name?.trim() || null,
          emergency_contact_phone: formState.emergency_contact_phone?.trim() || null,
          emergency_contact_relation: formState.emergency_contact_relation?.trim() || null,
          preferred_contact: formState.preferred_contact || 'Phone',
          referral_source: formState.referral_source?.trim() || null,
          notes: formState.notes?.trim() || null,
          location_id: formState.location_id || null,
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to update client');
          setSubmitting(false);
          return;
        }

        setSuccessToast(`Client ${formState.first_name} ${formState.last_name} updated successfully!`);
      } else {
        const res = await addClinicClient(formState);
        if (!res.success) {
          setFormError(res.error || 'Failed to register client');
          setSubmitting(false);
          return;
        }
        setSuccessToast(`Client ${formState.first_name} ${formState.last_name} registered successfully!`);
      }

      await refetchClients();
      setIsAddModalOpen(false);
      setEditingClient(null);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getSpeciesEmoji = (species: string) => {
    const s = species.toLowerCase();
    if (s.includes('dog') || s.includes('canine')) return '🐕';
    if (s.includes('cat') || s.includes('feline')) return '🐈';
    if (s.includes('bird') || s.includes('avian')) return '🦜';
    if (s.includes('rabbit')) return '🐇';
    if (s.includes('horse') || s.includes('equine')) return '🐎';
    return '🐾';
  };

  return (
    <>
      <Topbar title="Clinic Clients & Pet Owners" />

      <div className={styles.page}>
        {/* ── Page Header ── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Pet Owners & Clinical Clients</h1>
            <p className={styles.subtitle}>
              Manage pet owner profiles, emergency contacts, billing relationships, and linked clinical patients.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button className={`${styles.btnAction} ${styles.btnActionPrimary}`} onClick={handleOpenAdd}>
              <span>+</span> Register New Client
            </button>
          </div>
        </div>

        {/* ── Success Toast ── */}
        {successToast && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-xl)',
              background: 'rgba(20, 184, 166, 0.15)',
              border: '1px solid rgba(20, 184, 166, 0.4)',
              color: '#0f766e',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--space-5)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✓</span> {successToast}
          </div>
        )}

        {/* ── KPI Grid ── */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIndicator} style={{ background: 'var(--color-navy)' }} />
            <div className={styles.kpiIcon}>👥</div>
            <div className={styles.kpiContent}>
              <span className={styles.kpiValue}>{kpiStats.totalClients}</span>
              <span className={styles.kpiLabel}>Total Clients</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIndicator} style={{ background: '#10b981' }} />
            <div className={styles.kpiIcon}>🐾</div>
            <div className={styles.kpiContent}>
              <span className={styles.kpiValue}>{kpiStats.activePetOwners}</span>
              <span className={styles.kpiLabel}>Active Pet Owners</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIndicator} style={{ background: 'var(--color-ocean)' }} />
            <div className={styles.kpiIcon}>🐕</div>
            <div className={styles.kpiContent}>
              <span className={styles.kpiValue}>{kpiStats.totalPatients}</span>
              <span className={styles.kpiLabel}>Linked Patients</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIndicator} style={{ background: '#f59e0b' }} />
            <div className={styles.kpiIcon}>🏥</div>
            <div className={styles.kpiContent}>
              <span className={styles.kpiValue}>{kpiStats.branchesWithClients || clinicLocations.length}</span>
              <span className={styles.kpiLabel}>Clinic Branches</span>
            </div>
          </div>
        </div>

        {/* ── Toolbar: Search & Location Filters ── */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search clients by name, phone, email, address, or pet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className={styles.filterSelect}
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="all">All Clinic Branches</option>
              {clinicLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Client Directory Table ── */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>Client Profile</th>
                <th className={styles.tableHeader}>Contact Details</th>
                <th className={styles.tableHeader}>Branch</th>
                <th className={styles.tableHeader}>Address & Emergency</th>
                <th className={styles.tableHeader}>Linked Pets</th>
                <th className={styles.tableHeader} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clientsLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--color-text-muted)' }}>
                    Loading clinical clients directory...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-navy)', marginBottom: '4px' }}>
                      No matching clients found
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                      Try adjusting your search criteria or register a new client record.
                    </div>
                    <button className={`${styles.btnAction} ${styles.btnActionPrimary}`} onClick={handleOpenAdd}>
                      + Register First Client
                    </button>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const ownedPets = patientsByClientId.get(client.id) || [];
                  const branchName = client.location_id ? locationMap.get(client.location_id) || 'Primary Clinic' : 'All Branches';

                  return (
                    <tr key={client.id} className={styles.tableRow}>
                      {/* Client Identity */}
                      <td className={styles.tableCell}>
                        <div className={styles.clientProfile}>
                          <div className={styles.clientAvatar}>
                            {getInitials(client.full_name)}
                          </div>
                          <div>
                            <div className={styles.clientName}>{client.full_name}</div>
                            <div className={styles.clientDate}>
                              Registered {new Date(client.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className={styles.tableCell}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <a href={`tel:${client.phone}`} className={styles.contactLink}>
                            📞 {client.phone}
                          </a>
                          {client.email && (
                            <a href={`mailto:${client.email}`} className={styles.contactLink}>
                              ✉️ {client.email}
                            </a>
                          )}
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Prefers: <span style={{ fontWeight: 600, color: 'var(--color-ocean)' }}>{client.preferred_contact}</span>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className={styles.tableCell}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(30, 79, 119, 0.08)',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-navy)',
                        }}>
                          🏥 {branchName}
                        </span>
                      </td>

                      {/* Address & Emergency */}
                      <td className={styles.tableCell}>
                        <div style={{ maxWidth: '240px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-navy)' }}>
                            {client.address}{client.city ? `, ${client.city}` : ''}
                          </div>
                          {client.emergency_contact_name && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              🚨 {client.emergency_contact_name} ({client.emergency_contact_relation || 'Contact'}):{' '}
                              <a href={`tel:${client.emergency_contact_phone}`} style={{ color: 'var(--color-ocean)', textDecoration: 'none' }}>
                                {client.emergency_contact_phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Linked Pets Chips */}
                      <td className={styles.tableCell}>
                        {ownedPets.length === 0 ? (
                          <span className={styles.noPets}>No pets registered yet</span>
                        ) : (
                          <div className={styles.petChips}>
                            {ownedPets.map((p) => (
                              <Link
                                key={p.id}
                                href={`/clinic/patients?search=${encodeURIComponent(p.name)}`}
                                className={styles.petChip}
                                title={`${p.name} (${p.species}${p.breed ? ` - ${p.breed}` : ''})`}
                              >
                                <span>{getSpeciesEmoji(p.species)}</span>
                                <span>{p.name}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className={styles.tableCell} style={{ textAlign: 'right' }}>
                        <div className={styles.actionGroup} style={{ justifyContent: 'flex-end' }}>
                          <button
                            className={styles.btnAction}
                            title="View client details and pet profiles"
                            onClick={() => setViewingClient(client)}
                          >
                            👁️ View
                          </button>
                          <Link
                            href={`/clinic/patients?clientId=${client.id}&clientName=${encodeURIComponent(client.full_name)}`}
                            className={`${styles.btnAction} ${styles.btnActionPrimary}`}
                            title="Add a new pet for this client"
                          >
                            🐾 + Pet
                          </Link>
                          <button
                            className={styles.btnAction}
                            title="Edit client information"
                            onClick={() => handleOpenEdit(client)}
                          >
                            ✏️ Edit
                          </button>
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

      {/* ── Add / Edit Client Modal ── */}
      {isAddModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingClient ? `Edit Client: ${editingClient.full_name}` : 'Register New Clinical Client'}
              </h2>
              <button className={styles.modalClose} onClick={handleCloseModal}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.modalContent}>
                {formError && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#dc2626',
                    fontSize: '12px',
                    marginBottom: 'var(--space-4)',
                    fontWeight: 600,
                  }}>
                    ⚠️ {formError}
                  </div>
                )}

                {/* Basic Information */}
                <div className={styles.sectionHeader}>1. Client Identity & Contact</div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>First Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Amina"
                      value={formState.first_name}
                      onChange={(e) => setFormState({ ...formState, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Last Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Bello"
                      value={formState.last_name}
                      onChange={(e) => setFormState({ ...formState, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Primary Phone Number *</label>
                    <input
                      type="tel"
                      className={styles.formInput}
                      placeholder="+234 803 123 4567"
                      value={formState.phone}
                      onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Alternative Phone</label>
                    <input
                      type="tel"
                      className={styles.formInput}
                      placeholder="+234 812 987 6543"
                      value={formState.alternate_phone || ''}
                      onChange={(e) => setFormState({ ...formState, alternate_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email Address</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      placeholder="amina.bello@example.com"
                      value={formState.email || ''}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Preferred Contact Method</label>
                    <select
                      className={styles.formSelect}
                      value={formState.preferred_contact || 'Phone'}
                      onChange={(e) => setFormState({ ...formState, preferred_contact: e.target.value as PreferredContactMethod })}
                    >
                      <option value="Phone">Phone Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Email">Email</option>
                      <option value="SMS">SMS Text</option>
                    </select>
                  </div>
                </div>

                {/* Residential Address */}
                <div className={styles.sectionHeader}>2. Residential Address</div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Street Address *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. 14 Victoria Island Link Rd"
                    value={formState.address}
                    onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>City / Area</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Victoria Island"
                      value={formState.city || ''}
                      onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>State</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Lagos"
                      value={formState.state || 'Lagos'}
                      onChange={(e) => setFormState({ ...formState, state: e.target.value })}
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className={styles.sectionHeader}>3. Emergency Contact</div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Emergency Contact Name</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Tunde Bello"
                      value={formState.emergency_contact_name || ''}
                      onChange={(e) => setFormState({ ...formState, emergency_contact_name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Relationship</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Spouse / Sibling / Neighbour"
                      value={formState.emergency_contact_relation || ''}
                      onChange={(e) => setFormState({ ...formState, emergency_contact_relation: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Emergency Phone</label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    placeholder="+234 802 000 1122"
                    value={formState.emergency_contact_phone || ''}
                    onChange={(e) => setFormState({ ...formState, emergency_contact_phone: e.target.value })}
                  />
                </div>

                {/* Branch & Administrative Context */}
                <div className={styles.sectionHeader}>4. Clinic Branch & Administrative Notes</div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Assigned Clinic Branch</label>
                    <select
                      className={styles.formSelect}
                      value={formState.location_id || ''}
                      onChange={(e) => setFormState({ ...formState, location_id: e.target.value })}
                    >
                      <option value="">All Branches / Main Hub</option>
                      {clinicLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Referral Source</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Instagram / Friend / Signage"
                      value={formState.referral_source || ''}
                      onChange={(e) => setFormState({ ...formState, referral_source: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Clinical / Billing Notes</label>
                  <textarea
                    rows={2}
                    className={styles.formTextarea}
                    placeholder="e.g. Prefers afternoon consultations, holds VIP pet club membership..."
                    value={formState.notes || ''}
                    onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={handleCloseModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Saving Record...' : editingClient ? 'Save Changes' : 'Register Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Client Details Modal ── */}
      {viewingClient && (
        <div className={styles.modalOverlay} onClick={() => setViewingClient(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className={styles.clientAvatar}>
                  {getInitials(viewingClient.full_name)}
                </div>
                <div>
                  <h2 className={styles.modalTitle}>{viewingClient.full_name}</h2>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Client ID: {viewingClient.id} · Registered {new Date(viewingClient.created_at).toLocaleDateString('en-NG', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => setViewingClient(null)}>✕</button>
            </div>

            <div className={styles.modalContent}>
              {/* Contact and address cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{
                  background: 'rgba(30, 79, 119, 0.04)',
                  padding: '12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(30, 79, 119, 0.1)',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-navy)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Contact Details
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                    <strong>Phone:</strong> <a href={`tel:${viewingClient.phone}`} style={{ color: 'var(--color-ocean)' }}>{viewingClient.phone}</a>
                  </div>
                  {viewingClient.alternate_phone && (
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                      <strong>Alt Phone:</strong> <a href={`tel:${viewingClient.alternate_phone}`} style={{ color: 'var(--color-ocean)' }}>{viewingClient.alternate_phone}</a>
                    </div>
                  )}
                  {viewingClient.email && (
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                      <strong>Email:</strong> <a href={`mailto:${viewingClient.email}`} style={{ color: 'var(--color-ocean)' }}>{viewingClient.email}</a>
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Prefers contact via <strong>{viewingClient.preferred_contact}</strong>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(30, 79, 119, 0.04)',
                  padding: '12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(30, 79, 119, 0.1)',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-navy)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Location & Emergency
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                    <strong>Address:</strong> {viewingClient.address}, {viewingClient.city || ''} {viewingClient.state || ''}
                  </div>
                  {viewingClient.emergency_contact_name && (
                    <div style={{ fontSize: '13px', marginTop: '6px' }}>
                      <strong>Emergency Contact:</strong><br />
                      {viewingClient.emergency_contact_name} ({viewingClient.emergency_contact_relation || 'Relation'})<br />
                      <a href={`tel:${viewingClient.emergency_contact_phone}`} style={{ color: 'var(--color-ocean)' }}>
                        {viewingClient.emergency_contact_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {viewingClient.notes && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '12px',
                  color: '#92400e',
                  marginBottom: '16px',
                }}>
                  <strong>Notes:</strong> {viewingClient.notes}
                </div>
              )}

              {/* Owned Patients / Animals */}
              <div className={styles.sectionHeader}>Registered Pets & Clinical Patients</div>
              {(() => {
                const pets = patientsByClientId.get(viewingClient.id) || [];
                if (pets.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--color-text-muted)' }}>
                      <p style={{ margin: '0 0 12px 0' }}>No patients are linked to this client yet.</p>
                      <Link
                        href={`/clinic/patients?clientId=${viewingClient.id}&clientName=${encodeURIComponent(viewingClient.full_name)}`}
                        className={`${styles.btnAction} ${styles.btnActionPrimary}`}
                      >
                        🐾 Register First Pet for {viewingClient.first_name}
                      </Link>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pets.map((pet) => (
                      <div
                        key={pet.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-lg)',
                          background: 'rgba(255, 255, 255, 0.7)',
                          border: '1px solid rgba(30, 79, 119, 0.12)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '24px' }}>{getSpeciesEmoji(pet.species)}</span>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-navy)', fontSize: '14px' }}>
                              {pet.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {pet.species} · {pet.breed || 'Mixed Breed'} · {pet.age_years ? `${pet.age_years} yrs` : 'Age unknown'} · {pet.weight_kg ? `${pet.weight_kg} kg` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Link
                            href={`/clinic/patients?search=${encodeURIComponent(pet.name)}`}
                            className={styles.btnAction}
                            style={{ fontSize: '11px' }}
                          >
                            View Patient File →
                          </Link>
                        </div>
                      </div>
                    ))}

                    <div style={{ marginTop: '8px', textAlign: 'right' }}>
                      <Link
                        href={`/clinic/patients?clientId=${viewingClient.id}&clientName=${encodeURIComponent(viewingClient.full_name)}`}
                        className={`${styles.btnAction} ${styles.btnActionPrimary}`}
                        style={{ fontSize: '12px' }}
                      >
                        + Add Another Pet for this Client
                      </Link>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => {
                  const toEdit = viewingClient;
                  setViewingClient(null);
                  handleOpenEdit(toEdit);
                }}
              >
                ✏️ Edit Client Info
              </button>
              <button type="button" className={styles.submitBtn} onClick={() => setViewingClient(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
