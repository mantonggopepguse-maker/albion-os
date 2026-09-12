/**
 * @file InventoryPage — Enterprise Scoped Inventory Management & Stock Operations
 *
 * Scopes stock access:
 *   - Field Sales Reps strictly see their assigned territory stock.
 *   - Clinic personnel strictly see their clinic branch stock.
 *   - Warehouse Manager & Executives see all warehouses, allocations, and requests.
 *
 * Features:
 *   - Role-based tab filtering (Warehouse, Rep Allocations, Clinic Stock, Requests, Expiring)
 *   - Field restock requests & stock returns with 1-click Warehouse Manager approval
 *   - Batch Price Editor for updating product catalog unit prices
 *   - Product Recall capability for instant batch quarantine with immutable audit log
 *   - Physical stock take modal with delta calculations
 *
 * @module (dashboard)/inventory/page
 */
'use client';

import { useState, useMemo, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import {
  useInventory,
  useProducts,
  useLocations,
  useStaffRequests,
  findProductById,
  findLocationById,
} from '@/hooks/use-supabase-data';
import { stockTake, recallProductBatch, batchUpdateProductPrices } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import styles from './inventory.module.css';

/* ── Helper: days until expiry ── */
function getDaysUntilExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

function getExpiryClass(days: number): string {
  if (days < 0) return styles.expiryExpired;
  if (days < 30) return styles.expiryDanger;
  if (days < 60) return styles.expiryWarning;
  return styles.expirySafe;
}

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
    expired: 'Quarantined / Expired',
  };
  return map[status] || status;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const isCeo = user?.role === 'ceo';
  const isSalesRep = user?.role === 'sales_rep';
  const isClinicRole = ['clinic_admin', 'vet', 'vet_tech', 'receptionist'].includes(user?.role || '');
  const isInventoryManager = user?.role === 'inventory_manager' || user?.role === 'super_admin';

  /* ── Tab definitions based on role ── */
  const tabs = useMemo(() => {
    if (isSalesRep) {
      return [
        { key: 'my_stock', label: 'My Territory Stock' },
        { key: 'expiring', label: 'Expiring Soon' },
      ];
    }
    if (isClinicRole) {
      return [
        { key: 'clinic_stock', label: 'Clinic Branch Stock' },
        { key: 'expiring', label: 'Expiring Soon' },
      ];
    }
    return [
      { key: 'warehouse', label: 'Warehouse Stock' },
      { key: 'reps', label: 'Rep Allocations' },
      { key: 'clinics', label: 'Clinic Inventories' },
      { key: 'requests', label: 'Restock & Return Requests' },
      { key: 'expiring', label: 'Expiring Soon' },
    ];
  }, [isSalesRep, isClinicRole]);

  const [activeTab, setActiveTab] = useState<string>(
    isSalesRep ? 'my_stock' : isClinicRole ? 'clinic_stock' : 'warehouse'
  );

  /* ── Modals & Notifications state ── */
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showStockTakeModal, setShowStockTakeModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  /* ── Stock take state ── */
  const [stockTakeEntries, setStockTakeEntries] = useState<Record<string, string>>({});
  const [stockTakeSubmitting, setStockTakeSubmitting] = useState(false);

  /* ── Allocate form state ── */
  const [fromLocation, setFromLocation] = useState('');
  const [allocateProductId, setAllocateProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [allocateQty, setAllocateQty] = useState(1);
  const [toLocation, setToLocation] = useState('');
  const [allocateSubmitting, setAllocateSubmitting] = useState(false);

  /* ── Restock Request Form State ── */
  const [reqProduct, setReqProduct] = useState('');
  const [reqQty, setReqQty] = useState(20);
  const [reqUrgency, setReqUrgency] = useState<'normal' | 'urgent'>('normal');
  const [reqReason, setReqReason] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);

  /* ── Return Stock Form State ── */
  const [retProduct, setRetProduct] = useState('');
  const [retBatch, setRetBatch] = useState('');
  const [retQty, setRetQty] = useState(5);
  const [retCondition, setRetCondition] = useState<'excess' | 'damaged' | 'near_expiry'>('excess');
  const [retReason, setRetReason] = useState('');
  const [retSubmitting, setRetSubmitting] = useState(false);

  /* ── Recall Modal State ── */
  const [recallBatch, setRecallBatch] = useState('');
  const [recallReason, setRecallReason] = useState('');
  const [recallSubmitting, setRecallSubmitting] = useState(false);

  /* ── Price Editor State ── */
  const [priceUpdates, setPriceUpdates] = useState<Record<string, number>>({});
  const [priceSubmitting, setPriceSubmitting] = useState(false);

  /* ── Data from Supabase hooks ── */
  const { inventory, allocateStock, refetch } = useInventory();
  const { products } = useProducts();
  const { locations } = useLocations();
  const { requests, createRequest, updateStatus } = useStaffRequests(user?.id, user?.role);

  const warehouses = useMemo(() => locations.filter((l) => l.type === 'warehouse'), [locations]);
  const territories = useMemo(() => locations.filter((l) => l.type === 'territory'), [locations]);

  /* ── Filtered inventory based on active tab & user role ── */
  const filtered = useMemo(() => {
    // 1. If Sales Rep: strictly scoped to rep location
    if (isSalesRep) {
      const repStock = inventory.filter((item) => item.location_id === user?.location_id);
      if (activeTab === 'expiring') {
        return repStock
          .filter((item) => {
            const days = getDaysUntilExpiry(item.expiry_date);
            return days > 0 && days <= 90;
          })
          .sort((a, b) => getDaysUntilExpiry(a.expiry_date) - getDaysUntilExpiry(b.expiry_date));
      }
      return repStock;
    }

    // 2. If Clinic Role: strictly scoped to clinic branch location
    if (isClinicRole) {
      const clinicStock = inventory.filter((item) => item.location_id === user?.location_id);
      if (activeTab === 'expiring') {
        return clinicStock
          .filter((item) => {
            const days = getDaysUntilExpiry(item.expiry_date);
            return days > 0 && days <= 90;
          })
          .sort((a, b) => getDaysUntilExpiry(a.expiry_date) - getDaysUntilExpiry(b.expiry_date));
      }
      return clinicStock;
    }

    // 3. Manager / Executive view
    switch (activeTab) {
      case 'warehouse':
        return inventory.filter((item) => {
          const loc = findLocationById(locations, item.location_id);
          return loc?.type === 'warehouse';
        });
      case 'reps':
        return inventory.filter((item) => {
          const loc = findLocationById(locations, item.location_id);
          return loc?.type === 'territory';
        });
      case 'clinics':
        return inventory.filter((item) => {
          const loc = findLocationById(locations, item.location_id);
          return loc?.type === 'clinic';
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
  }, [inventory, locations, activeTab, isSalesRep, isClinicRole, user?.location_id]);

  /* ── Filtered requests for the Requests Tab ── */
  const inventoryRequests = useMemo(() => {
    return requests.filter((r) => r.type === 'restock' || r.type === 'return');
  }, [requests]);

  /* ── Dynamic batch filtering for allocate form ── */
  const availableBatches = useMemo(() => {
    if (!fromLocation || !allocateProductId) return [];
    return inventory.filter(
      (item) =>
        item.product_id === allocateProductId &&
        item.location_id === fromLocation &&
        item.quantity > 0
    );
  }, [inventory, fromLocation, allocateProductId]);

  const selectedBatch = useMemo(
    () => availableBatches.find((b) => b.batch_number === batchNumber),
    [availableBatches, batchNumber]
  );

  /* ── Form actions ── */
  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setAllocateSubmitting(true);
    const res = await allocateStock({
      product_id: allocateProductId,
      batch_number: batchNumber,
      from_location_id: fromLocation,
      to_location_id: toLocation,
      quantity: allocateQty,
    });
    setAllocateSubmitting(false);
    if (res.success) {
      setToast({ message: `Successfully allocated ${allocateQty} units!`, type: 'success' });
      setShowAllocateModal(false);
      refetch();
    } else {
      setToast({ message: res.error || 'Allocation failed', type: 'error' });
    }
  };

  /* ── Stock Take ── */
  const stockTakeItems = useMemo(() => {
    if (isSalesRep || isClinicRole) {
      return inventory.filter((item) => item.location_id === user?.location_id);
    }
    const loc = findLocationById(locations, warehouses[0]?.id || '');
    return inventory.filter((item) => item.location_id === (loc?.id || 'loc-0001-onitsha-hq'));
  }, [inventory, locations, isSalesRep, isClinicRole, user?.location_id, warehouses]);

  const openStockTake = useCallback(() => {
    const entries: Record<string, string> = {};
    stockTakeItems.forEach((item) => {
      entries[item.id] = String(item.quantity);
    });
    setStockTakeEntries(entries);
    setShowStockTakeModal(true);
  }, [stockTakeItems]);

  const handleStockTakeSubmit = useCallback(async () => {
    setStockTakeSubmitting(true);
    let updated = 0;
    for (const item of stockTakeItems) {
      const actual = parseInt(stockTakeEntries[item.id] ?? String(item.quantity), 10);
      if (isNaN(actual) || actual === item.quantity) continue;
      const res = await stockTake({ inventory_id: item.id, actual_quantity: actual });
      if (res.success) updated++;
    }
    setStockTakeSubmitting(false);
    setShowStockTakeModal(false);
    setToast({ message: `Stock take complete — ${updated} item(s) updated`, type: 'success' });
    refetch();
  }, [stockTakeItems, stockTakeEntries, refetch]);

  /* ── Restock Request Submit ── */
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selProd = products.find((p) => p.id === reqProduct);
    if (!selProd) return;
    setReqSubmitting(true);
    const res = await createRequest({
      user_id: user?.id || 'user',
      user_name: user?.full_name || 'Staff User',
      user_role: user?.role || 'sales_rep',
      location_id: user?.location_id,
      location_name: user?.location_name,
      type: 'restock',
      title: `Restock Request: ${selProd.name} (${reqQty} units)`,
      details: {
        product_id: selProd.id,
        product_name: selProd.name,
        quantity: reqQty,
        urgency: reqUrgency,
        reason: reqReason.trim() || 'Inventory replenishment for territory orders.',
      },
    });
    setReqSubmitting(false);
    if (res.success) {
      setToast({ message: 'Restock request submitted to Central Warehouse!', type: 'success' });
      setShowRestockModal(false);
      setReqReason('');
    } else {
      setToast({ message: res.error || 'Failed to submit request', type: 'error' });
    }
  };

  /* ── Return Stock Submit ── */
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selProd = products.find((p) => p.id === retProduct);
    if (!selProd) return;
    setRetSubmitting(true);
    const res = await createRequest({
      user_id: user?.id || 'user',
      user_name: user?.full_name || 'Staff User',
      user_role: user?.role || 'sales_rep',
      location_id: user?.location_id,
      location_name: user?.location_name,
      type: 'return',
      title: `Stock Return: ${selProd.name} (${retQty} units)`,
      details: {
        product_id: selProd.id,
        product_name: selProd.name,
        batch_number: retBatch.trim() || undefined,
        quantity: retQty,
        return_condition: retCondition,
        reason: retReason.trim() || 'Returning excess/damaged stock.',
      },
    });
    setRetSubmitting(false);
    if (res.success) {
      setToast({ message: 'Stock return request submitted to Warehouse Manager!', type: 'success' });
      setShowReturnModal(false);
      setRetReason('');
    } else {
      setToast({ message: res.error || 'Failed to submit return', type: 'error' });
    }
  };

  /* ── Product Recall Submit ── */
  const handleRecallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recallBatch.trim()) return;
    setRecallSubmitting(true);
    const res = await recallProductBatch(
      recallBatch.trim(),
      recallReason.trim() || 'NAFDAC Safety Advisory / Quality Control Protocol',
      user?.id || 'admin'
    );
    setRecallSubmitting(false);
    if (res.success) {
      setToast({
        message: `Product recall initiated! ${res.data?.affectedCount || 0} unit(s) quarantined.`,
        type: 'success',
      });
      setShowRecallModal(false);
      setRecallBatch('');
      setRecallReason('');
      refetch();
    } else {
      setToast({ message: res.error || 'Recall failed', type: 'error' });
    }
  };

  /* ── Batch Price Editor Submit ── */
  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates = Object.entries(priceUpdates)
      .filter(([_, price]) => price > 0)
      .map(([productId, newPrice]) => ({ productId, newPrice }));

    if (updates.length === 0) {
      setShowPriceModal(false);
      return;
    }

    setPriceSubmitting(true);
    const res = await batchUpdateProductPrices(updates);
    setPriceSubmitting(false);
    if (res.success) {
      setToast({ message: `Successfully updated prices for ${updates.length} product(s)!`, type: 'success' });
      setShowPriceModal(false);
      setPriceUpdates({});
      refetch();
    } else {
      setToast({ message: 'Failed to update prices', type: 'error' });
    }
  };

  /* ── Approve / Reject Request ── */
  const handleRequestReview = async (reqId: string, status: 'approved' | 'rejected') => {
    const res = await updateStatus(
      reqId,
      status,
      user?.id || 'admin',
      `${user?.full_name || 'Manager'} (${user?.role?.replace('_', ' ') || 'Admin'})`,
      status === 'approved' ? 'Approved & allocated by Warehouse Manager' : 'Declined'
    );
    if (res.success) {
      setToast({
        message: `Request ${status === 'approved' ? 'Approved & Stock Synchronized' : 'Rejected'}!`,
        type: 'success',
      });
      refetch();
    }
  };

  return (
    <>
      <Topbar title={isSalesRep ? 'My Allocated Inventory' : isClinicRole ? 'Clinic Medical Inventory' : 'Enterprise Inventory'} />
      <div className={styles.page}>
        {/* ── Tab Bar ── */}
        <div className={styles.tabs}>
          {tabs.map((tab) => (
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
          <h3 className={styles.tableTitle}>
            {activeTab === 'requests'
              ? 'Pending Restock & Return Requests'
              : activeTab === 'expiring'
              ? 'Near-Expiry Stock (Within 90 Days)'
              : isSalesRep
              ? `My Territory Stock (${user?.location_name || 'Assigned Territory'})`
              : isClinicRole
              ? `Clinic Practice Stock (${user?.location_name || 'Branch'})`
              : activeTab === 'warehouse'
              ? 'Onitsha HQ — Central Warehouse Stock'
              : activeTab === 'clinics'
              ? 'Clinic Branch Allocations'
              : 'Sales Rep Field Allocations'}
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Field Rep / Clinic Actions */}
            {(isSalesRep || isClinicRole) && (
              <>
                <button
                  className={styles.allocateBtn}
                  style={{ background: 'var(--color-navy)' }}
                  onClick={() => {
                    setReqProduct(products[0]?.id || '');
                    setShowRestockModal(true);
                  }}
                >
                  📥 Request Restock
                </button>
                <button
                  className={styles.allocateBtn}
                  style={{ background: '#475569' }}
                  onClick={() => {
                    setRetProduct(products[0]?.id || '');
                    setShowReturnModal(true);
                  }}
                >
                  📤 Return Items
                </button>
              </>
            )}

            {/* Warehouse Manager & Super Admin Actions */}
            {isInventoryManager && (
              <>
                <button
                  className={styles.allocateBtn}
                  style={{ background: '#0284c7' }}
                  onClick={() => {
                    const initPrices: Record<string, number> = {};
                    products.forEach((p) => { initPrices[p.id] = p.unit_price; });
                    setPriceUpdates(initPrices);
                    setShowPriceModal(true);
                  }}
                >
                  🏷️ Edit Prices
                </button>
                <button
                  className={styles.allocateBtn}
                  style={{ background: '#b91c1c' }}
                  onClick={() => setShowRecallModal(true)}
                >
                  🚨 Product Recall
                </button>
                {!isCeo && (
                  <button
                    className={styles.allocateBtn}
                    onClick={() => {
                      setFromLocation(warehouses[0]?.id || '');
                      setAllocateProductId('');
                      setToLocation(territories[0]?.id || '');
                      setShowAllocateModal(true);
                    }}
                  >
                    📦 Allocate Stock
                  </button>
                )}
              </>
            )}

            <button className={styles.stockTakeBtn} onClick={openStockTake}>
              📋 Stock Take
            </button>
          </div>
        </div>

        {/* ── Table View: Either Requests Table or Inventory Table ── */}
        {activeTab === 'requests' ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Submitted By</th>
                  <th>Location</th>
                  <th>Product & Batch</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyState}>
                      <span>✅</span>
                      <p>No pending restock or return requests</p>
                    </td>
                  </tr>
                ) : (
                  inventoryRequests.map((req) => (
                    <tr key={req.id} className={styles.row}>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: req.type === 'restock' ? 'rgba(14, 165, 233, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: req.type === 'restock' ? '#0284c7' : '#dc2626',
                        }}>
                          {req.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <strong>{req.user_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{req.user_role}</div>
                      </td>
                      <td>{req.location_name || 'Territory'}</td>
                      <td>
                        <strong>{req.details.product_name || 'Product'}</strong>
                        {req.details.batch_number && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Batch: {req.details.batch_number}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-slate)' }}>{req.details.reason}</div>
                      </td>
                      <td className={styles.qtyCell}>{req.details.quantity || 1} units</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                          color: req.status === 'approved' ? '#15803d' : req.status === 'rejected' ? '#b91c1c' : '#b45309',
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleRequestReview(req.id, 'approved')}
                              style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRequestReview(req.id, 'rejected')}
                              style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Closed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Batch Number</th>
                  <th>Quantity Available</th>
                  <th>Unit Price (₦)</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  {!isSalesRep && !isClinicRole && <th>Location</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyState}>
                      <span>📦</span>
                      <p>No inventory allocated in this view</p>
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
                        <td style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                          ₦{(product?.unit_price || 0).toLocaleString('en-NG')}
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
                        {!isSalesRep && !isClinicRole && (
                          <td className={styles.locationCell}>{location?.name || '—'}</td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div className={styles.tableFooter}>
              Showing {filtered.length} item(s) in this scope
            </div>
          </div>
        )}

        {/* ── Allocate Stock Modal ── */}
        <Modal isOpen={showAllocateModal} onClose={() => setShowAllocateModal(false)} title="Allocate Stock Batch">
          <form onSubmit={handleAllocateSubmit} className={styles.allocateForm}>
            <div className={styles.formGroup}>
              <label>Source Warehouse *</label>
              <select value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} required>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Product *</label>
              <select value={allocateProductId} onChange={(e) => setAllocateProductId(e.target.value)} required>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Batch *</label>
              <select value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required disabled={!availableBatches.length}>
                <option value="">{availableBatches.length ? 'Select batch' : 'No batches at source'}</option>
                {availableBatches.map((b) => (
                  <option key={b.id} value={b.batch_number}>{b.batch_number} ({b.quantity} available)</option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Quantity *</label>
                <input
                  type="number"
                  min={1}
                  max={selectedBatch?.quantity ?? 1}
                  value={allocateQty}
                  onChange={(e) => setAllocateQty(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Destination Location *</label>
                <select value={toLocation} onChange={(e) => setToLocation(e.target.value)} required>
                  {locations.filter((l) => l.id !== fromLocation).map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowAllocateModal(false)}>Cancel</button>
              <button type="submit" className={styles.submitBtn} disabled={allocateSubmitting}>
                {allocateSubmitting ? 'Allocating…' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Request Restock Modal ── */}
        <Modal isOpen={showRestockModal} onClose={() => setShowRestockModal(false)} title="Submit Stock Restock Request">
          <form onSubmit={handleRestockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-slate)', margin: 0 }}>
              This request will be dispatched directly to the Central Warehouse Manager for immediate batch allocation.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Select Product *
              </label>
              <select
                value={reqProduct}
                onChange={(e) => setReqProduct(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (₦{p.unit_price.toLocaleString('en-NG')})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Quantity (Units) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={reqQty}
                  onChange={(e) => setReqQty(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Urgency Level
                </label>
                <select
                  value={reqUrgency}
                  onChange={(e) => setReqUrgency(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                >
                  <option value="normal">Normal (Standard Delivery)</option>
                  <option value="urgent">Urgent (Depleted Stock)</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Reason & Notes
              </label>
              <textarea
                rows={3}
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="e.g. Commercial farm order fulfillment in territory"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowRestockModal(false)} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={reqSubmitting} style={{ padding: '8px 18px', background: 'var(--color-navy)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                {reqSubmitting ? 'Submitting…' : 'Submit Restock Request'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Return Stock Modal ── */}
        <Modal isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} title="Return Items to Central Warehouse">
          <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Product to Return *
              </label>
              <select
                value={retProduct}
                onChange={(e) => setRetProduct(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Batch Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. ALB-2026-003"
                  value={retBatch}
                  onChange={(e) => setRetBatch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Quantity to Return *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={retQty}
                  onChange={(e) => setRetQty(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Return Condition
              </label>
              <select
                value={retCondition}
                onChange={(e) => setRetCondition(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              >
                <option value="excess">Excess / Unsold Surplus Stock</option>
                <option value="near_expiry">Near Expiry Stock</option>
                <option value="damaged">Damaged Transit Packaging</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Reason & Comments
              </label>
              <textarea
                rows={3}
                value={retReason}
                onChange={(e) => setRetReason(e.target.value)}
                placeholder="Reason for return..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowReturnModal(false)} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={retSubmitting} style={{ padding: '8px 18px', background: '#475569', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                {retSubmitting ? 'Submitting…' : 'Confirm Return'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Product Recall Modal ── */}
        <Modal isOpen={showRecallModal} onClose={() => setShowRecallModal(false)} title="🚨 Initiate Product Batch Recall">
          <form onSubmit={handleRecallSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: 'var(--radius-md)', color: '#b91c1c', fontSize: '0.85rem', lineHeight: 1.5 }}>
              <strong>Caution:</strong> Submitting a product recall will immediately quarantine all existing stock belonging to this batch number across all warehouses, sales reps, and clinic branches, and generate an immutable audit log trail.
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Batch Number to Recall *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. OXY-2026-001"
                value={recallBatch}
                onChange={(e) => setRecallBatch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Regulatory / Clinical Justification *
              </label>
              <textarea
                required
                rows={3}
                value={recallReason}
                onChange={(e) => setRecallReason(e.target.value)}
                placeholder="Reason for recall (e.g. NAFDAC quality advisory, seal defect)..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowRecallModal(false)} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={recallSubmitting} style={{ padding: '8px 18px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                {recallSubmitting ? 'Quarantining…' : 'Initiate Recall'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Batch Price Editor Modal ── */}
        <Modal isOpen={showPriceModal} onClose={() => setShowPriceModal(false)} title="🏷️ Batch Product Price Editor">
          <form onSubmit={handlePriceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-slate)', margin: 0 }}>
              Adjust catalog unit prices. Changes take effect across wholesale invoicing and pharmacy POS immediately.
            </p>
            <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Price (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-navy)' }}>{p.name}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-slate)' }}>{p.category}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          min="100"
                          step="100"
                          value={priceUpdates[p.id] ?? p.unit_price}
                          onChange={(e) => setPriceUpdates({ ...priceUpdates, [p.id]: parseFloat(e.target.value) || 0 })}
                          style={{ width: '110px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', textAlign: 'right', fontWeight: 600 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowPriceModal(false)} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={priceSubmitting} style={{ padding: '8px 18px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                {priceSubmitting ? 'Saving…' : 'Save New Prices'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Stock Take Modal ── */}
        <Modal isOpen={showStockTakeModal} onClose={() => setShowStockTakeModal(false)} title="Physical Stock Take">
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1rem' }}>
            <table className={styles.table} style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>System Qty</th>
                  <th>Actual Qty</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {stockTakeItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyState}>
                      <span>📦</span>
                      <p>No inventory items found at this location</p>
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
            <button type="button" className={styles.cancelBtn} onClick={() => setShowStockTakeModal(false)} disabled={stockTakeSubmitting}>
              Cancel
            </button>
            <button type="button" className={styles.submitBtn} onClick={handleStockTakeSubmit} disabled={stockTakeSubmitting}>
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
