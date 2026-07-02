'use client';

import { useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { useUsers, useLocations, findLocationById } from '@/hooks/use-supabase-data';
import { getRoleLabel, useAuth } from '@/lib/auth-context';
import { addStaffUser, toggleUserStatus, updateStaffUser } from '@/lib/data-service';
import type { UserRole, User } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import styles from './staff.module.css';

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  super_admin: 'badgeNavy',
  sales_rep: 'badgeOcean',
  finance_manager: 'badgeGreen',
  inventory_manager: 'badgeAmber',
  ceo: 'badgeGold',
};

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
    role: 'sales_rep' as UserRole,
    location_id: '',
    phone: '',
  });
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editData, setEditData] = useState({ full_name: '', email: '', role: '' as UserRole, location_id: '', phone: '' });

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

  const isCeo = currentUser?.role === 'ceo' || currentUser?.role === 'super_admin';
  const filteredUsers = showDeleted ? users : users.filter((u) => u.is_active !== false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    const result = await addStaffUser({
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role,
      location_id: formData.location_id || null,
      phone: formData.phone || null,
    });

    if (result.success) {
      setShowModal(false);
      setFormData({ email: '', full_name: '', role: 'sales_rep', location_id: '', phone: '' });
      await refetch();
    } else {
      setModalError(result.error || 'Failed to create staff member');
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
    setEditData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
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

    const result = await updateStaffUser(editUser.id, {
      full_name: editData.full_name,
      email: editData.email,
      role: editData.role,
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
                    </td>

                    <td>
                      <span className={styles.emailText}>{user.email}</span>
                    </td>

                    <td>
                      <span className={`${styles.roleBadge} ${styles[badgeClass]}`}>
                        {getRoleLabel(user.role as UserRole)}
                      </span>
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
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="sales_rep">Sales Representative</option>
              <option value="finance_manager">Finance Manager</option>
              <option value="inventory_manager">Inventory Manager</option>
              <option value="super_admin">Super Admin</option>
              <option value="ceo">CEO</option>
            </select>
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
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Role</label>
            <select
              value={editData.role}
              onChange={(e) => setEditData({ ...editData, role: e.target.value as UserRole })}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="sales_rep">Sales Representative</option>
              <option value="finance_manager">Finance Manager</option>
              <option value="inventory_manager">Inventory Manager</option>
              <option value="super_admin">Super Admin</option>
              <option value="ceo">CEO</option>
            </select>
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
