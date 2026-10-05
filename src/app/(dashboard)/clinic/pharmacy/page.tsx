'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useProducts, useClinicPatients, useNarcoticLogs } from '@/hooks/use-supabase-data';
import { dispensePrescription } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import type { Product } from '@/lib/types';
import styles from './pharmacy.module.css';

interface CartItem {
  product: Product;
  quantity: number;
}

const CONTROLLED_KEYWORDS = ['ketamine', 'morphine', 'diazepam', 'tramadol', 'butorphanol', 'fentanyl', 'buprenorphine'];

export default function PharmacyPOSPage() {
  const { products } = useProducts();
  const { patients } = useClinicPatients();
  const { user } = useAuth();
  const { logs: narcoticLogs, refetch: refetchNarcotics } = useNarcoticLogs(user?.location_id);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos_card' | 'bank_transfer'>('cash');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Narcotics PIN Lockbox
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isPinAuthorized, setIsPinAuthorized] = useState(false);

  // Controlled substance audit log modal
  const [showNarcoticAuditModal, setShowNarcoticAuditModal] = useState(false);

  const isControlledDrug = (product: Product) => {
    const name = product.name.toLowerCase();
    return CONTROLLED_KEYWORDS.some((kw) => name.includes(kw));
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category || 'General')));
    return ['all', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesCat = selectedCategory === 'all' || prod.category === selectedCategory;
      const q = search.toLowerCase();
      const matchesSearch =
        prod.name.toLowerCase().includes(q) ||
        prod.sku.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, search]);

  const hasControlledInCart = useMemo(() => {
    return cart.some((item) => isControlledDrug(item.product));
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.unit_price * item.quantity, 0);
  }, [cart]);

  const handleCheckoutClick = () => {
    if (cart.length === 0) {
      setToast({ message: 'Cart is empty', type: 'error' });
      return;
    }
    if (hasControlledInCart && !isPinAuthorized) {
      setShowPinModal(true);
      return;
    }
    void executeDispense();
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPin || enteredPin.length < 4) {
      setPinError('Please enter a 4-digit authorization PIN');
      return;
    }
    await executeDispense(enteredPin);
  };

  const executeDispense = async (pin?: string) => {
    if (!user) {
      setToast({ message: 'Authentication required to dispense medications', type: 'error' });
      return;
    }

    setSubmitting(true);
    setPinError('');

    const patientObj = patients.find((p) => p.id === selectedPatientId);
    const dispenseItems = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.unit_price,
      is_controlled: isControlledDrug(item.product),
    }));

    const res = await dispensePrescription({
      patient_id: selectedPatientId || null,
      patient_name: patientObj?.name || 'Direct Walk-in',
      items: dispenseItems,
      payment_method: paymentMethod,
      pin: pin || (hasControlledInCart ? enteredPin : undefined),
      user_id: user.id,
      authorizer_name: user.full_name || 'Authorized Staff',
      location_id: user.location_id || null,
    });

    setSubmitting(false);

    if (res.success) {
      const patientName = patientObj?.name || 'Direct Walk-in';
      const totalAmount = res.data?.total_amount || subtotal;
      setToast({
        message: `Dispensed ₦${totalAmount.toLocaleString()} (${cart.length} items) for ${patientName} via ${paymentMethod.toUpperCase()}`,
        type: 'success',
      });
      setCart([]);
      setSelectedPatientId('');
      setIsPinAuthorized(false);
      setEnteredPin('');
      setShowPinModal(false);
      await refetchNarcotics();
    } else {
      if (hasControlledInCart) {
        setPinError(res.error || 'Authorization failed');
      }
      setToast({
        message: res.error || 'Dispense failed',
        type: 'error',
      });
    }
  };

  return (
    <div className={styles.page}>
      <Topbar title="Pharmacy POS & Narcotics Lockbox" />

      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>🏪 Clinical Pharmacy POS & Narcotics Dispensing</h1>
        <p className={styles.greetingSub}>
          Real-time prescription checkout, live stock deduction, and double-custody PIN-locked narcotics log
        </p>
      </div>

      <div className={styles.posLayout}>
        {/* Left Column: Product Medication Browser */}
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <div className={styles.searchBar}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search prescription drugs, antibiotics, NSAIDs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className={styles.select}
              style={{ width: 'auto' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.productCatalogGrid}>
            {filteredProducts.map((prod) => {
              const controlled = isControlledDrug(prod);
              return (
                <div
                  key={prod.id}
                  className={styles.productCard}
                  onClick={() => addToCart(prod)}
                >
                  <div>
                    <span className={styles.productCategory}>{prod.category || 'Medication'}</span>
                    <h4 className={styles.productTitle}>{prod.name}</h4>
                    {controlled && (
                      <span className={styles.narcoticTag}>🔒 CONTROLLED SCHEDULE II</span>
                    )}
                  </div>
                  <div>
                    <div className={styles.productPrice}>₦{prod.unit_price.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>SKU: {prod.sku}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Cart & Checkout */}
        <div className={styles.card}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--color-navy)' }}>
            🛒 Prescription Checkout
          </h3>

          <div className={styles.formGroup}>
            <label className={styles.label}>Associated Patient</label>
            <select
              className={styles.select}
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              <option value="">-- Direct Over-The-Counter (No Patient) --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.species} - {p.owner?.full_name || 'Client'})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.cartList}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Cart is currently empty. Click medications to add.
              </div>
            ) : (
              cart.map((item) => {
                const controlled = isControlledDrug(item.product);
                return (
                  <div key={item.product.id} className={styles.cartItem}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)' }}>
                        {item.product.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        ₦{item.product.unit_price.toLocaleString()} each
                        {controlled && <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: '6px' }}>🔒 SCHEDULE II</span>}
                      </div>
                    </div>

                    <div className={styles.cartQtyControls}>
                      <button
                        type="button"
                        className={styles.qtyBtn}
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className={styles.qtyBtn}
                        onClick={() => updateQuantity(item.product.id, 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', marginLeft: '6px', cursor: 'pointer' }}
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.cartSummary}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Payment Method</label>
              <select
                className={styles.select}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option value="cash">💵 Cash In Hand</option>
                <option value="pos_card">💳 POS Card Terminal</option>
                <option value="bank_transfer">🏦 Direct Bank Transfer</option>
              </select>
            </div>

            <div className={styles.summaryRow}>
              <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} units):</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>

            <div className={styles.totalRow}>
              <span>Total Payable:</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>

            {hasControlledInCart && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px', borderRadius: '6px', fontSize: '12px', color: '#991b1b', marginTop: '6px' }}>
                ⚠️ <strong>Narcotic Warning:</strong> Contains Controlled Schedule II Substances. Requires Veterinary PIN authorization to unlock checkout.
              </div>
            )}

            <button
              type="button"
              className={styles.checkoutBtn}
              onClick={handleCheckoutClick}
              disabled={cart.length === 0}
            >
              {hasControlledInCart && !isPinAuthorized ? '🔒 Verify PIN & Dispense' : '✅ Confirm & Dispense Prescription'}
            </button>

            <button
              type="button"
              className={styles.narcoticLockBoxBtn}
              onClick={() => setShowNarcoticAuditModal(true)}
            >
              📋 View Narcotics Custody Ledger
            </button>
          </div>
        </div>
      </div>

      {/* Narcotics PIN Verification Modal */}
      <Modal isOpen={showPinModal} onClose={() => setShowPinModal(false)} title="🔒 Controlled Substance Lockbox Authorization">
        <form onSubmit={handleVerifyPin}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Federal veterinary regulations require an authorized veterinary surgeon or lead pharmacist PIN to dispense controlled Schedule II pharmaceuticals.
          </p>

          <div className={styles.formGroup}>
            <label className={styles.label}>4-Digit Authorization PIN</label>
            <input
              type="password"
              maxLength={4}
              className={`${styles.input} ${styles.pinInput}`}
              placeholder="••••"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              autoFocus
              required
            />
            {pinError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{pinError}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" className={styles.tabBtn} onClick={() => setShowPinModal(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Verifying & Dispensing...' : 'Unlock & Authorize Dispensation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Controlled Substance Audit Ledger Modal */}
      <Modal
        isOpen={showNarcoticAuditModal}
        onClose={() => setShowNarcoticAuditModal(false)}
        title="📋 Narcotics & Controlled Substance Safe Log"
      >
        <div>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
            Immutable perpetual inventory register for Schedule II & III controlled pharmaceuticals.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '6px' }}>Timestamp</th>
                  <th style={{ padding: '6px' }}>Substance</th>
                  <th style={{ padding: '6px' }}>Patient / Case</th>
                  <th style={{ padding: '6px' }}>Qty</th>
                  <th style={{ padding: '6px' }}>Authorized By</th>
                </tr>
              </thead>
              <tbody>
                {narcoticLogs && narcoticLogs.length > 0 ? (
                  narcoticLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>
                        {new Date(log.created_at).toLocaleString('en-NG', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{log.product_name}</td>
                      <td style={{ padding: '8px 6px' }}>{log.patient_name || 'Direct Walk-in'}</td>
                      <td style={{ padding: '8px 6px', color: '#dc2626', fontWeight: 700 }}>
                        {log.quantity} {log.unit || 'units'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{log.authorizer_name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>
                      No controlled substance dispensations recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="button" className={styles.primaryBtn} onClick={() => setShowNarcoticAuditModal(false)}>
              Close Register
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
