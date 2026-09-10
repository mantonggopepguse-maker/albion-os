'use client';

import { useState, useCallback, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import { useAuth } from '@/lib/auth-context';
import { useCustomers, useInvoices, usePayments, useInventory, useProducts, useExpenses } from '@/hooks/use-supabase-data';
import Modal from '@/components/ui/Modal';
import styles from './reports.module.css';

interface ReportCard {
  id: string;
  title: string;
  icon: string;
  description: string;
}

interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  dateRange: string;
  dateFrom?: string;
  dateTo?: string;
  generatedAt: string;
  generatedBy: string;
  summary: string;
}

function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };
  const content = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const REPORT_TYPES: ReportCard[] = [
  {
    id: 'sales',
    title: 'Sales Report',
    icon: '📊',
    description: 'Revenue by rep, region, and time period',
  },
  {
    id: 'inventory',
    title: 'Inventory Report',
    icon: '📦',
    description: 'Stock levels, expiry alerts, movement history',
  },
  {
    id: 'financial',
    title: 'Financial Report',
    icon: '💰',
    description: 'Receivables, collections, aging analysis',
  },
  {
    id: 'expenses-pl',
    title: 'Operating P&L Report',
    icon: '📉',
    description: 'Operating overheads, diesel generator, consumables, and net margin',
  },
  {
    id: 'customer',
    title: 'Customer Report',
    icon: '👥',
    description: 'Customer activity, purchase history, balances',
  },
  {
    id: 'rep-performance',
    title: 'Rep Performance',
    icon: '🏆',
    description: 'Sales targets, collection rates, visit logs',
  },
  {
    id: 'expiry',
    title: 'Expiry Report',
    icon: '⚠️',
    description: 'Products expiring within 30/60/90 days',
  },
];

