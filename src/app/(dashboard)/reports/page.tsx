'use client';

import { useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { useAuth } from '@/lib/auth-context';
import { useCustomers, useInvoices, usePayments, useInventory, useProducts } from '@/hooks/use-supabase-data';
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
  generatedAt: string;
  generatedBy: string;
  summary: string;
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

type ReportView = 'sales' | 'inventory' | 'financial' | 'customer' | 'rep-performance' | 'expiry' | null;

export default function ReportsPage() {
  const { user: currentUser } = useAuth();
  const { customers } = useCustomers(true);
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { inventory } = useInventory();
  const { products } = useProducts(true);

  const [nowRef] = useState(() => Date.now());

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportCard | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [viewReport, setViewReport] = useState<ReportView>(null);

  const handleGenerate = useCallback((report: ReportCard) => {
    setActiveReport(report);
    setDateFrom('');
    setDateTo('');
    setShowGenerateModal(true);
  }, []);

  const generateReport = useCallback(() => {
    if (!activeReport) return;

    const buildSummaryLocal = (type: string): string => {
      switch (type) {
        case 'sales': {
          const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
          const totalInvoices = invoices.length;
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
          const totalApproved = payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
          const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
          return `${formatNaira(totalOutstanding)} outstanding, ${formatNaira(totalApproved)} collected, ${formatNaira(totalPending)} pending`;
        }
        case 'customer': {
          const activeCustomers = customers.filter((c) => c.is_active !== false).length;
          const withBalance = customers.filter((c) => c.outstanding_balance > 0).length;
          return `${activeCustomers} active customers, ${withBalance} with outstanding balance`;
        }
        case 'rep-performance': {
          const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
          const totalCollected = payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
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
      generatedAt: new Date().toISOString(),
      generatedBy: currentUser?.full_name || 'Unknown',
      summary: buildSummaryLocal(activeReport.id),
    };

    setGeneratedReports((prev) => [report, ...prev]);
    setShowGenerateModal(false);
    setActiveReport(null);
  }, [activeReport, dateFrom, dateTo, currentUser, nowRef, invoices, payments, inventory, customers]);

  const viewReportData = viewReport ? (
    <div style={{ padding: '0.5rem' }}>
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
              {invoices.map((inv) => (
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
                <td style={{ padding: '0.5rem' }}>{formatNaira(invoices.reduce((s, i) => s + i.total, 0))}</td>
                <td style={{ padding: '0.5rem' }}>{invoices.length} invoices</td>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Total Outstanding</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>{formatNaira(customers.reduce((s, c) => s + c.outstanding_balance, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Collected (Approved)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{formatNaira(payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Pending Approval</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{formatNaira(payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Rejected</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>{formatNaira(payments.filter((p) => p.status === 'rejected').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
          </div>
          <h5 style={{ margin: '1rem 0 0.5rem', color: 'var(--color-navy)' }}>Aging Analysis</h5>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Customer</th>
                <th style={{ padding: '0.5rem' }}>Outstanding</th>
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
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>{formatNaira(invoices.reduce((s, i) => s + i.total, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Total Collected</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{formatNaira(payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0))}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Collection Rate</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{invoices.length > 0 ? `${Math.round((payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0) / invoices.reduce((s, i) => s + i.total, 0)) * 100)}%` : 'N/A'}</div>
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
                        onClick={() => setViewReport(r.type as ReportView)}
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
        onClose={() => setViewReport(null)}
        title="Report View"
      >
        {viewReportData}
      </Modal>
    </>
  );
}
