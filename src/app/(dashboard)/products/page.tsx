/**
 * @file ProductsPage — AlbionOS Product Catalog (Full CRUD)
 *
 * Displays the full catalog of Albion Pharmaceuticals products in a
 * responsive card grid. Users can search/filter products in real-time by
 * name, SKU, NAFDAC registration number, or category, and add new
 * products via a validated modal form.
 *
 * Key features:
 * ─────────────
 * - **Search bar** — Case-insensitive, multi-field live filter across
 *   name, SKU, NAFDAC number, and category.
 * - **Product cards** — Glassmorphic cards showing product name, category
 *   badge (colour-coded by type), SKU, NAFDAC number, and unit price in ₦.
 * - **Add Product modal** — Full form with validation for creating new
 *   products via the Supabase data hooks.
 * - **Toast notifications** — Success/error feedback after form submission.
 * - **Data refresh** — The `useProducts()` hook auto-refetches after
 *   mutations, so no manual refresh counter is needed.
 * - **Empty state** — Friendly message when no products match the query.
 *
 * All data flows through `@/hooks/use-supabase-data` — live Supabase
 * queries replace the former mock data-service layer.
 *
 * @module (dashboard)/products/page
 */

'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useProducts, type AddProductInput } from '@/hooks/use-supabase-data';
import { updateProduct } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import type { Product } from '@/lib/types';
import styles from './products.module.css';

// ═══════════════════════════════════════════════════════════════════════════
// ── Constants — Category dropdown options ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The six product categories available in the Albion catalog.
 * Used to populate the <select> dropdown in the Add Product form.
 * The `value` is stored in the database; the `label` is displayed to users.
 */