function formatNaira(amount: number): string {
  return `\u20A6${amount.toLocaleString('en-NG')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type ReportView = 'sales' | 'inventory' | 'financial' | 'customer' | 'rep-performance' | 'expiry' | 'expenses-pl' | null;

export default function ReportsPage() {
  const { user: currentUser } = useAuth();
  const { customers } = useCustomers(true);
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { inventory } = useInventory();
  const { products } = useProducts(true);
  const { expenses } = useExpenses();

  const [nowRef] = useState(() => Date.now());

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportCard | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [viewReport, setViewReport] = useState<ReportView>(null);
  const [viewReportItem, setViewReportItem] = useState<GeneratedReport | null>(null);

  const scopedInvoices = useMemo(() => {
    if (!viewReportItem?.dateFrom && !viewReportItem?.dateTo) return invoices;
    return invoices.filter((inv) => {
      if (viewReportItem.dateFrom && new Date(inv.created_at) < new Date(viewReportItem.dateFrom)) return false;
      if (viewReportItem.dateTo && new Date(inv.created_at) > new Date(viewReportItem.dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [invoices, viewReportItem]);

  const scopedPayments = useMemo(() => {
    if (!viewReportItem?.dateFrom && !viewReportItem?.dateTo) return payments;
    return payments.filter((p) => {
      if (viewReportItem.dateFrom && new Date(p.created_at) < new Date(viewReportItem.dateFrom)) return false;
      if (viewReportItem.dateTo && new Date(p.created_at) > new Date(viewReportItem.dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [payments, viewReportItem]);

  const handleGenerate = useCallback((report: ReportCard) => {
    setActiveReport(report);
    setDateFrom('');
    setDateTo('');
    setShowGenerateModal(true);
  }, []);

  const generateReport = useCallback(() => {
    if (!activeReport) return;

    const inRangeInvoices = invoices.filter((inv) => {
      if (dateFrom && new Date(inv.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(inv.created_at) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
    const inRangePayments = payments.filter((p) => {
      if (dateFrom && new Date(p.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(p.created_at) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });

    const buildSummaryLocal = (type: string): string => {
      switch (type) {
        case 'sales': {
          const totalRevenue = inRangeInvoices.reduce((s, i) => s + i.total, 0);
          const totalInvoices = inRangeInvoices.length;
          return `${totalInvoices} invoices, ${formatNaira(totalRevenue)} total revenue`;
        }
        case 'inventory': {
          const totalItems = inventory.reduce((s, i) => s + i.quantity, 0);
          const expiringCount = inventory.filter((i) => {
            const days = (new Date(i.expiry_date).getTime() - nowRef) / 86400000;
            return days > 0 && days <= 90;
          }).length;
          return `${inventory.length} batches, ${totalItems} units, ${expiringCount} expiring within 90 days`;
        }
        case 'financial': {
          const totalOutstanding = customers.reduce((s, c) => s + c.outstanding_balance, 0);
          const totalApproved = inRangePayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
          const totalPending = inRangePayments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
          return `${formatNaira(totalOutstanding)} outstanding, ${formatNaira(totalApproved)} collected, ${formatNaira(totalPending)} pending`;
        }
        case 'customer': {
          const activeCustomers = customers.filter((c) => c.is_active !== false).length;
          const withBalance = customers.filter((c) => c.outstanding_balance > 0).length;
          return `${activeCustomers} active customers, ${withBalance} with outstanding balance`;
        }
        case 'rep-performance': {
          const totalInvoiced = inRangeInvoices.reduce((s, i) => s + i.total, 0);
          const totalCollected = inRangePayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
          const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;
          return `${formatNaira(totalInvoiced)} invoiced, ${formatNaira(totalCollected)} collected (${collectionRate}% rate)`;
        }
        case 'expiry': {
          const within30 = inventory.filter((i) => {
            const days = (new Date(i.expiry_date).getTime() - nowRef) / 86400000;
            return days > 0 && days <= 30;
          }).length;
          const within60 = inventory.filter((i) => {
            const days = (new Date(i.expiry_date).getTime() - nowRef) / 86400000;
            return days > 30 && days <= 60;
          }).length;
          const within90 = inventory.filter((i) => {
            const days = (new Date(i.expiry_date).getTime() - nowRef) / 86400000;
            return days > 60 && days <= 90;
          }).length;
          return `${within30} expiring within 30 days, ${within60} within 60 days, ${within90} within 90 days`;
        }
        case 'expenses-pl': {
          const totalOutflow = expenses.reduce((s, e) => s + (e.amount || 0), 0);
          const totalCollected = scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
          const netProfit = totalCollected - totalOutflow;
          return `Operating Expenses: ${formatNaira(totalOutflow)} | Revenue Collected: ${formatNaira(totalCollected)} | Net Operating Profit: ${formatNaira(netProfit)}`;
        }
        default:
          return '';
      }
    };

    const label = dateFrom && dateTo
      ? `${formatDate(dateFrom)} \u2013 ${formatDate(dateTo)}`
      : 'All time';

    const report: GeneratedReport = {
      id: `rpt-${nowRef}`,
      type: activeReport.id,
      title: activeReport.title,
      dateRange: label,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUser?.full_name || 'Unknown',
      summary: buildSummaryLocal(activeReport.id),
    };

    setGeneratedReports((prev) => [report, ...prev]);
    setShowGenerateModal(false);
    setActiveReport(null);
  }, [activeReport, dateFrom, dateTo, currentUser, nowRef, invoices, payments, inventory, customers, expenses, scopedPayments]);

  const handleExportCurrentReport = useCallback(() => {
    if (!viewReport) return;
    const dateTag = new Date().toISOString().slice(0, 10);
    switch (viewReport) {
      case 'sales': {
        const headers = ['Invoice Number', 'Status', 'Total (NGN)', 'Created Date'];
        const rows = scopedInvoices.map((inv) => [inv.invoice_number, inv.status, inv.total, formatDate(inv.created_at)]);
        exportToCsv(`sales_report_${dateTag}`, headers, rows);
        break;
      }
      case 'inventory': {
        const headers = ['Product', 'Batch', 'Quantity', 'Expiry Date', 'Status'];
        const rows = inventory.map((item) => [
          products.find((p) => p.id === item.product_id)?.name || item.product_id,
          item.batch_number,
          item.quantity,
          formatDate(item.expiry_date),
          item.status.replace('_', ' '),
        ]);
        exportToCsv(`inventory_report_${dateTag}`, headers, rows);
        break;
      }
      case 'financial': {
        const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const totalColl = scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
        const headers = ['Category', 'Amount (NGN)'];
        const rows = [
          ['Total Outstanding', customers.reduce((s, c) => s + c.outstanding_balance, 0)],
          ['Collected (Approved)', totalColl],
          ['Operating Expenses', totalExp],
          ['Net Operating Profit', totalColl - totalExp],
          ['Pending Approval', scopedPayments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0)],
          ['Rejected', scopedPayments.filter((p) => p.status === 'rejected').reduce((s, p) => s + p.amount, 0)],
        ];
        exportToCsv(`financial_report_${dateTag}`, headers, rows);
        break;
      }
      case 'expenses-pl': {
        const headers = ['Date', 'Location', 'Category', 'Description', 'Vendor', 'Amount (NGN)'];
        const rows = expenses.map((e) => [
          e.expense_date,
          e.location_name || e.location_id,
          e.category,
          e.description,
          e.vendor_name || '—',
          e.amount,
        ]);
        exportToCsv(`operating_pl_report_${dateTag}`, headers, rows);
        break;
      }
      case 'customer': {
        const headers = ['Business Name', 'Contact Name', 'State', 'Outstanding Balance (NGN)', 'Credit Limit (NGN)', 'Status'];
        const rows = customers.map((c) => [c.business_name, c.name, c.state, c.outstanding_balance, c.credit_limit, c.is_active === false ? 'Inactive' : 'Active']);
        exportToCsv(`customer_report_${dateTag}`, headers, rows);
        break;
      }
      case 'rep-performance': {
        const headers = ['Metric', 'Value'];
        const totalInvoiced = scopedInvoices.reduce((s, i) => s + i.total, 0);
        const totalCollected = scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
        const rate = totalInvoiced > 0 ? `${Math.round((totalCollected / totalInvoiced) * 100)}%` : 'N/A';
        const rows = [
          ['Total Invoiced (NGN)', totalInvoiced],
          ['Total Collected (NGN)', totalCollected],
          ['Collection Rate', rate],
        ];
        exportToCsv(`rep_performance_${dateTag}`, headers, rows);
        break;
      }
      case 'expiry': {
        const headers = ['Batch', 'Quantity', 'Expiry Date', 'Days Left'];
        const rows = inventory
          .map((item) => ({ item, days: (new Date(item.expiry_date).getTime() - nowRef) / 86400000 }))
          .filter(({ days }) => days > 0 && days <= 90)
          .sort((a, b) => a.days - b.days)
          .map(({ item, days }) => [item.batch_number, item.quantity, formatDate(item.expiry_date), Math.floor(days)]);
        exportToCsv(`expiry_report_${dateTag}`, headers, rows);
        break;
      }
    }
  }, [viewReport, scopedInvoices, scopedPayments, inventory, customers, products, nowRef]);

  const viewReportData = viewReport ? (
    <div style={{ padding: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
            Date Range:
          </span>{' '}
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-navy)', background: 'var(--color-bg)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
            {viewReportItem?.dateRange || 'All time'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <a
            href={`/reports/print?type=${viewReport}&range=${encodeURIComponent(viewReportItem?.dateRange || 'All Time')}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.generateBtn}
            style={{
              width: 'auto',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              textDecoration: 'none',
              background: 'white',
              color: 'var(--color-navy)',
              border: '1px solid var(--color-border)',
            }}
          >
            🖨️ Print Executive Report
          </a>
          <button
            className={styles.generateBtn}
            style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
            onClick={handleExportCurrentReport}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {viewReport === 'sales' && (
        <div>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-navy)' }}>Sales Report</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Invoice</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Total</th>
                <th style={{ padding: '0.5rem' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {scopedInvoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.5rem' }}>{inv.invoice_number}</td>
                  <td style={{ padding: '0.5rem' }}><span style={{ textTransform: 'capitalize' }}>{inv.status}</span></td>
                  <td style={{ padding: '0.5rem' }}>{formatNaira(inv.total)}</td>
                  <td style={{ padding: '0.5rem' }}>{formatDate(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                <td style={{ padding: '0.5rem' }} colSpan={2}>Total</td>
                <td style={{ padding: '0.5rem' }}>{formatNaira(scopedInvoices.reduce((s, i) => s + i.total, 0))}</td>
                <td style={{ padding: '0.5rem' }}>{scopedInvoices.length} invoices</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {viewReport === 'inventory' && (
        <div>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-navy)' }}>Inventory Report</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Product</th>
                <th style={{ padding: '0.5rem' }}>Batch</th>
                <th style={{ padding: '0.5rem' }}>Quantity</th>
                <th style={{ padding: '0.5rem' }}>Expiry</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 600 }}>{products.find((p) => p.id === item.product_id)?.name || item.product_id}</td>
                  <td style={{ padding: '0.5rem' }}>{item.batch_number}</td>
                  <td style={{ padding: '0.5rem' }}>{item.quantity}</td>
                  <td style={{ padding: '0.5rem' }}>{formatDate(item.expiry_date)}</td>
                  <td style={{ padding: '0.5rem' }}><span style={{ textTransform: 'capitalize' }}>{item.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewReport === 'financial' && (
        <div>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-navy)' }}>Financial Report</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Total Outstanding</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>{formatNaira(customers.reduce((s, c) => s + c.outstanding_balance, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Collected (Approved)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{formatNaira(scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Operating Expenses</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>{formatNaira(expenses.reduce((s, e) => s + (e.amount || 0), 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Net Operating Profit</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0) >= expenses.reduce((s, e) => s + (e.amount || 0), 0) ? '#059669' : '#dc2626' }}>
                {formatNaira(scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0) - expenses.reduce((s, e) => s + (e.amount || 0), 0))}
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Pending Approval</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{formatNaira(scopedPayments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Rejected Payments</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#64748b' }}>{formatNaira(scopedPayments.filter((p) => p.status === 'rejected').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
          </div>
          <h5 style={{ margin: '1rem 0 0.5rem', color: 'var(--color-navy)' }}>Aging Analysis</h5>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Customer</th>
                <th style={{ padding: '0.5rem' }}>Balance</th>
                <th style={{ padding: '0.5rem' }}>Credit Limit</th>
                <th style={{ padding: '0.5rem' }}>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {customers.filter((c) => c.outstanding_balance > 0).map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.5rem' }}>{c.business_name}</td>
                  <td style={{ padding: '0.5rem' }}>{formatNaira(c.outstanding_balance)}</td>
                  <td style={{ padding: '0.5rem' }}>{formatNaira(c.credit_limit)}</td>
                  <td style={{ padding: '0.5rem' }}>{Math.round((c.outstanding_balance / c.credit_limit) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewReport === 'expenses-pl' && (
        <div>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-navy)' }}>Operating Profit & Loss (P&L) Report</h4>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Consolidated operating expenditures against verified sales revenue collections.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Gross Revenue Collected</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>
                {formatNaira(scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0))}
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Total Operating Expenses</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
                {formatNaira(expenses.reduce((s, e) => s + (e.amount || 0), 0))}
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Net Operating Margin</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0) >= expenses.reduce((s, e) => s + (e.amount || 0), 0) ? '#059669' : '#dc2626' }}>
                {formatNaira(scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0) - expenses.reduce((s, e) => s + (e.amount || 0), 0))}
              </div>
            </div>
          </div>

          <h5 style={{ margin: '1rem 0 0.5rem', color: 'var(--color-navy)' }}>Recent Operating Expenditures</h5>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Date</th>
                <th style={{ padding: '0.5rem' }}>Location</th>
                <th style={{ padding: '0.5rem' }}>Category</th>
                <th style={{ padding: '0.5rem' }}>Description</th>
                <th style={{ padding: '0.5rem' }}>Vendor / Payee</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatDate(exp.expense_date)}</td>
                  <td style={{ padding: '0.5rem' }}>{exp.location_name || 'Branch'}</td>
                  <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{exp.category.replace('_', ' ')}</td>
                  <td style={{ padding: '0.5rem' }}>{exp.description}</td>
                  <td style={{ padding: '0.5rem' }}>{exp.vendor_name || '—'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                    {formatNaira(exp.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewReport === 'customer' && (
        <div>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-navy)' }}>Customer Report</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Business</th>
                <th style={{ padding: '0.5rem' }}>Contact</th>
                <th style={{ padding: '0.5rem' }}>State</th>
                <th style={{ padding: '0.5rem' }}>Outstanding</th>
                <th style={{ padding: '0.5rem' }}>Credit Limit</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.5rem' }}>{c.business_name}</td>
                  <td style={{ padding: '0.5rem' }}>{c.name}</td>
                  <td style={{ padding: '0.5rem' }}>{c.state}</td>
                  <td style={{ padding: '0.5rem' }}>{formatNaira(c.outstanding_balance)}</td>
                  <td style={{ padding: '0.5rem' }}>{formatNaira(c.credit_limit)}</td>
                  <td style={{ padding: '0.5rem' }}>{c.is_active === false ? 'Inactive' : 'Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewReport === 'rep-performance' && (
        <div>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-navy)' }}>Rep Performance Report</h4>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Showing aggregate sales performance across all reps.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Total Invoiced</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>{formatNaira(scopedInvoices.reduce((s, i) => s + i.total, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Total Collected</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{formatNaira(scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Collection Rate</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{scopedInvoices.length > 0 ? `${Math.round((scopedPayments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0) / scopedInvoices.reduce((s, i) => s + i.total, 0)) * 100)}%` : 'N/A'}</div>
            </div>
          </div>
        </div>
      )}
      {viewReport === 'expiry' && (
        <div>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-navy)' }}>Expiry Report</h4>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Products approaching their expiry dates. Take action on items within 90 days.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Batch</th>
                <th style={{ padding: '0.5rem' }}>Quantity</th>
                <th style={{ padding: '0.5rem' }}>Expiry Date</th>
                <th style={{ padding: '0.5rem' }}>Days Left</th>
              </tr>
            </thead>
            <tbody>
              {inventory
                .map((item) => ({ item, days: (new Date(item.expiry_date).getTime() - nowRef) / 86400000 }))
                .filter(({ days }) => days > 0 && days <= 90)
                .sort((a, b) => a.days - b.days)
                .map(({ item, days }) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.5rem' }}>{item.batch_number}</td>
                    <td style={{ padding: '0.5rem' }}>{item.quantity}</td>
                    <td style={{ padding: '0.5rem' }}>{formatDate(item.expiry_date)}</td>
                    <td style={{ padding: '0.5rem', color: days <= 30 ? '#dc2626' : days <= 60 ? '#b45309' : 'inherit', fontWeight: days <= 30 ? 700 : 400 }}>
                      {Math.floor(days)} days
                    </td>
                  </tr>
                ))}
              {inventory.filter((i) => {
                const days = (new Date(i.expiry_date).getTime() - nowRef) / 86400000;
                return days > 0 && days <= 90;
              }).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No products expiring within 90 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <Topbar title="Reports" />

      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.heading}>Reports Center</h2>
            <p className={styles.subheading}>
              Generate and view detailed reports across all business areas
            </p>
          </div>
        </div>

        <div className={styles.grid}>
          {REPORT_TYPES.map((report, index) => (
            <div
              key={report.id}
              className={styles.card}
              style={{ animationDelay: `${index * 0.07}s` }}
            >
              <div className={styles.cardIcon}>
                <span>{report.icon}</span>
              </div>

              <h3 className={styles.cardTitle}>{report.title}</h3>
              <p className={styles.cardDescription}>{report.description}</p>

              <div className={styles.cardFooter}>
                <button
                  className={styles.generateBtn}
                  onClick={() => handleGenerate(report)}
                >
                  Generate
                </button>

                <button
                  className={styles.optionsBtn}
                  title="Report options"
                  onClick={() => handleGenerate(report)}
                >
                  ⋯
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.recentSection}>
          <div className={styles.recentHeader}>
            <h3 className={styles.recentTitle}>Recent Reports</h3>
            {generatedReports.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {generatedReports.length} report{generatedReports.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {generatedReports.length === 0 ? (
            <div className={styles.recentEmpty}>
              <span className={styles.recentEmptyIcon}>📋</span>
              <p className={styles.recentEmptyText}>No reports generated yet</p>
              <p className={styles.recentEmptySub}>
                Click &quot;Generate&quot; on any report card above to create your first report
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Report</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Range</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Generated</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {generatedReports.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{r.title}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{r.dateRange}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>
                      <div>{formatDateTime(r.generatedAt)}</div>
                      <div style={{ fontSize: '0.8rem' }}>by {r.generatedBy}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', maxWidth: '250px' }}>{r.summary}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        className={styles.generateBtn}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', width: 'auto', flex: 'none' }}
                        onClick={() => {
                          setViewReport(r.type as ReportView);
                          setViewReportItem(r);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title={`Generate ${activeReport?.title || 'Report'}`}
        subtitle="Set the date range for the report"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate)' }}>Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowGenerateModal(false)}
              style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', color: 'var(--color-slate)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={generateReport}
              style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', background: 'var(--color-navy)', color: '#fff', cursor: 'pointer' }}
            >
              Generate Report
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewReport !== null}
        onClose={() => {
          setViewReport(null);
          setViewReportItem(null);
        }}
        title={viewReportItem?.title || 'Report View'}
      >
        {viewReportData}
      </Modal>
    </>
  );
}
