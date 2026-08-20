'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useProducts, useLocations, useSuppliers } from '@/hooks/use-supabase-data';
import { MOCK_INVENTORY } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth-context';
import type { Supplier } from '@/lib/types';
import styles from './suppliers.module.css';

/* ── Toast state ── */

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

/* ── Blank form defaults ── */

const EMPTY_FORM = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
};

/* ═══════════════════════════════════════════════════════════════
   SupplierCard
═══════════════════════════════════════════════════════════════ */

function SupplierCard({
  supplier,
  canManage,
  onEdit,
  onDelete,
  onReceive,
}: {
  supplier: Supplier;
  canManage: boolean;
  onEdit: (s: Supplier) => void;
  onDelete: (s: Supplier) => void;
  onReceive: (s: Supplier) => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardAccent} />
      <div className={styles.cardBody}>
        <h3 className={styles.supplierName}>{supplier.name}</h3>
        <div className={styles.contactInfo}>
          {supplier.contact_person && (
            <div className={styles.contactRow}>
              <span className={styles.contactLabel}>Contact</span>
              <span className={styles.contactValue}>{supplier.contact_person}</span>
            </div>
          )}
          {supplier.phone && (
            <div className={styles.contactRow}>
              <span className={styles.contactLabel}>Phone</span>
              <span className={styles.contactValue}>{supplier.phone}</span>
            </div>
          )}
          {supplier.email && (
            <div className={styles.contactRow}>
              <span className={styles.contactLabel}>Email</span>
              <span className={styles.contactValue}>{supplier.email}</span>
            </div>
          )}
        </div>
        {supplier.address && (
          <p className={styles.address}>{supplier.address}</p>
        )}
      </div>
      <div className={styles.cardFooter}>
        {canManage && (
          <button className={styles.editBtn} onClick={() => onReceive(supplier)}>
            Receive Stock
          </button>
        )}
        {canManage && (
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button className={styles.editBtn} onClick={() => onEdit(supplier)}>Edit</button>
            <button className={styles.dangerBtn} onClick={() => onDelete(supplier)}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SuppliersPage
═══════════════════════════════════════════════════════════════ */

export default function SuppliersPage() {
  const { user: currentUser } = useAuth();
  const canManage = currentUser?.role === 'super_admin' || currentUser?.role === 'inventory_manager';

  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const { suppliers, loading, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();

  /* ── Add Supplier ── */
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  /* ── Edit Supplier ── */
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  /* ── Receive Stock ── */
  const [receiveSupplier, setReceiveSupplier] = useState<Supplier | null>(null);
  const [receiveForm, setReceiveForm] = useState({ product_id: '', quantity: 0, location_id: '' });
  const [receiving, setReceiving] = useState(false);

  const { products } = useProducts();
  const { locations } = useLocations();

  /* ── Search filter ── */

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q))
    );
  }, [search, suppliers]);

  /* ── Form handlers ── */

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setToast({ message: 'Supplier name is required.', type: 'error' }); return; }

    setSubmitting(true);
    const res = await addSupplier({
      name: form.name.trim(),
      contact_person: form.contact_person.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    });

    if (!res.success) {
      setToast({ message: res.error || 'Failed to create supplier', type: 'error' });
    } else {
      setToast({ message: `"${form.name.trim()}" added successfully.`, type: 'success' });
      setForm({ ...EMPTY_FORM });
      setShowModal(false);
    }
    setSubmitting(false);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSupplier) return;
    if (!editForm.name.trim()) { setToast({ message: 'Supplier name is required.', type: 'error' }); return; }

    const res = await updateSupplier(editSupplier.id, {
      name: editForm.name.trim(),
      contact_person: editForm.contact_person.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      address: editForm.address.trim(),
    });

    if (!res.success) {
      setToast({ message: res.error || 'Failed to update supplier', type: 'error' });
    } else {
      setToast({ message: 'Supplier updated successfully.', type: 'success' });
      setEditSupplier(null);
    }
  }

  async function handleDelete(supplier: Supplier) {
    const confirmed = window.confirm(`Delete supplier "${supplier.name}"? This will mark them as inactive.`);
    if (!confirmed) return;

    const res = await deleteSupplier(supplier.id);
    if (!res.success) {
      setToast({ message: res.error || 'Failed to deactivate supplier', type: 'error' });
    } else {
      setToast({ message: `"${supplier.name}" deactivated.`, type: 'info' });
    }
  }

  async function handleReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receiveSupplier) return;
    if (!receiveForm.product_id) { setToast({ message: 'Please select a product.', type: 'error' }); return; }
    if (!receiveForm.quantity || receiveForm.quantity <= 0) { setToast({ message: 'Quantity must be greater than 0.', type: 'error' }); return; }
    if (!receiveForm.location_id) { setToast({ message: 'Please select a warehouse location.', type: 'error' }); return; }

    setReceiving(true);

    const existingIndex = MOCK_INVENTORY.findIndex(
      (i) => i.product_id === receiveForm.product_id && i.location_id === receiveForm.location_id
    );
    if (existingIndex !== -1) {
      MOCK_INVENTORY[existingIndex].quantity += receiveForm.quantity;
      MOCK_INVENTORY[existingIndex].status =
        MOCK_INVENTORY[existingIndex].quantity === 0 ? 'out_of_stock' : MOCK_INVENTORY[existingIndex].quantity <= 50 ? 'low_stock' : 'in_stock';
    } else {
      MOCK_INVENTORY.push({
        id: `inv-${Date.now()}`,
        product_id: receiveForm.product_id,
        location_id: receiveForm.location_id,
        quantity: receiveForm.quantity,
        batch_number: `BATCH-${Date.now().toString().slice(-4)}`,
        expiry_date: '',
        status: receiveForm.quantity <= 50 ? 'low_stock' : 'in_stock',
      });
    }

    setToast({
      message: `Received ${receiveForm.quantity} units from "${receiveSupplier.name}".`,
      type: 'success',
    });
    setReceiveSupplier(null);
    setReceiveForm({ product_id: '', quantity: 0, location_id: '' });
    setReceiving(false);
  }

  /* ── Render ── */

  return (
    <>
      <Topbar title="Suppliers" />

      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search suppliers by name, contact, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {canManage && (
            <button className={styles.addBtn} onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true); }}>
              <span>＋</span>
              Add Supplier
            </button>
          )}
        </div>

        <p className={styles.resultsSummary}>
          Showing <span className={styles.resultsCount}>{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'supplier' : 'suppliers'}
          {search.trim() && ` matching "${search}"`}
        </p>

        <div className={styles.grid}>
          {loading ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>⏳</span>
              <h4 className={styles.emptyTitle}>Loading suppliers…</h4>
              <p className={styles.emptyText}>Fetching from the database.</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                canManage={canManage}
                onEdit={(s) => {
                  setEditSupplier(s);
                  setEditForm({
                    name: s.name,
                    contact_person: s.contact_person || '',
                    email: s.email || '',
                    phone: s.phone || '',
                    address: s.address || '',
                  });
                }}
                onDelete={handleDelete}
                onReceive={(s) => { setReceiveSupplier(s); setReceiveForm({ product_id: '', quantity: 0, location_id: '' }); }}
              />
            ))
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🏭</span>
              <h4 className={styles.emptyTitle}>No suppliers found</h4>
              <p className={styles.emptyText}>
                {search.trim() ? 'Try adjusting your search terms.' : 'Add your first supplier to get started.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Add Supplier Modal
      ════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Supplier"
        subtitle="Enter the supplier details below."
        maxWidth="620px"
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="sup-name">
              Supplier Name <span className={styles.required}>*</span>
            </label>
            <input
              id="sup-name" type="text" name="name"
              className={styles.formInput} placeholder="e.g. PharmaSource Ltd"
              value={form.name} onChange={handleChange} required autoFocus
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="sup-contact">
                Contact Person <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="sup-contact" type="text" name="contact_person"
                className={styles.formInput} placeholder="e.g. John Doe"
                value={form.contact_person} onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="sup-phone">
                Phone <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="sup-phone" type="text" name="phone"
                className={styles.formInput} placeholder="e.g. +234 800 000 0000"
                value={form.phone} onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="sup-email">
                Email <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="sup-email" type="email" name="email"
                className={styles.formInput} placeholder="e.g. contact@pharmasource.com"
                value={form.email} onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="sup-address">
              Address <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="sup-address" name="address"
              className={styles.formTextarea} placeholder="Supplier physical address…"
              value={form.address} onChange={handleChange} rows={2}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Adding…' : '＋ Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          Edit Supplier Modal
      ════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={editSupplier !== null}
        onClose={() => setEditSupplier(null)}
        title="Edit Supplier"
      >
        <form
          onSubmit={handleEditSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Name</label>
            <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Contact Person</label>
            <input value={editForm.contact_person} onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Phone</label>
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Email</label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Address</label>
            <textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', minHeight: '60px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setEditSupplier(null)} style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)' }}>Cancel</button>
            <button type="submit" style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: 'var(--color-navy)', color: '#fff', cursor: 'pointer' }}>Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          Receive Stock Modal
      ════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={receiveSupplier !== null}
        onClose={() => setReceiveSupplier(null)}
        title={`Receive Stock — ${receiveSupplier?.name || ''}`}
        subtitle="Record stock received from this supplier."
        maxWidth="520px"
      >
        <form className={styles.form} onSubmit={handleReceiveSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="rec-product">
              Product <span className={styles.required}>*</span>
            </label>
            <select
              id="rec-product"
              className={styles.formSelect}
              value={receiveForm.product_id}
              onChange={(e) => setReceiveForm({ ...receiveForm, product_id: e.target.value })}
              required
            >
              <option value="">— Select a product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="rec-qty">
                Quantity <span className={styles.required}>*</span>
              </label>
              <input
                id="rec-qty" type="number" name="quantity"
                className={styles.formInput}
                placeholder="0"
                value={receiveForm.quantity || ''}
                onChange={(e) => setReceiveForm({ ...receiveForm, quantity: parseInt(e.target.value) || 0 })}
                min={1} required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="rec-location">
                Warehouse <span className={styles.required}>*</span>
              </label>
              <select
                id="rec-location"
                className={styles.formSelect}
                value={receiveForm.location_id}
                onChange={(e) => setReceiveForm({ ...receiveForm, location_id: e.target.value })}
                required
              >
                <option value="">— Select location —</option>
                {locations.filter((l) => l.type === 'warehouse').map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {receiveForm.product_id && receiveForm.location_id && receiveForm.quantity > 0 && (
            <div className={styles.receiveSummary}>
              Receive <strong>{receiveForm.quantity}</strong> units into{' '}
              <strong>
                {locations.find((l) => l.id === receiveForm.location_id)?.name || ''}
              </strong>
              {' from '}
              <strong>{receiveSupplier?.name}</strong>.
            </div>
          )}

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setReceiveSupplier(null)} disabled={receiving}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={receiving}>
              {receiving ? 'Receiving…' : '✓ Receive Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