const CATEGORIES = [
  { value: 'injectable', label: 'Injectable' },
  { value: 'premix', label: 'Premix' },
  { value: 'bolus', label: 'Bolus' },
  { value: 'topical', label: 'Topical' },
  { value: 'feed_additive', label: 'Feed Additive' },
  { value: 'spray', label: 'Spray' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// ── Helpers — Formatting & category mapping ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formats a numeric amount as a Nigerian Naira string (no currency symbol).
 * Uses the `en-NG` locale for proper thousands separators (commas).
 *
 * @param amount - Raw numeric price, e.g. `12500`.
 * @returns Formatted string, e.g. `"12,500"`.
 */
function formatNaira(amount: number): string {
  return amount.toLocaleString('en-NG');
}

/**
 * Converts a category slug (from the database) to a human-readable label.
 * Falls back to the raw slug if no mapping exists.
 *
 * @param category - Slug such as `"feed_additive"` or `"injectable"`.
 * @returns Display label, e.g. `"Feed Additive"`.
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    injectable: 'Injectable',
    premix: 'Premix',
    feed_additive: 'Feed Additive',
    bolus: 'Bolus',
    topical: 'Topical',
    spray: 'Spray',
  };
  return labels[category] || category;
}

/**
 * Maps a category slug to its corresponding CSS module class for
 * colour-coded badges. Each category gets a unique badge colour:
 *   injectable → blue, premix → green, feed_additive → amber,
 *   bolus → indigo, topical → teal, spray → red.
 *
 * Falls back to `styles.categoryDefault` for unknown categories.
 *
 * @param category - Category slug, e.g. `"injectable"`.
 * @returns CSS module class name string.
 */
function getCategoryClass(category: string): string {
  const classes: Record<string, string> = {
    injectable: styles.categoryInjectable,
    premix: styles.categoryPremix,
    feed_additive: styles.categoryFeedAdditive,
    bolus: styles.categoryBolus,
    topical: styles.categoryTopical,
    spray: styles.categorySpray,
  };
  return classes[category] || styles.categoryDefault;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Toast state shape ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/** Shape for the toast notification state. Null means no toast visible. */
interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Initial form state — used for reset after submission ──────────────────
// ═══════════════════════════════════════════════════════════════════════════

/** Blank form values — used to initialise and reset the add product form. */
const EMPTY_FORM: AddProductInput = {
  name: '',
  sku: '',
  nafdac_number: '',
  unit_price: 0,
  category: 'injectable',
  description: undefined,
};

// ═══════════════════════════════════════════════════════════════════════════
// ── ProductCard — Individual product display card ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Renders a single product card within the catalog grid.
 *
 * Layout (top → bottom):
 *  1. **Accent bar** — Thin decorative top border for visual polish.
 *  2. **Card body** — Product name + category badge, followed by
 *     metadata rows for SKU and NAFDAC registration number.
 *  3. **Card footer** — Unit price (₦ prefix) and a "View" CTA button.
 *
 * @param product - Full `Product` object from the data service.
 */
function ProductCard({ product, onEdit, isSalesRep }: { product: Product; onEdit: (p: Product) => void; isSalesRep?: boolean }) {
  return (
    <div className={styles.card}>
      {/* Decorative accent bar at the top of each card */}
      <div className={styles.cardAccent} />

      <div className={styles.cardBody}>
        {/* ── Header: product name + colour-coded category badge ── */}
        <div className={styles.cardTop}>
          <h3 className={styles.productName}>{product.name}</h3>
          {/* Combine base badge class with category-specific colour class */}
          <span className={`${styles.categoryBadge} ${getCategoryClass(product.category)}`}>
            {getCategoryLabel(product.category)}
          </span>
        </div>

        {/* ── Meta rows: SKU and NAFDAC registration number ── */}
        <div className={styles.metaList}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>SKU</span>
            <span className={styles.metaValue}>{product.sku}</span>
          </div>
          <div className={styles.metaItem}>
            {/* NAFDAC = National Agency for Food and Drug Admin and Control (Nigeria) */}
            <span className={styles.metaLabel}>NAFDAC</span>
            <span className={styles.metaValue}>{product.nafdac_number}</span>
          </div>
        </div>
      </div>

      {/* ── Footer: price display + action button ── */}
      <div className={styles.cardFooter}>
        <span className={styles.price}>
          {/* Currency symbol rendered separately for distinct styling */}
          <span className={styles.priceCurrency}>₦</span>
          {formatNaira(product.unit_price)}
        </span>
        {!isSalesRep && (
          <button className={styles.viewBtn} onClick={() => onEdit(product)}>Edit</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ProductsPage — Exported page component ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Product Catalog page — lists all Albion pharmaceutical products with
 * real-time search filtering, a responsive card grid, and a fully
 * functional "Add Product" modal form.
 *
 * **Data refresh pattern:**
 * The `useProducts()` hook fetches products from Supabase on mount and
 * auto-refetches after `addProduct()` mutations. No manual refresh
 * counter is needed.
 *
 * **Search behaviour:**
 * The `filtered` memo performs a case-insensitive substring match across
 * four product fields: `name`, `sku`, `nafdac_number`, and `category`.
 *
 * **Form validation:**
 * Client-side validation checks all required fields before calling
 * `addProduct()`. Supabase performs additional server-side validation
 * (unique constraints, RLS policies, etc.).
 */
export default function ProductsPage() {
  // ── Core state ──

  const { user: currentUser } = useAuth();
  const isCeo = currentUser?.role === 'ceo';

  /** Controlled search input state — drives the `filtered` memo. */
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  /**
   * Supabase-backed product data.
   * `products` — the full product list, fetched from the `products` table.
   * `loading`  — true while the initial fetch is in progress.
   * `addProduct` — async mutation; auto-refetches the list on success.
   */
  const { products, loading, addProduct } = useProducts(isCeo);

  /** Modal visibility toggle — true when the Add Product form is open. */
  const [showModal, setShowModal] = useState(false);

  /** Toast notification state — null when no toast is visible. */
  const [toast, setToast] = useState<ToastState | null>(null);

  /**
   * Form data state — holds all field values for the Add Product form.
   * Initialised to EMPTY_FORM and reset after each successful submission.
   */
  const [form, setForm] = useState<AddProductInput>({ ...EMPTY_FORM });

  /** Tracks whether the form is mid-submission (prevents double-clicks). */
  const [submitting, setSubmitting] = useState(false);

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', sku: '', nafdac_number: '', unit_price: 0, category: '', description: '' });

  // ── Derived data ──

  const displayProducts = useMemo(() => {
    return products.filter(p => {
      if (isCeo && showDeleted) return true;
      return p.is_active !== false;
    });
  }, [products, isCeo, showDeleted]);

  /**
   * Filtered product list, recomputed when `search` or `products` changes.
   * Returns the full list when the search input is blank.
   * Matches case-insensitively across name, SKU, NAFDAC number, & category.
   */
  const filtered = useMemo(() => {
    if (!search.trim()) return displayProducts;
    const q = search.toLowerCase();
    return displayProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.nafdac_number.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [search, displayProducts]);

  // ── Form handlers ──

  /**
   * Generic change handler for text/number/select/textarea inputs.
   * Updates the corresponding field in the `form` state object.
   *
   * Special handling:
   * - `sku` field: auto-uppercased as the user types.
   * - `unit_price` field: parsed as a float (NaN → 0).
   */
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;

    setForm((prev) => {
      /* SKU — force uppercase for consistent formatting (ALB-XXX-NNN) */
      if (name === 'sku') {
        return { ...prev, sku: value.toUpperCase() };
      }

      /* Unit price — parse to number, default to 0 if invalid */
      if (name === 'unit_price') {
        return { ...prev, unit_price: parseFloat(value) || 0 };
      }

      /* Description — store undefined instead of empty string */
      if (name === 'description') {
        return { ...prev, description: value || undefined };
      }

      /* All other fields — store as-is */
      return { ...prev, [name]: value };
    });
  }

  /**
   * Form submission handler — validates, calls addProduct(), and handles
   * the success/error response with toast notifications.
   *
   * Flow:
   *   1. Prevent default form submission (SPA — no page reload).
   *   2. Client-side validation for required fields.
   *   3. Call `await addProduct()` — async Supabase insert.
   *   4. On success: show success toast, reset form, close modal.
   *      The hook auto-refetches the product list.
   *   5. On error: show error toast with the Supabase error message.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ── Client-side validation ──
    if (!form.name.trim()) {
      setToast({ message: 'Product name is required.', type: 'error' });
      return;
    }
    if (!form.sku.trim()) {
      setToast({ message: 'SKU is required.', type: 'error' });
      return;
    }
    if (!form.nafdac_number?.trim()) {
      setToast({ message: 'NAFDAC number is required.', type: 'error' });
      return;
    }
    if (!form.unit_price || form.unit_price <= 0) {
      setToast({ message: 'Unit price must be greater than ₦0.', type: 'error' });
      return;
    }
    if (!form.category) {
      setToast({ message: 'Please select a category.', type: 'error' });
      return;
    }

    // ── Submit to Supabase via the useProducts() hook ──
    setSubmitting(true);
    const result = await addProduct(form);

    if (result.success) {
      /* Success — show toast, reset form, close modal.
         The hook auto-refetches the product list after insert. */
      setToast({
        message: `"${result.data!.name}" added to catalog successfully!`,
        type: 'success',
      });
      setForm({ ...EMPTY_FORM }); // Reset form to blank state
      setShowModal(false); // Close the modal
    } else {
      /* Error — show the Supabase error message */
      setToast({ message: result.error || 'Failed to add product.', type: 'error' });
    }

    setSubmitting(false);
  }

  /**
   * Opens the Add Product modal and resets the form to a clean state.
   * This ensures stale data from a previous (cancelled) form doesn't
   * persist when the user opens the modal again.
   */
  function openModal() {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  /**
   * Closes the Add Product modal. Form data is NOT cleared here — it's
   * cleared when the modal is re-opened via `openModal()`.
   */
  function closeModal() {
    setShowModal(false);
  }

  // ── Render ──

  return (
    <>
      <Topbar title="Product Catalog" />

      <div className={styles.page}>
        {/* ── Toolbar: search input + "Add Product" button ── */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search products by name, SKU, or NAFDAC number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                Show Deleted
              </label>
            )}
            {!isCeo && currentUser?.role !== 'sales_rep' && (
              <button className={styles.addBtn} onClick={openModal}>
                <span>＋</span>
                Add Product
              </button>
            )}
          </div>
        </div>

        {/* ── Results summary: "Showing X products [matching "query"]" ── */}
        <p className={styles.resultsSummary}>
          Showing <span className={styles.resultsCount}>{filtered.length}</span>{' '}
          {/* Singular/plural: "1 product" vs "5 products" */}
          {filtered.length === 1 ? 'product' : 'products'}
          {/* Append the search term only when the user has typed something */}
          {search.trim() && ` matching "${search}"`}
        </p>

        {/* ── Loading State / Product Grid / Empty State ── */}
        <div className={styles.grid}>
          {loading ? (
            /* Loading spinner while Supabase fetch is in progress */
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>⏳</span>
              <h4 className={styles.emptyTitle}>Loading products…</h4>
              <p className={styles.emptyText}>Fetching catalog from the database.</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((product) => (
              <ProductCard key={product.id} product={product} onEdit={(p) => { setEditProduct(p); setEditForm({ name: p.name, sku: p.sku, nafdac_number: p.nafdac_number, unit_price: p.unit_price, category: p.category, description: p.description || '' }); }} isSalesRep={currentUser?.role === 'sales_rep'} />
            ))
          ) : (
            /* Empty state shown when no products match the search query */
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📦</span>
              <h4 className={styles.emptyTitle}>No products found</h4>
              <p className={styles.emptyText}>
                Try adjusting your search terms or add a new product.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ── Add Product Modal ──────────────────────────────────────────────
          A glassmorphic modal with a validated form for adding new products
          to the Albion catalog. All fields flow through controlled state.
          ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Add New Product"
        subtitle="Enter the product details below. All fields marked with * are required."
        maxWidth="620px"
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* ── Row 1: Product Name (full width) ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="product-name">
              Product Name <span className={styles.required}>*</span>
            </label>
            <input
              id="product-name"
              type="text"
              name="name"
              className={styles.formInput}
              placeholder="e.g. Albendazole 2500mg Bolus"
              value={form.name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          {/* ── Row 2: SKU + Category (side by side) ── */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="product-sku">
                SKU <span className={styles.required}>*</span>
              </label>
              <input
                id="product-sku"
                type="text"
                name="sku"
                className={styles.formInput}
                placeholder="ALB-XXX-NNN"
                value={form.sku}
                onChange={handleChange}
                required
              />
              {/* Format hint below the SKU input */}
              <span className={styles.formHint}>Format: ALB-XXX-NNN (auto-uppercased)</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="product-category">
                Category <span className={styles.required}>*</span>
              </label>
              <select
                id="product-category"
                name="category"
                className={styles.formSelect}
                value={form.category}
                onChange={handleChange}
                required
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Row 3: NAFDAC Number + Unit Price (side by side) ── */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="product-nafdac">
                NAFDAC Number <span className={styles.required}>*</span>
              </label>
              <input
                id="product-nafdac"
                type="text"
                name="nafdac_number"
                className={styles.formInput}
                placeholder="NAFDAC/VET/YYYY/NNNN"
                value={form.nafdac_number}
                onChange={handleChange}
                required
              />
              {/* Format hint for NAFDAC registration numbers */}
              <span className={styles.formHint}>Format: NAFDAC/VET/YYYY/NNNN</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="product-price">
                Unit Price (₦) <span className={styles.required}>*</span>
              </label>
              <input
                id="product-price"
                type="number"
                name="unit_price"
                className={styles.formInput}
                placeholder="0.00"
                value={form.unit_price || ''}
                onChange={handleChange}
                min="1"
                step="0.01"
                required
              />
            </div>
          </div>

          {/* ── Row 4: Description (full width textarea, optional) ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="product-description">
              Description <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="product-description"
              name="description"
              className={styles.formTextarea}
              placeholder="Brief product description, usage instructions, or notes…"
              value={form.description || ''}
              onChange={handleChange}
              rows={3}
            />
          </div>

          {/* ── Form actions: Cancel + Submit buttons ── */}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={closeModal}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? 'Adding…' : '＋ Add Product'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editProduct !== null}
        onClose={() => setEditProduct(null)}
        title="Edit Product"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editProduct) return;
            const result = await updateProduct(editProduct.id, {
              name: editForm.name,
              sku: editForm.sku,
              nafdac_number: editForm.nafdac_number,
              unit_price: editForm.unit_price,
              category: editForm.category,
              description: editForm.description || null,
            });
            if (result.success) {
              setEditProduct(null);
              setToast({ message: 'Product updated successfully', type: 'success' });
            } else {
              setToast({ message: result.error || 'Failed to update', type: 'error' });
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Name</label>
            <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>SKU</label>
            <input required value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>NAFDAC Number</label>
            <input required value={editForm.nafdac_number} onChange={(e) => setEditForm({ ...editForm, nafdac_number: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Unit Price (₦)</label>
            <input type="number" min={0} required value={editForm.unit_price} onChange={(e) => setEditForm({ ...editForm, unit_price: Number(e.target.value) })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Category</label>
            <input required value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Description</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', minHeight: '80px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setEditProduct(null)} style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)' }}>Cancel</button>
            <button type="submit" style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: 'var(--color-navy)', color: '#fff', cursor: 'pointer' }}>Save Changes</button>
          </div>
        </form>
      </Modal>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
