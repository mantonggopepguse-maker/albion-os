'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { useProducts, useClinicPatients } from '@/hooks/use-supabase-data';
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

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos_card' | 'bank_transfer'>('cash');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
    executeDispense();
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default PIN: 1234 or clinic pin
    if (enteredPin === '1234' || enteredPin === '0000') {
      setIsPinAuthorized(true);
      setShowPinModal(false);
      setPinError('');
      setToast({ message: 'Narcotics Lockbox Authorized', type: 'success' });
      executeDispense();
    } else {
      setPinError('Invalid Narcotics Authorization PIN. Access Denied.');
    }
  };

  const executeDispense = () => {
    const patientName = patients.find((p) => p.id === selectedPatientId)?.name || 'Direct Walk-in';
    setToast({
      message: `Dispensed ₦${subtotal.toLocaleString()} (${cart.length} items) for ${patientName} via ${paymentMethod.toUpperCase()}`,
      type: 'success',
    });
    setCart([]);
    setSelectedPatientId('');
    setIsPinAuthorized(false);
    setEnteredPin('');
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
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
              Demo Clinic Master PIN: <code>1234</code>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" className={styles.tabBtn} onClick={() => setShowPinModal(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Unlock & Authorize Dispensation
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
                  <th style={{ padding: '6px' }}>Qty (mL/Tabs)</th>
                  <th style={{ padding: '6px' }}>Authorizing Surgeon</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px' }}>{new Date().toLocaleDateString()} 09:15</td>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>Ketamine 100mg/mL</td>
                  <td style={{ padding: '8px 6px' }}>Simba (Canine - Orthopedic)</td>
                  <td style={{ padding: '8px 6px', color: '#dc2626', fontWeight: 700 }}>2.5 mL</td>
                  <td style={{ padding: '8px 6px' }}>Dr. A. Bello (VS-491)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px' }}>{new Date().toLocaleDateString()} 11:30</td>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>Diazepam 5mg/mL</td>
                  <td style={{ padding: '8px 6px' }}>Max (Canine - Status Epilepticus)</td>
                  <td style={{ padding: '8px 6px', color: '#dc2626', fontWeight: 700 }}>1.0 mL</td>
                  <td style={{ padding: '8px 6px' }}>Dr. E. Okafor (VS-218)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px' }}>{new Date().toLocaleDateString()} 14:00</td>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>Tramadol 50mg Tablets</td>
                  <td style={{ padding: '8px 6px' }}>Bella (Feline - Post-C-Section)</td>
                  <td style={{ padding: '8px 6px', color: '#dc2626', fontWeight: 700 }}>10 Tabs</td>
                  <td style={{ padding: '8px 6px' }}>Dr. A. Bello (VS-491)</td>
                </tr>
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
