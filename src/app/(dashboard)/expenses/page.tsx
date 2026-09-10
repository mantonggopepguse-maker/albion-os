'use client';

import React, { useState, useMemo } from 'react';
import { useExpenses, useLocations } from '@/hooks/use-supabase-data';
import { useAuth } from '@/lib/auth-context';
import { addBranchExpense } from '@/lib/data-service';
import type { BranchExpense } from '@/lib/types';
import styles from './expenses.module.css';

export default function ExpensesPage() {
  const { user } = useAuth();
  const { expenses, loading, refetch } = useExpenses();
  const { locations } = useLocations();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    location_id: '',
    category: 'fuel' as BranchExpense['category'],
    amount: '',
    description: '',
    expense_date: new Date().toISOString().slice(0, 10),
    vendor_name: '',
    payment_method: 'bank_transfer' as 'cash' | 'bank_transfer' | 'pos' | 'check',
    receipt_url: '',
  });

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
      const matchLoc = selectedLocation === 'all' || e.location_id === selectedLocation;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.description.toLowerCase().includes(q) ||
        (e.vendor_name && e.vendor_name.toLowerCase().includes(q)) ||
        (e.location_name && e.location_name.toLowerCase().includes(q)) ||
        (e.recorder_name && e.recorder_name.toLowerCase().includes(q));

      return matchCat && matchLoc && matchSearch;
    });
  }, [expenses, selectedCategory, selectedLocation, searchTerm]);

  // Aggregate KPI Stats
  const stats = useMemo(() => {
    const totalOutflow = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const fuelOutflow = expenses
      .filter((e) => e.category === 'fuel')
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    const consumablesOutflow = expenses
      .filter((e) => e.category === 'consumables' || e.category === 'inventory_purchase')
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    const rentOutflow = expenses
      .filter((e) => e.category === 'rent')
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    return { totalOutflow, fuelOutflow, consumablesOutflow, rentOutflow };
  }, [expenses]);

  const handleOpenModal = () => {
    setFormData({
      location_id: user?.location_id || (locations[0]?.id || 'loc-0001-onitsha-hq'),
      category: 'fuel',
      amount: '',
      description: '',
      expense_date: new Date().toISOString().slice(0, 10),
      vendor_name: '',
      payment_method: 'bank_transfer',
      receipt_url: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Please enter a valid expense amount.');
      return;
    }
    if (!formData.description.trim()) {
      setFormError('Please enter a description for the expense.');
      return;
    }
    if (!formData.location_id) {
      setFormError('Please select an operating location.');
      return;
    }

    setSubmitting(true);
    const res = await addBranchExpense({
      location_id: formData.location_id,
      category: formData.category,
      amount: amountNum,
      description: formData.description.trim(),
      expense_date: formData.expense_date,
      vendor_name: formData.vendor_name.trim() || null,
      payment_method: formData.payment_method,
      receipt_url: formData.receipt_url.trim() || null,
      recorded_by: user?.id,
    });

    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      await refetch();
    } else {
      setFormError(res.error || 'Failed to record expense. Please try again.');
    }
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return;
    const headers = ['ID', 'Date', 'Location', 'Category', 'Description', 'Vendor', 'Amount (NGN)', 'Payment Method', 'Recorded By'];
    const rows = filteredExpenses.map((e) => [
      e.id,
      e.expense_date,
      `"${e.location_name || e.location_id}"`,
      e.category,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${(e.vendor_name || '—').replace(/"/g, '""')}"`,
      e.amount,
      e.payment_method || 'bank_transfer',
      `"${e.recorder_name || e.recorded_by || 'System'}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AlbionOS_Expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatNaira = (amt: number) => {
    return `₦${amt.toLocaleString('en-NG')}`;
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'fuel':
        return styles.badgeFuel;
      case 'consumables':
      case 'inventory_purchase':
        return styles.badgeConsumables;
      case 'utilities':
        return styles.badgeUtilities;
      case 'maintenance':
        return styles.badgeMaintenance;
      case 'rent':
        return styles.badgeRent;
      default:
        return styles.badgeOther;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>💸 Operating Expenses & Overheads</h1>
        <p className={styles.greetingSub}>
          Track facility overheads, diesel generator power, clinic consumables, equipment servicing, and monthly operating outflow across Albion branches.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Operating Outflow</span>
              <span className={styles.statValue}>{formatNaira(stats.totalOutflow)}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #093961, #1E4F77)' }}>
              💳
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Diesel & Generator Power</span>
              <span className={styles.statValue}>{formatNaira(stats.fuelOutflow)}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
              ⚡
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Consumables & Lab Reagents</span>
              <span className={styles.statValue}>{formatNaira(stats.consumablesOutflow)}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              🧪
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Facility Rent & Leases</span>
              <span className={styles.statValue}>{formatNaira(stats.rentOutflow)}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #be185d, #ec4899)' }}>
              🏢
            </div>
          </div>
        </div>
      </div>

      {/* Actions & Filters Bar */}
      <div className={styles.actionsBar}>
        <div className={styles.filters}>
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'fuel', label: '⚡ Diesel & Fuel' },
            { id: 'consumables', label: '🧪 Consumables' },
            { id: 'utilities', label: '🌐 Utilities & Net' },
            { id: 'maintenance', label: '🔧 Maintenance' },
            { id: 'rent', label: '🏢 Facility Rent' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`${styles.filterBtn} ${selectedCategory === cat.id ? styles.filterBtnActive : ''}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className={styles.searchWrap}>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search description, vendor, recorder..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <div className={styles.actionButtons}>
            <button onClick={handleOpenModal} className={styles.recordBtn}>
              + Record Expense
            </button>
            <button onClick={handleExportCSV} className={styles.exportBtn}>
              📥 Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Location</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor / Payee</th>
                <th>Payment Method</th>
                <th>Recorded By</th>
                <th style={{ textAlign: 'right' }}>Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    Loading operating expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    No expense records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {new Date(exp.expense_date).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ fontWeight: '600', fontSize: '12px' }}>
                      {exp.location_name || 'Branch'}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getCategoryBadgeClass(exp.category)}`}>
                        {exp.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {exp.description}
                    </td>
                    <td style={{ color: 'var(--color-navy)', fontSize: '12px' }}>
                      {exp.vendor_name || '—'}
                    </td>
                    <td style={{ textTransform: 'uppercase', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {exp.payment_method?.replace('_', ' ') || 'BANK TRANSFER'}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {exp.recorder_name || 'Staff User'}
                    </td>
                    <td style={{ textAlign: 'right' }} className={styles.amountCell}>
                      {formatNaira(exp.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>📝 Record Operating Expense</h2>
              <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className={styles.modalBody}>
                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Branch / Location *</label>
                    <select
                      value={formData.location_id}
                      onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                      required
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Expense Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      required
                    >
                      <option value="fuel">⚡ Generator Fuel (Diesel/Petrol)</option>
                      <option value="consumables">🧪 Medical / Clinic Consumables</option>
                      <option value="utilities">🌐 Utilities (Internet, Water, Power)</option>
                      <option value="maintenance">🔧 Equipment & Facility Maintenance</option>
                      <option value="rent">🏢 Facility Rent / Lease Amortization</option>
                      <option value="equipment">⚙️ Capital Equipment Acquisition</option>
                      <option value="payroll">👥 Staff Logistics / Direct Allowance</option>
                      <option value="other">📦 Other Operations</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Amount (₦) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 150000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      min="1"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Date *</label>
                    <input
                      type="date"
                      value={formData.expense_date}
                      onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Description & Purpose *</label>
                  <textarea
                    rows={2}
                    placeholder="Provide details about the purchase, quantity, and operational justification..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Vendor / Payee Name</label>
                    <input
                      type="text"
                      placeholder="e.g. TotalEnergies, MedEquip Ltd"
                      value={formData.vendor_name}
                      onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Payment Method</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                    >
                      <option value="bank_transfer">Electronic Bank Transfer</option>
                      <option value="cash">Petty Cash</option>
                      <option value="pos">POS Card Terminal</option>
                      <option value="check">Bank Draft / Check</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Receipt URL / Document Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://... or invoice receipt #REF-2026"
                    value={formData.receipt_url}
                    onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={styles.cancelBtn}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Recording...' : '💾 Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
