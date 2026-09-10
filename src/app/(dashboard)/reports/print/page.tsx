'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useInvoices, usePayments, useExpenses, useCustomers, useInventory } from '@/hooks/use-supabase-data';
import styles from './print.module.css';

function fmtNaira(n: number): string {
  return '₦' + (n || 0).toLocaleString('en-NG');
}

function ReportPrintContent() {
  const searchParams = useSearchParams();
  const reportType = searchParams.get('type') || 'sales';
  const dateRange = searchParams.get('range') || 'All Time';

  const { user } = useAuth();
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { expenses } = useExpenses();
  const { customers } = useCustomers();
  const { inventory } = useInventory();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const reportMeta = useMemo(() => {
    switch (reportType) {
      case 'expenses-pl':
        return {
          title: 'Operating Profit & Loss Statement',
          number: `P&L-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        };
      case 'financial':
        return {
          title: 'Financial & Cash Collections Report',
          number: `FIN-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        };
      case 'inventory':
        return {
          title: 'Inventory Valuation & Batch Stock Report',
          number: `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        };
      case 'customer':
        return {
          title: 'Accounts Receivable & Customer Balances',
          number: `CUST-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        };
      case 'rep-performance':
        return {
          title: 'Commercial Field Sales & Target Realization',
          number: `REP-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        };
      case 'sales':
      default:
        return {
          title: 'Commercial Sales & Invoice Audit Report',
          number: `SALES-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        };
    }
  }, [reportType]);

  // Financial calculations
  const totalInvoiced = useMemo(() => invoices.reduce((s, i) => s + (i.total || 0), 0), [invoices]);
  const totalApprovedCollections = useMemo(
    () => payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const totalOperatingExpenses = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const netOperatingProfit = totalApprovedCollections - totalOperatingExpenses;

  return (
    <div className={styles.container}>
      {/* Top Action Toolbar (hidden on print) */}
      <div className={styles.printActions}>
        <div>
          <strong>Executive Print View:</strong> {reportMeta.title}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.printBtn} onClick={() => window.print()}>
            🖨️ Print to Paper / PDF
          </button>
          <button
            className={styles.printBtn}
            style={{ background: '#64748b' }}
            onClick={() => window.close()}
          >
            Close Window
          </button>
        </div>
      </div>

      {/* Official Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.logoRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/albion-logo.svg" alt="Albion Pharmaceuticals" className={styles.logoImg} />
            <div>
              <h1 className={styles.companyName}>Albion Pharmaceuticals</h1>
              <p className={styles.companyTagline}>Healthcare Delivery & Clinical Operating Systems</p>
            </div>
          </div>
        </div>
        <div className={styles.reportTitle}>
          <h2 className={styles.reportHeading}>{reportMeta.title}</h2>
          <p className={styles.reportNumber}>Document Ref: #{reportMeta.number}</p>
        </div>
      </div>

      {/* Meta Row */}
      <div className={styles.metaRow}>
        <span className={styles.metaBadge}>OFFICIAL EXECUTIVE AUDIT</span>
        <span className={styles.metaDate}>
          <strong>Coverage Period:</strong> {dateRange}
        </span>
        <span className={styles.metaDate}>
          <strong>Generated:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <span className={styles.metaDate}>
          <strong>Sign-off Officer:</strong> {user ? `${user.full_name} (${user.role.toUpperCase()})` : 'Super Admin'}
        </span>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiBox}>
          <p className={styles.kpiLabel}>Gross Invoiced</p>
          <p className={styles.kpiValue}>{fmtNaira(totalInvoiced)}</p>
        </div>
        <div className={styles.kpiBox}>
          <p className={styles.kpiLabel}>Collections</p>
          <p className={styles.kpiValue} style={{ color: '#16a34a' }}>{fmtNaira(totalApprovedCollections)}</p>
        </div>
        <div className={styles.kpiBox}>
          <p className={styles.kpiLabel}>Operating Overheads</p>
          <p className={styles.kpiValue} style={{ color: '#dc2626' }}>{fmtNaira(totalOperatingExpenses)}</p>
        </div>
        <div className={styles.kpiBox}>
          <p className={styles.kpiLabel}>Net Operating Margin</p>
          <p className={styles.kpiValue} style={{ color: netOperatingProfit >= 0 ? '#0284c7' : '#dc2626' }}>
            {fmtNaira(netOperatingProfit)}
          </p>
        </div>
      </div>

      {/* Data Table */}
      {reportType === 'expenses-pl' && (
        <table className={styles.itemsTable}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Date</th>
              <th>Location</th>
              <th>Category</th>
              <th>Description</th>
              <th>Vendor</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.expense_date).toLocaleDateString('en-GB')}</td>
                <td>{e.location_name || 'Main Office'}</td>
                <td><strong style={{ textTransform: 'capitalize' }}>{e.category.replace('_', ' ')}</strong></td>
                <td>{e.description}</td>
                <td>{e.vendor || '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNaira(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportType === 'sales' && (
        <table className={styles.itemsTable}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Invoice #</th>
              <th>Status</th>
              <th>Customer</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Total (NGN)</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><strong>{inv.invoice_number}</strong></td>
                <td><span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '11px' }}>{inv.status}</span></td>
                <td>{inv.customer_id}</td>
                <td>{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNaira(inv.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportType === 'inventory' && (
        <table className={styles.itemsTable}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Batch #</th>
              <th>Location</th>
              <th>Quantity In Stock</th>
              <th>Expiry Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {inventory.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.batch_number}</strong></td>
                <td>{item.location_id}</td>
                <td><strong>{item.quantity}</strong> units</td>
                <td>{new Date(item.expiry_date).toLocaleDateString('en-GB')}</td>
                <td>{new Date(item.expiry_date) < new Date() ? 'EXPIRED' : 'ACTIVE'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportType === 'customer' && (
        <table className={styles.itemsTable}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Business / Customer Name</th>
              <th>Contact Person</th>
              <th>State</th>
              <th>Credit Limit</th>
              <th style={{ textAlign: 'right' }}>Outstanding Balance</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {customers.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.business_name}</strong></td>
                <td>{c.name}</td>
                <td>{c.state}</td>
                <td>{fmtNaira(c.credit_limit)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: c.outstanding_balance > 0 ? '#dc2626' : '#16a34a' }}>
                  {fmtNaira(c.outstanding_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totals Summary */}
      <div className={styles.totalsSection}>
        <div className={styles.totalsInner}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total Revenue Receipts:</span>
            <strong>{fmtNaira(totalApprovedCollections)}</strong>
          </div>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total Operating Overheads:</span>
            <strong style={{ color: '#dc2626' }}>{fmtNaira(totalOperatingExpenses)}</strong>
          </div>
          <div className={styles.grandTotalRow}>
            <span>Net Operating Margin:</span>
            <span style={{ color: netOperatingProfit >= 0 ? '#0284c7' : '#dc2626' }}>
              {fmtNaira(netOperatingProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Executive Sign-Off Block */}
      <div className={styles.signOffGrid}>
        <div className={styles.signOffBox}>
          <div className={styles.signOffLine} />
          <span className={styles.signOffLabel}>Prepared By: Attending Clinical / Finance Director</span>
        </div>
        <div className={styles.signOffBox}>
          <div className={styles.signOffLine} />
          <span className={styles.signOffLabel}>Certified & Approved: Super Administrator / Chief Executive</span>
        </div>
      </div>

      {/* Official Footer */}
      <div className={styles.footer}>
        <p>Albion Pharmaceutical Co. Ltd. &bull; Industrial Layout, Onitsha, Anambra State &bull; Official Operating Report</p>
        <p>Confidential & Proprietary &bull; Certified by AlbionOS Unified Enterprise Core</p>
      </div>
    </div>
  );
}

export default function ReportPrintPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Generating executive audit report...</div>}>
      <ReportPrintContent />
    </Suspense>
  );
}
