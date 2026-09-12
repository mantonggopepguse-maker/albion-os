'use client';

import React, { useState, useMemo } from 'react';
import { useExpenses, useLocations, useUsers } from '@/hooks/use-supabase-data';
import { useAuth } from '@/lib/auth-context';
import { addBranchExpense } from '@/lib/data-service';
import type { BranchExpense } from '@/lib/types';
import styles from './expenses.module.css';

export default function ExpensesPage() {
  const { user } = useAuth();
  const { expenses, loading, refetch } = useExpenses();
  const { locations } = useLocations();
  const { users } = useUsers();

  const isSalesRep = user?.role === 'sales_rep';
  const isClinicStaff = ['clinic_admin', 'vet', 'receptionist', 'vet_tech'].includes(user?.role || '');
  const isScopedUser = isSalesRep || isClinicStaff;

  const [activeTab, setActiveTab] = useState<'all' | 'reps' | 'clinics' | 'staff'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Lightbox modal state
  const [viewingReceipt, setViewingReceipt] = useState<string | null | undefined>(null);

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

  // Base list scoped by user permission
  const accessibleExpenses = useMemo(() => {
    if (isScopedUser) {
      return expenses.filter(
        (e) => e.location_id === user?.location_id || (user?.id && e.recorded_by === user.id)
      );
    }
    return expenses;
  }, [expenses, isScopedUser, user]);

  // Filtered Expenses for Flat View
  const filteredExpenses = useMemo(() => {
    return accessibleExpenses.filter((e) => {
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
  }, [accessibleExpenses, selectedCategory, selectedLocation, searchTerm]);

  // Aggregate KPI Stats
  const stats = useMemo(() => {
    const totalOutflow = accessibleExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const fuelOutflow = accessibleExpenses
      .filter((e) => e.category === 'fuel')
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    const consumablesOutflow = accessibleExpenses
      .filter((e) => e.category === 'consumables' || e.category === 'inventory_purchase')
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    const rentOutflow = accessibleExpenses
      .filter((e) => e.category === 'rent')
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    return { totalOutflow, fuelOutflow, consumablesOutflow, rentOutflow };
  }, [accessibleExpenses]);

  // Grouped by Sales Reps
  const groupedByReps = useMemo(() => {
    const repUsers = users.filter((u) => u.role === 'sales_rep');
    const groups: Array<{
      repId: string;
      repName: string;
      territoryName: string;
      items: BranchExpense[];
      total: number;
    }> = [];

    repUsers.forEach((rep) => {
      const repItems = accessibleExpenses.filter(
        (e) => e.recorded_by === rep.id || e.location_id === rep.location_id
      );
      if (repItems.length > 0 || isSalesRep) {
        if (!isSalesRep || rep.id === user?.id) {
          const loc = locations.find((l) => l.id === rep.location_id);
          groups.push({
            repId: rep.id,
            repName: rep.full_name,
            territoryName: loc?.name || 'Assigned Territory',
            items: repItems,
            total: repItems.reduce((sum, item) => sum + (item.amount || 0), 0),
          });
        }
      }
    });

    accessibleExpenses.forEach((exp) => {
      if (exp.recorder_name?.toLowerCase().includes('rep') && !groups.some((g) => g.items.some((i) => i.id === exp.id))) {
        let existing = groups.find((g) => g.repName === exp.recorder_name);
        if (!existing) {
          existing = {
            repId: exp.recorded_by || exp.id,
            repName: exp.recorder_name || 'Field Sales Rep',
            territoryName: exp.location_name || 'Territory',
            items: [],
            total: 0,
          };
          groups.push(existing);
        }
        existing.items.push(exp);
        existing.total += exp.amount;
      }
    });

    return groups;
  }, [accessibleExpenses, users, locations, isSalesRep, user]);

  // Grouped by Clinic Branches
  const groupedByClinics = useMemo(() => {
    const clinicLocs = locations.filter((l) => l.type === 'clinic');
    const groups: Array<{
      clinicId: string;
      clinicName: string;
      state: string;
      items: BranchExpense[];
      total: number;
    }> = [];

    clinicLocs.forEach((loc) => {
      if (!isClinicStaff || loc.id === user?.location_id) {
        const clinicItems = accessibleExpenses.filter((e) => e.location_id === loc.id);
        groups.push({
          clinicId: loc.id,
          clinicName: loc.name,
          state: loc.state || 'Nigeria',
          items: clinicItems,
          total: clinicItems.reduce((sum, item) => sum + (item.amount || 0), 0),
        });
      }
    });

    return groups;
  }, [accessibleExpenses, locations, isClinicStaff, user]);

  // Grouped by Staff Member
  const groupedByStaff = useMemo(() => {
    const staffMap = new Map<string, { staffId: string; staffName: string; locationName: string; items: BranchExpense[]; total: number }>();

    accessibleExpenses.forEach((exp) => {
      const key = exp.recorded_by || exp.recorder_name || 'Unknown Staff';
      const staffUser = users.find((u) => u.id === exp.recorded_by);
      const staffName = staffUser?.full_name || exp.recorder_name || 'Staff User';
      const locName = exp.location_name || locations.find((l) => l.id === exp.location_id)?.name || 'Branch';

      if (!staffMap.has(key)) {
        staffMap.set(key, {
          staffId: key,
          staffName,
          locationName: locName,
          items: [],
          total: 0,
        });
      }

      const entry = staffMap.get(key)!;
      entry.items.push(exp);
      entry.total += exp.amount;
    });

    return Array.from(staffMap.values());
  }, [accessibleExpenses, users, locations]);

  const handleOpenModal = () => {
    const defaultLocation = isScopedUser && user?.location_id
      ? user.location_id
      : locations[0]?.id || 'loc-0001-onitsha-hq';

    setFormData({
      location_id: defaultLocation,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Receipt file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData((prev) => ({ ...prev, receipt_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
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
    const headers = ['ID', 'Date', 'Location', 'Category', 'Description', 'Vendor', 'Amount (NGN)', 'Payment Method', 'Recorded By', 'Receipt'];
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
      e.receipt_url ? 'Yes' : 'No',
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
          {isSalesRep
            ? 'Track field travel, fuel allocations, customer entertainment, and logistics expenses for your sales territory.'
            : isClinicStaff
            ? 'Track veterinary consumables, generator power, clinic facility maintenance, and branch operational outflow.'
            : 'Track enterprise overheads, generator fuel, clinic consumables, equipment servicing, and staff expenses across Albion.'}
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

      {/* View Tabs: All, By Reps, By Clinics, By Staff */}
      <div className={styles.viewTabs}>
        <button
          onClick={() => setActiveTab('all')}
          className={`${styles.viewTabBtn} ${activeTab === 'all' ? styles.viewTabBtnActive : ''}`}
        >
          📋 All Expenses ({accessibleExpenses.length})
        </button>
        <button
          onClick={() => setActiveTab('reps')}
          className={`${styles.viewTabBtn} ${activeTab === 'reps' ? styles.viewTabBtnActive : ''}`}
        >
          💼 By Sales Reps ({groupedByReps.length})
        </button>
        <button
          onClick={() => setActiveTab('clinics')}
          className={`${styles.viewTabBtn} ${activeTab === 'clinics' ? styles.viewTabBtnActive : ''}`}
        >
          🏥 By Clinic Branches ({groupedByClinics.length})
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`${styles.viewTabBtn} ${activeTab === 'staff' ? styles.viewTabBtnActive : ''}`}
        >
          👤 By Staff Member ({groupedByStaff.length})
        </button>
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
          {!isScopedUser && (
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
          )}

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

      {/* TAB 1: ALL EXPENSES FLAT TABLE */}
      {activeTab === 'all' && (
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
                  <th>Receipt</th>
                  <th style={{ textAlign: 'right' }}>Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                      Loading operating expenses...
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={styles.emptyState}>
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
                      <td>
                        {exp.receipt_url ? (
                          <button
                            type="button"
                            onClick={() => setViewingReceipt(exp.receipt_url || null)}
                            className={styles.receiptBtn}
                            title="Click to view attached receipt"
                          >
                            📎 Receipt
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        )}
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
      )}

      {/* TAB 2: GROUPED BY SALES REPS */}
      {activeTab === 'reps' && (
        <div>
          {groupedByReps.length === 0 ? (
            <div className={styles.tableCard} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No expenses recorded for sales reps.
            </div>
          ) : (
            groupedByReps.map((group) => (
              <div key={group.repId} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <div className={styles.groupTitle}>
                    <span>💼</span>
                    <div>
                      <div>{group.repName}</div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>
                        📍 {group.territoryName} • {group.items.length} expenses
                      </div>
                    </div>
                  </div>
                  <div className={styles.groupSubtotal}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Total Outflow:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                      {formatNaira(group.total)}
                    </span>
                  </div>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Vendor</th>
                        <th>Receipt</th>
                        <th style={{ textAlign: 'right' }}>Amount (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{item.expense_date}</td>
                          <td>
                            <span className={`${styles.badge} ${getCategoryBadgeClass(item.category)}`}>
                              {item.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{item.description}</td>
                          <td style={{ fontSize: '12px' }}>{item.vendor_name || '—'}</td>
                          <td>
                            {item.receipt_url ? (
                              <button
                                type="button"
                                onClick={() => setViewingReceipt(item.receipt_url || null)}
                                className={styles.receiptBtn}
                              >
                                📎 Receipt
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }} className={styles.amountCell}>
                            {formatNaira(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: GROUPED BY CLINIC BRANCHES */}
      {activeTab === 'clinics' && (
        <div>
          {groupedByClinics.length === 0 ? (
            <div className={styles.tableCard} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No expenses recorded for clinic branches.
            </div>
          ) : (
            groupedByClinics.map((clinic) => (
              <div key={clinic.clinicId} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <div className={styles.groupTitle}>
                    <span>🏥</span>
                    <div>
                      <div>{clinic.clinicName}</div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>
                        📍 {clinic.state} • {clinic.items.length} expenses
                      </div>
                    </div>
                  </div>
                  <div className={styles.groupSubtotal}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Branch Subtotal:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                      {formatNaira(clinic.total)}
                    </span>
                  </div>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Recorded By</th>
                        <th>Receipt</th>
                        <th style={{ textAlign: 'right' }}>Amount (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinic.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                            No expenses recorded for this clinic branch yet.
                          </td>
                        </tr>
                      ) : (
                        clinic.items.map((item) => (
                          <tr key={item.id}>
                            <td style={{ fontSize: '12px', color: '#64748b' }}>{item.expense_date}</td>
                            <td>
                              <span className={`${styles.badge} ${getCategoryBadgeClass(item.category)}`}>
                                {item.category.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{item.description}</td>
                            <td style={{ fontSize: '12px' }}>{item.recorder_name || 'Staff'}</td>
                            <td>
                              {item.receipt_url ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingReceipt(item.receipt_url)}
                                  className={styles.receiptBtn}
                                >
                                  📎 Receipt
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }} className={styles.amountCell}>
                              {formatNaira(item.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: GROUPED BY STAFF MEMBER */}
      {activeTab === 'staff' && (
        <div>
          {groupedByStaff.length === 0 ? (
            <div className={styles.tableCard} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No expenses found.
            </div>
          ) : (
            groupedByStaff.map((st) => (
              <div key={st.staffId} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <div className={styles.groupTitle}>
                    <span>👤</span>
                    <div>
                      <div>{st.staffName}</div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>
                        📍 {st.locationName} • {st.items.length} expense submissions
                      </div>
                    </div>
                  </div>
                  <div className={styles.groupSubtotal}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Total Submitted:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                      {formatNaira(st.total)}
                    </span>
                  </div>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Vendor</th>
                        <th>Receipt</th>
                        <th style={{ textAlign: 'right' }}>Amount (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {st.items.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{item.expense_date}</td>
                          <td>
                            <span className={`${styles.badge} ${getCategoryBadgeClass(item.category)}`}>
                              {item.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{item.description}</td>
                          <td style={{ fontSize: '12px' }}>{item.vendor_name || '—'}</td>
                          <td>
                            {item.receipt_url ? (
                              <button
                                type="button"
                                onClick={() => setViewingReceipt(item.receipt_url)}
                                className={styles.receiptBtn}
                              >
                                📎 Receipt
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }} className={styles.amountCell}>
                            {formatNaira(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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
                      disabled={isScopedUser}
                      required
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    {isScopedUser && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        🔒 Assigned to your territory / clinic branch
                      </span>
                    )}
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

                {/* Receipt Upload & Preview */}
                <div className={styles.formGroup}>
                  <label>Upload Receipt / Proof of Payment (Image or PDF)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    style={{ padding: '6px' }}
                  />

                  {formData.receipt_url && (
                    <div className={styles.uploadPreviewWrap}>
                      {formData.receipt_url.startsWith('data:image') || formData.receipt_url.startsWith('http') ? (
                        <img
                          src={formData.receipt_url}
                          alt="Receipt Preview"
                          className={styles.uploadPreviewImg}
                        />
                      ) : (
                        <div style={{ fontSize: '13px', color: 'var(--color-navy)', fontWeight: 600 }}>
                          📄 Document Attached
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                          ✓ Receipt attached successfully
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, receipt_url: '' })}
                          style={{
                            padding: '2px 8px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            width: 'fit-content',
                          }}
                        >
                          ✕ Remove Receipt
                        </button>
                      </div>
                    </div>
                  )}
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

      {/* Lightbox Receipt Viewer Modal */}
      {viewingReceipt && (
        <div className={styles.modalBackdrop} onClick={() => setViewingReceipt(null)}>
          <div
            className={styles.modalContent}
            style={{ maxWidth: '700px', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>🧾 Receipt & Proof of Payment</h2>
              <button onClick={() => setViewingReceipt(null)} className={styles.closeBtn}>
                ✕
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              {viewingReceipt.startsWith('data:image') || viewingReceipt.startsWith('http') ? (
                <img
                  src={viewingReceipt}
                  alt="Receipt Full View"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '65vh',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
              ) : (
                <div style={{ padding: '40px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%' }}>
                  <p style={{ fontWeight: 600, color: 'var(--color-navy)' }}>Document Attached</p>
                  <a
                    href={viewingReceipt}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--color-ocean)', textDecoration: 'underline', fontSize: '14px' }}
                  >
                    Open Document Reference →
                  </a>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const printWin = window.open('', '_blank');
                    if (printWin) {
                      printWin.document.write(`<html><head><title>Receipt</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${viewingReceipt}" style="max-width:95vw;max-height:95vh;"/></body></html>`);
                      printWin.document.close();
                      printWin.focus();
                      setTimeout(() => printWin.print(), 250);
                    }
                  }}
                  className={styles.exportBtn}
                >
                  🖨️ Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReceipt(null)}
                  className={styles.cancelBtn}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
