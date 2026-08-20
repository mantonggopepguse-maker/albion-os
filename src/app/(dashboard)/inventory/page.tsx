/**
 * @file InventoryPage — Inventory Management with Allocate Stock form
 *
 * Displays inventory across warehouse, rep allocations, and expiring items.
 * Includes a stock allocation modal that transfers product batches between locations.
 *
 * Features:
 *   - Three tabs: Warehouse Stock, Rep Allocations, Expiring Soon
 *   - Colour-coded expiry date warnings (red <30d, yellow <60d, green ≥60d)
 *   - Status badges (in_stock, low_stock, out_of_stock, expired)
 *   - Allocate Stock form with dynamic batch filtering and quantity validation
 *
 * @module (dashboard)/inventory/page
 */
'use client';

import { useState, useMemo, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import {
  useInventory, useProducts, useLocations,
  findProductById, findLocationById,
} from '@/hooks/use-supabase-data';
import { stockTake } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import styles from './inventory.module.css';

/* ── Tab definitions ── */
const TABS = [
  { key: 'warehouse', label: 'Warehouse Stock' },
  { key: 'reps', label: 'Rep Allocations' },
  { key: 'expiring', label: 'Expiring Soon' },
] as const;

type TabKey = typeof TABS[number]['key'];

/* ── Helper: days until expiry ── */
function getDaysUntilExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

/* ── Helper: expiry colour class ── */
function getExpiryClass(days: number): string {
  if (days < 0) return styles.expiryExpired;
  if (days < 30) return styles.expiryDanger;
  if (days < 60) return styles.expiryWarning;
  return styles.expirySafe;
}

/* ── Helper: status badge ── */
function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    in_stock: styles.statusGreen,
    low_stock: styles.statusYellow,
    out_of_stock: styles.statusRed,
    expired: styles.statusRed,
  };
  return map[status] || '';
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    in_stock: 'In Stock',
    low_stock: 'Low Stock',
    out_of_stock: 'Out of Stock',
    expired: 'Expired',
  };
  return map[status] || status;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const isCeo = user?.role === 'ceo';

  /* ── State ── */
  const [activeTab, setActiveTab] = useState<TabKey>('warehouse');
  const [showModal, setShowModal] = useState(false);
  const [showStockTakeModal, setShowStockTakeModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  /* ── Stock take state ── */
  const [stockTakeEntries, setStockTakeEntries] = useState<Record<string, string>>({});
  const [stockTakeSubmitting, setStockTakeSubmitting] = useState(false);

  /* ── Allocate form state ── */
  const [fromLocation, setFromLocation] = useState('');
  const [productId, setProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [allocateQty, setAllocateQty] = useState(1);
  const [toLocation, setToLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Data from Supabase hooks ── */
  const { inventory, allocateStock, refetch } = useInventory();
  const { products } = useProducts();
  const { locations } = useLocations();

  /* ── Location lists for the form dropdowns ── */
  const warehouses = useMemo(() => locations.filter((l) => l.type === 'warehouse'), [locations]);
  const territories = useMemo(() => locations.filter((l) => l.type === 'territory'), [locations]);

  /* ── Filtered inventory based on active tab ── */
  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'warehouse':
        return inventory.filter((item) => {
          const loc = findLocationById(locations, item.location_id);
          return loc?.type === 'warehouse';
        });
      case 'reps':
        return inventory.filter((item) => {
          const loc = findLocationById(locations, item.location_id);
          if (user?.role === 'sales_rep') {
            return item.location_id === user?.location_id;
          }
          return loc?.type === 'territory';
        });
      case 'expiring':
        return inventory
          .filter((item) => {
            const days = getDaysUntilExpiry(item.expiry_date);
            return days > 0 && days <= 90;
          })
          .sort((a, b) => getDaysUntilExpiry(a.expiry_date) - getDaysUntilExpiry(b.expiry_date));
      default:
        return inventory;
    }
  }, [inventory, locations, activeTab]);

  /* ── Dynamic batch filtering for the allocate form ──
     When user selects a product and warehouse, show only
     batches of that product available at that warehouse */
  const availableBatches = useMemo(() => {
    if (!fromLocation || !productId) return [];
    return inventory.filter(
      (item) =>
        item.product_id === productId &&
        item.location_id === fromLocation &&
        item.quantity > 0
    );
  }, [inventory, fromLocation, productId]);

  /* ── Available quantity for the selected batch ── */
  const selectedBatch = useMemo(
    () => availableBatches.find((b) => b.batch_number === batchNumber),
    [availableBatches, batchNumber]
  );

  /* ── Tab title mapping ── */
  const tabTitles: Record<TabKey, string> = {
    warehouse: 'Onitsha HQ — Warehouse Stock',
    reps: 'Sales Rep Allocations',
    expiring: 'Stock Expiring Within 90 Days',
  };

  /* ── Reset form ── */
  const resetForm = useCallback(() => {
    setFromLocation(warehouses[0]?.id || '');
    setProductId('');
    setBatchNumber('');
    setAllocateQty(1);
    setToLocation('');
  }, [warehouses]);

  /* ── Open modal ── */
  const openModal = useCallback(() => {
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  /* ── Form submission (async — writes to Supabase) ── */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId) { setToast({ message: 'Please select a product', type: 'error' }); return; }
    if (!batchNumber) { setToast({ message: 'Please select a batch', type: 'error' }); return; }
    if (!toLocation) { setToast({ message: 'Please select a destination', type: 'error' }); return; }
    if (allocateQty <= 0) { setToast({ message: 'Quantity must be > 0', type: 'error' }); return; }
    if (selectedBatch && allocateQty > selectedBatch.quantity) {
      setToast({ message: `Max available: ${selectedBatch.quantity} units`, type: 'error' });
      return;
    }

    setIsSubmitting(true);

    const result = await allocateStock({
      product_id: productId,
      from_location_id: fromLocation,
      to_location_id: toLocation,
      quantity: allocateQty,
      batch_number: batchNumber,
    });

    if (result.success) {
      const product = findProductById(products, productId);
      const dest = findLocationById(locations, toLocation);
      setToast({
        message: `${allocateQty} units of ${product?.name || 'product'} allocated to ${dest?.name || 'destination'}`,
        type: 'success',
      });
      setShowModal(false);
    } else {
      setToast({ message: result.error || 'Allocation failed', type: 'error' });
    }
    setIsSubmitting(false);
  }, [productId, batchNumber, toLocation, allocateQty, fromLocation, selectedBatch, products, locations, allocateStock]);

  /* ── Stock Take ── */
  const stockTakeItems = useMemo(() =>
    inventory.filter((item) => {
      if (user?.role === 'sales_rep') {
        return item.location_id === user?.location_id;
      }
      const loc = findLocationById(locations, item.location_id);
      return loc?.type === 'warehouse';
    }),
    [inventory, locations, user]
  );

  const openStockTake = useCallback(() => {
    const entries: Record<string, string> = {};
    stockTakeItems.forEach((item) => { entries[item.id] = String(item.quantity); });
    setStockTakeEntries(entries);
    setShowStockTakeModal(true);
  }, [stockTakeItems]);

  const handleStockTakeSubmit = useCallback(async () => {
    setStockTakeSubmitting(true);
    let updated = 0;
    let errors = 0;

    for (const item of stockTakeItems) {
      const actual = parseInt(stockTakeEntries[item.id] ?? String(item.quantity), 10);
      if (isNaN(actual) || actual === item.quantity) continue;

      const result = await stockTake({ inventory_id: item.id, actual_quantity: actual });
      if (result.success) {
        updated++;
      } else {
        errors++;
      }
    }

    setStockTakeSubmitting(false);
    setShowStockTakeModal(false);

    if (errors === 0) {
      setToast({ message: `Stock take complete — ${updated} item(s) adjusted`, type: 'success' });
      if (updated > 0) refetch();
    } else {
      setToast({ message: `${updated} updated, ${errors} error(s)`, type: 'error' });
      refetch();
    }
  }, [stockTakeItems, stockTakeEntries, refetch]);

  return (
    <>
      <Topbar title="Inventory" />
      <div className={styles.page}>
        {/* ── Tab bar ── */}
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className={styles.toolbar}>
          <h3 className={styles.tableTitle}>{tabTitles[activeTab]}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.stockTakeBtn} onClick={openStockTake}>
              📋 Stock Take
            </button>
            {!isCeo && user?.role !== 'sales_rep' && (
              <button className={styles.allocateBtn} onClick={openModal}>
                📦 Allocate Stock
              </button>
            )}
          </div>
        </div>

        {/* ── Inventory table ── */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Batch Number</th>
                <th>Quantity</th>
                <th>Expiry Date</th>
                <th>Status</th>
                {activeTab === 'reps' && <th>Location</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'reps' ? 6 : 5} className={styles.emptyState}>
                    <span>📦</span>
                    <p>No inventory items in this view</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const product = findProductById(products, item.product_id);
                  const days = getDaysUntilExpiry(item.expiry_date);
                  const location = findLocationById(locations, item.location_id);
                  return (
                    <tr key={item.id} className={styles.row}>
                      <td>
                        <div className={styles.productCell}>
                          <span className={styles.productName}>{product?.name || 'Unknown'}</span>
                          <span className={styles.productSku}>{product?.sku || ''}</span>
                        </div>
                      </td>
                      <td className={styles.batchCell}>{item.batch_number}</td>
                      <td className={`${styles.qtyCell} ${item.status === 'low_stock' ? styles.qtyLow : ''}`}>
                        {item.quantity.toLocaleString('en-NG')}
                      </td>
                      <td>
                        <div className={styles.expiryCell}>
                          <span>{new Date(item.expiry_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span className={`${styles.expiryBadge} ${getExpiryClass(days)}`}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                      {activeTab === 'reps' && (
                        <td className={styles.locationCell}>{location?.name || '—'}</td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className={styles.tableFooter}>
            Showing {filtered.length} of {inventory.length} items
          </div>
        </div>

        {/* ── Allocate Stock Modal ── */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Allocate Stock"
          subtitle="Transfer product batches from warehouse to a territory."
        >
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Source warehouse */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Source Warehouse *</label>
              <select
                className={styles.formSelect}
                value={fromLocation}
                onChange={(e) => {
                  setFromLocation(e.target.value);
                  setBatchNumber(''); // Reset batch when warehouse changes
                }}
                required
              >
                <option value="">Select warehouse…</option>
                {warehouses.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Product *</label>
              <select
                className={styles.formSelect}
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setBatchNumber(''); // Reset batch when product changes
                }}
                required
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            {/* Batch (dynamic) */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Batch Number *</label>
              {availableBatches.length === 0 && fromLocation && productId ? (
                <p className={styles.noBatch}>No batches available for this product at the selected warehouse.</p>
              ) : (
                <select
                  className={styles.formSelect}
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  required
                  disabled={availableBatches.length === 0}
                >
                  <option value="">Select batch…</option>
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.batch_number}>
                      {b.batch_number} — {b.quantity} units (expires {new Date(b.expiry_date).toLocaleDateString('en-NG')})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Available quantity display */}
            {selectedBatch && (
              <div className={styles.availableInfo}>
                Available: <strong>{selectedBatch.quantity} units</strong>
              </div>
            )}

            {/* Quantity */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Quantity to Allocate *</label>
              <input
                type="number"
                className={styles.formInput}
                value={allocateQty}
                onChange={(e) => setAllocateQty(parseInt(e.target.value) || 0)}
                min={1}
                max={selectedBatch?.quantity || 99999}
                required
              />
            </div>

            {/* Destination */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Destination Territory *</label>
              <select
                className={styles.formSelect}
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                required
              >
                <option value="">Select territory…</option>
                {territories.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Allocating…' : 'Allocate Stock'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Stock Take Modal ── */}
        <Modal
          isOpen={showStockTakeModal}
          onClose={() => !stockTakeSubmitting && setShowStockTakeModal(false)}
          title={user?.role === 'sales_rep' ? "Territory Stock Take" : "Warehouse Stock Take"}
          subtitle={user?.role === 'sales_rep' ? "Enter actual quantities for your territory stock. Items with changes will be adjusted." : "Enter actual quantities for warehouse stock. Items with changes will be adjusted."}
          maxWidth="800px"
        >
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1rem' }}>
            <table className={styles.table} style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Current Qty</th>
                  <th>Actual Qty</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {stockTakeItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyState} style={{ padding: '2rem' }}>
                      <span>📦</span>
                      <p>No warehouse stock to count</p>
                    </td>
                  </tr>
                ) : (
                  stockTakeItems.map((item) => {
                    const product = findProductById(products, item.product_id);
                    const actual = parseInt(stockTakeEntries[item.id] ?? String(item.quantity), 10);
                    const diff = isNaN(actual) ? 0 : actual - item.quantity;
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className={styles.productName}>{product?.name || 'Unknown'}</span>
                        </td>
                        <td className={styles.batchCell}>{item.batch_number}</td>
                        <td className={styles.qtyCell}>{item.quantity.toLocaleString('en-NG')}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            value={stockTakeEntries[item.id] ?? String(item.quantity)}
                            onChange={(e) => setStockTakeEntries({ ...stockTakeEntries, [item.id]: e.target.value })}
                            style={{
                              width: '100px',
                              padding: '4px 8px',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                            }}
                          />
                        </td>
                        <td style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: diff === 0 ? 'var(--color-gray)' : diff > 0 ? '#16a34a' : '#dc2626',
                        }}>
                          {diff === 0 ? '—' : diff > 0 ? `+${diff}` : String(diff)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setShowStockTakeModal(false)}
              disabled={stockTakeSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleStockTakeSubmit}
              disabled={stockTakeSubmitting}
            >
              {stockTakeSubmitting ? 'Saving…' : 'Save Adjustments'}
            </button>
          </div>
        </Modal>

        {/* ── Toast ── */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </>
  );
}
