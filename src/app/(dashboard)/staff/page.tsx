'use client';

import { useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { useUsers, useLocations, findLocationById } from '@/hooks/use-supabase-data';
import { getRoleLabel, useAuth, hasRole } from '@/lib/auth-context';
import { toggleUserStatus, updateStaffUser } from '@/lib/data-service';
import { MOCK_USERS } from '@/lib/mock-data';
import { createClient } from '@/lib/supabase/client';
import type { UserRole, User } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import styles from './staff.module.css';

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  super_admin: 'badgeNavy',
  sales_rep: 'badgeOcean',
  finance_manager: 'badgeGreen',
  inventory_manager: 'badgeAmber',
  ceo: 'badgeGold',
  clinic_admin: 'badgePurple',
  vet: 'badgeTeal',
  vet_tech: 'badgeOrange',
  vet_assistant: 'badgeTeal',
  receptionist: 'badgePink',
  regional_manager: 'badgeIndigo',
  security: 'badgeGray',
  lab_scientist: 'badgeBlue',
  pharmacist: 'badgeBlue',
  support_staff: 'badgeGray',
};

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: 'sales_rep', label: 'Sales Representative' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'ceo', label: 'Chief Executive Officer' },
  { value: 'clinic_admin', label: 'Clinic Admin' },
  { value: 'vet', label: 'Veterinarian' },
  { value: 'vet_tech', label: 'Vet Technician' },
  { value: 'vet_assistant', label: 'Vet Assistant' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'regional_manager', label: 'Regional Manager' },
  { value: 'security', label: 'Security' },
  { value: 'lab_scientist', label: 'Lab Scientist' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'support_staff', label: 'Support Staff' },
];

export default function StaffPage() {
  const { users, loading, refetch } = useUsers();
  const { locations } = useLocations();
  const { user: currentUser } = useAuth();
  const [showDeleted, setShowDeleted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'sales_rep' as UserRole,
    roles: ['sales_rep'] as UserRole[],
    location_id: '',
    phone: '',
  });
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editData, setEditData] = useState({
    full_name: '',
    email: '',
    role: '' as UserRole,
    roles: [] as UserRole[],
    location_id: '',
    phone: '',
  });

  if (loading) {
    return (
      <>
        <Topbar title="Staff Management" />
        <div className={styles.page} style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Loading staff&hellip;</p>
        </div>
      </>
    );
  }

  const isCeo = hasRole(currentUser, 'ceo') || hasRole(currentUser, 'super_admin');
  const filteredUsers = showDeleted ? users : users.filter((u) => u.is_active !== false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    const effectiveRoles = Array.from(new Set([formData.role, ...formData.roles]));

    if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
      const newUser: User = {
        id: `usr-${Date.now()}`,
        email: formData.email.trim().toLowerCase(),
        full_name: formData.full_name.trim(),
        role: formData.role,
        roles: effectiveRoles,
        location_id: formData.location_id || null,
        phone: formData.phone.trim() || null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        is_active: true,
      };
      MOCK_USERS.unshift(newUser);
      setShowModal(false);
      setFormData({ email: '', full_name: '', password: '', role: 'sales_rep', roles: ['sales_rep'], location_id: '', phone: '' });
      await refetch();
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: { data: { full_name: formData.full_name } },
    });

    if (signUpError || !signUpData.user) {
      setModalError(signUpError?.message || 'Failed to create user account');
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await supabase.from('profiles').update({
      full_name: formData.full_name,
      role: formData.role,
      roles: effectiveRoles,
      location_id: formData.location_id || null,
      phone: formData.phone || null,
    }).eq('id', signUpData.user.id);

    if (profileError) {
      setModalError(profileError.message);
    } else {
      setShowModal(false);
      setFormData({ email: '', full_name: '', password: '', role: 'sales_rep', roles: ['sales_rep'], location_id: '', phone: '' });
      await refetch();
    }

    setSubmitting(false);
  }

  async function handleSuspend(userId: string) {
    await toggleUserStatus(userId);
    await refetch();
  }

  async function handleRestore(userId: string) {
    await toggleUserStatus(userId);
    await refetch();
  }

  function openEdit(user: User) {
    setEditUser(user);
    const initialRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    setEditData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      roles: initialRoles,
      location_id: user.location_id || '',
      phone: user.phone || '',
    });
    setModalError('');
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setModalError('');
    setSubmitting(true);

    const effectiveRoles = Array.from(new Set([editData.role, ...editData.roles]));

    const result = await updateStaffUser(editUser.id, {
      full_name: editData.full_name,
      email: editData.email,
      role: editData.role,
      roles: effectiveRoles,
      location_id: editData.location_id || null,
      phone: editData.phone || null,
    });

    if (result.success) {
      setEditUser(null);
      await refetch();
    } else {
      setModalError(result.error || 'Failed to update staff member');
    }

    setSubmitting(false);
  }

  return (
    <>
      <Topbar title="Staff Management" />

      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.heading}>Staff Management</h2>
            <p className={styles.subheading}>
              Manage staff accounts, roles, and permissions across the organization
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isCeo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-navy)', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  style={{ accentColor: 'var(--color-navy)', width: '16px', height: '16px' }}
                />
                Show Deleted / Suspended
              </label>
            )}
            {isCeo && (
            <button className={styles.addBtn} onClick={() => { setModalError(''); setShowModal(true); }}>
              <span className={styles.addBtnIcon}>+</span>
              Add Staff
            </button>
            )}
          </div>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{users.length}</span>
            <span className={styles.statLabel}>Total Staff</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>
              {users.filter((u) => u.role === 'super_admin' || u.role === 'ceo').length}
            </span>
            <span className={styles.statLabel}>Admins/Execs</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>
              {users.filter((u) => u.role === 'sales_rep').length}
            </span>
            <span className={styles.statLabel}>Sales Reps</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>{users.filter(u => u.is_active !== false).length}</span>
            <span className={styles.statLabel}>Active</span>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Location</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                    No staff members found.
                  </td>
                </tr>
              ) : filteredUsers.map((user, index) => {
                const location = user.location_id
                  ? findLocationById(locations, user.location_id)
                  : null;

                const badgeClass =
                  ROLE_BADGE_CLASSES[user.role as UserRole] || 'badgeNavy';

                return (
                  <tr
                    key={user.id}
                    className={styles.row}
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    <td>
                      <div className={styles.nameContainer}>
                        <Link href={`/staff/${user.id}`} className={styles.nameCell}>
                          <div className={styles.avatar}>
                            {user.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className={styles.nameText}>{user.full_name}</span>
                        </Link>
                        {currentUser?.id !== user.id && (
                          <Link
                            href={`/chat?userId=${user.id}&user=${encodeURIComponent(user.full_name)}`}
                            prefetch={true}
                            className={styles.quickChatBtn}
                            title={`Chat with ${user.full_name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            💬
                          </Link>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className={styles.emailText}>{user.email}</span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                        {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r) => {
                          const bClass = ROLE_BADGE_CLASSES[r as UserRole] || 'badgeNavy';
                          return (
                            <span key={r} className={`${styles.roleBadge} ${styles[bClass]}`}>
                              {getRoleLabel(r as UserRole)}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td>
                      <span className={styles.locationText}>
                        {location ? location.name : 'All Locations'}
                      </span>
                    </td>

                    <td>
                      <span className={styles.phoneText}>
                        {user.phone || '\u2014'}
                      </span>
                    </td>

                    <td>
                      <span className={styles.statusBadge} style={{
                        background: user.is_active === false ? 'rgba(239,68,68,0.1)' : undefined,
                        color: user.is_active === false ? '#dc2626' : undefined
                      }}>
                        <span className={styles.statusDot} style={{
                          background: user.is_active === false ? '#dc2626' : undefined
                        }} />
                        {user.is_active === false ? 'Suspended' : 'Active'}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className={styles.editBtn} onClick={() => openEdit(user)}>Edit</button>
                        {currentUser?.id !== user.id && (
                          <Link
                            href={`/chat?userId=${user.id}`}
                            prefetch={true}
                            className={styles.editBtn}
                            style={{ textDecoration: 'none', color: 'var(--color-ocean)' }}
                            title="Chat with staff"
                          >
                            💬 Chat
                          </Link>
                        )}
                        {isCeo && user.is_active !== false && (
                          <button
                            className={styles.editBtn}
                            style={{ color: '#dc2626', background: 'rgba(239,68,68,0.1)' }}
                            onClick={() => handleSuspend(user.id)}
                          >
                            Suspend
                          </button>
                        )}
                        {isCeo && user.is_active === false && (
                          <button
                            className={styles.editBtn}
                            style={{ color: '#16a34a', background: 'rgba(34,197,94,0.1)' }}
                            onClick={() => handleRestore(user.id)}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => !submitting && setShowModal(false)}
        title="Add Staff Member"
        subtitle="Create a new user account. The user will receive their login credentials via email."
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {modalError && (
            <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#dc2626', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 500 }}>
              {modalError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Full Name</label>
            <input
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
              placeholder="e.g. Adaobi Okonkwo"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Email</label>
            <input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
              placeholder="e.g. adaobi@albionpharma.com"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Temporary Password</label>
            <input
              required
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
              placeholder="Temporary login password"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Primary Role</label>
            <select
              value={formData.role}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setFormData((prev) => ({
                  ...prev,
                  role: newRole,
                  roles: Array.from(new Set([newRole, ...prev.roles])),
                }));
              }}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' }}
            >
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>
                Concurrent / Additional Roles ({formData.roles.length})
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Multi-role access enabled
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '6px',
              maxHeight: '140px',
              overflowY: 'auto',
              padding: '8px',
              background: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}>
              {ALL_ROLES.map((r) => {
                const isChecked = formData.roles.includes(r.value);
                const isPrimary = formData.role === r.value;
                return (
                  <label
                    key={r.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      cursor: isPrimary ? 'default' : 'pointer',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      background: isChecked ? 'rgba(15, 118, 110, 0.08)' : 'transparent',
                      fontWeight: isChecked ? 600 : 400,
                      color: isChecked ? 'var(--color-navy)' : 'var(--color-slate)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isPrimary}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => {
                          const nextRoles = checked
                            ? [...prev.roles, r.value]
                            : prev.roles.filter((val) => val !== r.value);
                          return { ...prev, roles: nextRoles };
                        });
                      }}
                      style={{ accentColor: 'var(--color-navy)' }}
                    />
                    <span>{r.label}</span>
                    {isPrimary && (
                      <span style={{ fontSize: '0.65rem', background: '#0f766e', color: '#fff', padding: '1px 4px', borderRadius: '3px', marginLeft: 'auto' }}>
                        Primary
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Location</label>
            <select
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="">All Locations (Super Admin / CEO)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Phone</label>
            <input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowModal(false)}
              style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)', opacity: submitting ? 0.5 : 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: submitting ? '#6b7280' : 'var(--color-navy)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Creating...' : 'Create Staff'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editUser !== null}
        onClose={() => !submitting && setEditUser(null)}
        title={`Edit Staff Member`}
        subtitle={`Update details for ${editUser?.full_name || ''}`}
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {modalError && (
            <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#dc2626', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 500 }}>
              {modalError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Full Name</label>
            <input
              required
              value={editData.full_name}
              onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Email</label>
            <input
              required
              type="email"
              value={editData.email}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Primary Role</label>
            <select
              value={editData.role}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setEditData((prev) => ({
                  ...prev,
                  role: newRole,
                  roles: Array.from(new Set([newRole, ...prev.roles])),
                }));
              }}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' }}
            >
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.label ? r.value : r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>
                Concurrent / Additional Roles ({editData.roles.length})
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Multi-role access enabled
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '6px',
              maxHeight: '140px',
              overflowY: 'auto',
              padding: '8px',
              background: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}>
              {ALL_ROLES.map((r) => {
                const isChecked = editData.roles.includes(r.value);
                const isPrimary = editData.role === r.value;
                return (
                  <label
                    key={r.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      cursor: isPrimary ? 'default' : 'pointer',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      background: isChecked ? 'rgba(15, 118, 110, 0.08)' : 'transparent',
                      fontWeight: isChecked ? 600 : 400,
                      color: isChecked ? 'var(--color-navy)' : 'var(--color-slate)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isPrimary}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditData((prev) => {
                          const nextRoles = checked
                            ? [...prev.roles, r.value]
                            : prev.roles.filter((val) => val !== r.value);
                          return { ...prev, roles: nextRoles };
                        });
                      }}
                      style={{ accentColor: 'var(--color-navy)' }}
                    />
                    <span>{r.label}</span>
                    {isPrimary && (
                      <span style={{ fontSize: '0.65rem', background: '#0f766e', color: '#fff', padding: '1px 4px', borderRadius: '3px', marginLeft: 'auto' }}>
                        Primary
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Location</label>
            <select
              value={editData.location_id}
              onChange={(e) => setEditData({ ...editData, location_id: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="">All Locations (Super Admin / CEO)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Phone</label>
            <input
              value={editData.phone}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setEditUser(null)}
              style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)', opacity: submitting ? 0.5 : 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: submitting ? '#6b7280' : 'var(--color-navy)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
