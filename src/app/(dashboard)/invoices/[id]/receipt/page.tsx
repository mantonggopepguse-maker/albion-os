'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  useInvoices,
  usePayments,
  useCustomers,
  useProducts,
  useUsers,
  findCustomerById,
} from '@/hooks/use-supabase-data';
import styles from './receipt.module.css';

function fmt(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}

export default function InvoiceReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading: authLoading } = useAuth();
  const { invoices, loading: invLoading } = useInvoices();
  const { payments, loading: payLoading } = usePayments();
  const { customers } = useCustomers();
  const { products } = useProducts();
  const { users } = useUsers();
  const router = useRouter();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const invoice = invoices.find((inv) => inv.id === id || inv.invoice_number === id);
  const customer = invoice ? findCustomerById(customers, invoice.customer_id) : null;
  const salesRep = invoice ? users.find((u) => u.id === invoice.sales_rep_id) : null;

  if (authLoading || invLoading || payLoading || !invoice) {
    return <div className={styles.loading}>Loading official sales receipt...</div>;
  }

  const receiptNumber = `RCT-${invoice.invoice_number.replace('INV-', '')}`;
  const vatRate = invoice.vat_rate ?? 7.5;
  const vatAmount = invoice.vat || Math.round(invoice.subtotal * (vatRate / 100));
  const discountAmount = invoice.discount_amount || 0;

  // Reconcile against approved payments
  const approvedPayments = payments.filter(
    (p) => p.invoice_id === invoice.id && p.status === 'approved'
  );
  const totalApprovedPayments = approvedPayments.reduce((sum, p) => sum + p.amount, 0);

  const isMarkedPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';
  const amountPaid = isCancelled ? 0 : isMarkedPaid ? Math.max(invoice.total, totalApprovedPayments) : totalApprovedPayments;
  const balanceDue = isCancelled ? 0 : Math.max(0, invoice.total - amountPaid);
  const isFullyPaid = !isCancelled && (isMarkedPaid || (amountPaid >= invoice.total && invoice.total > 0));
  const isPartiallyPaid = !isCancelled && !isFullyPaid && amountPaid > 0;
  const isUnpaid = !isCancelled && !isFullyPaid && !isPartiallyPaid;

  let watermarkText = 'PAID';
  let watermarkClass = styles.watermark;
  if (isCancelled) {
    watermarkText = 'CANCELLED';
    watermarkClass = `${styles.watermark} ${styles.watermarkVoid}`;
  } else if (isFullyPaid) {
    watermarkText = 'PAID';
    watermarkClass = styles.watermark;
  } else if (isPartiallyPaid) {
    watermarkText = 'PARTIAL';
    watermarkClass = `${styles.watermark} ${styles.watermarkPartial}`;
  } else {
    watermarkText = invoice.status === 'draft' ? 'DRAFT' : 'UNPAID';
    watermarkClass = `${styles.watermark} ${styles.watermarkUnpaid}`;
  }

  let receiptHeading = 'OFFICIAL RECEIPT';
  if (isCancelled) receiptHeading = 'VOID SALES RECORD';
  else if (isPartiallyPaid) receiptHeading = 'PAYMENT STATEMENT / PARTIAL RECEIPT';
  else if (isUnpaid) receiptHeading = 'PAYMENT STATEMENT (UNPAID)';

  let statusBadgeClass = styles.statusBadge;
  let statusBadgeText = '✓ PAYMENT RECEIVED & CONFIRMED';
  let statusSubText = 'Settled in Full';

  if (isCancelled) {
    statusBadgeClass = `${styles.statusBadge} ${styles.statusBadgeVoid}`;
    statusBadgeText = '✕ TRANSACTION CANCELLED';
    statusSubText = 'Voided Document';
  } else if (isPartiallyPaid) {
    statusBadgeClass = `${styles.statusBadge} ${styles.statusBadgePartial}`;
    statusBadgeText = `⏳ PARTIAL PAYMENT (₦${amountPaid.toLocaleString()} RECEIVED)`;
    statusSubText = `Balance Remaining: ₦${balanceDue.toLocaleString()}`;
  } else if (isUnpaid) {
    statusBadgeClass = `${styles.statusBadge} ${styles.statusBadgeUnpaid}`;
    statusBadgeText = '⚠️ PAYMENT PENDING';
    statusSubText = invoice.status === 'draft' ? 'Draft Invoice — Not Yet Dispatched' : 'Awaiting Payment Approval';
  }

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      {/* On-screen action toolbar (hidden during print) */}
      <div className={styles.screenToolbar}>
        <Link href="/invoices" className={styles.backBtn}>
          ← Back to Invoices
        </Link>
        <div className={styles.actionGroup}>
          <button onClick={handleShare} className={styles.shareBtn}>
            {copied ? '✓ Copied Link' : '🔗 Copy Link / Share'}
          </button>
          <button onClick={handlePrint} className={styles.printBtn}>
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      <div className={styles.container}>
        {/* Diagonal Watermark */}
        <div className={watermarkClass}>{watermarkText}</div>

        {/* Company Header */}
        <div className={styles.header}>
          <div className={styles.logoRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/albion-logo.svg" alt="Albion Pharmaceuticals" className={styles.logoImg} />
            <div>
              <h1 className={styles.companyName}>Albion Pharmaceuticals</h1>
              <p className={styles.companyTagline}>
                Albion Pharmaceuticals (Nigeria) Limited • RC-1489201
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Plot 12, Industrial Layout, Onitsha, Anambra State | Lagos Liaison Office
              </p>
            </div>
          </div>
          <div className={styles.receiptTitle}>
            <h2
              className={styles.receiptHeading}
              style={
                isCancelled
                  ? { color: '#be123c' }
                  : isPartiallyPaid
                  ? { color: '#b45309' }
                  : isUnpaid
                  ? { color: '#475569' }
                  : undefined
              }
            >
              {receiptHeading}
            </h2>
            <p className={styles.receiptNumber}>Receipt No: #{receiptNumber}</p>
            <p className={styles.invoiceRef}>Invoice Ref: #{invoice.invoice_number}</p>
          </div>
        </div>

        {/* Status & Meta Row */}
        <div className={styles.metaRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className={statusBadgeClass}>
              <span>{isCancelled ? '✕' : isFullyPaid ? '✓' : isPartiallyPaid ? '⏳' : '⚠️'}</span> {statusBadgeText}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              • {statusSubText}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span className={styles.metaDate}>
              <strong>Date Issued:</strong>{' '}
              {new Date(invoice.created_at).toLocaleDateString('en-NG', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Customer & Rep Details */}
        <div className={styles.billingGrid}>
          <div className={styles.billingBox}>
            <p className={styles.billingLabel}>Received From (Customer)</p>
            <p className={styles.billingName}>{customer?.business_name || customer?.name || 'Customer'}</p>
            <p className={styles.billingDetail}>{customer?.address || 'Nigeria'}</p>
            <p className={styles.billingDetail}>{customer?.state || 'Anambra'}</p>
            <p className={styles.billingDetail}>📞 {customer?.phone || '—'}</p>
          </div>
          <div className={styles.billingBox}>
            <p className={styles.billingLabel}>Issuing Representative & Branch</p>
            <p className={styles.billingName}>{salesRep?.full_name || user?.full_name || 'Commercial Division'}</p>
            <p className={styles.billingDetail}>Role: Field Sales Executive / Officer</p>
            <p className={styles.billingDetail}>Payment Verification: Electronic Clearing / Verified</p>
            <p className={styles.billingDetail}>Account Reference: RC-1489201-ALBION</p>
          </div>
        </div>

        {/* Purchased Items Table */}
        <table className={styles.itemsTable}>
          <thead className={styles.tableHead}>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Description / Product</th>
              <th style={{ width: '150px' }}>NAFDAC Reg No.</th>
              <th style={{ width: '60px' }}>Qty</th>
              <th style={{ width: '120px' }}>Unit Price (₦)</th>
              <th style={{ width: '130px' }}>Total (₦)</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item, i) => {
                const prod = products.find((p) => p.id === item.product_id);
                return (
                  <tr key={item.id || i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.product_name || prod?.name}</td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>{prod?.nafdac_number || 'NAFDAC-REG'}</td>
                    <td>{item.quantity}</td>
                    <td>{fmt(item.unit_price)}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(item.total)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '16px' }}>
                  Commercial sales order: {fmt(invoice.total)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className={styles.totalsSection}>
          <div className={styles.totalsColumn}>
            <div className={styles.totalRow}>
              <span>Subtotal:</span>
              <span style={{ fontWeight: 600 }}>{fmt(invoice.subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className={styles.totalRow} style={{ color: '#15803d' }}>
                <span>
                  Discount Applied ({invoice.discount_type === 'percent' ? `${invoice.discount_value}%` : 'Special Promo'}):
                </span>
                <span style={{ fontWeight: 600 }}>- {fmt(discountAmount)}</span>
              </div>
            )}

            <div className={styles.totalRow}>
              <span>Value Added Tax (VAT {vatRate}%):</span>
              <span style={{ fontWeight: 600 }}>{fmt(vatAmount)}</span>
            </div>

            <div className={styles.grandTotalRow}>
              <span>Total Bill:</span>
              <span>{fmt(invoice.total)}</span>
            </div>

            <div
              className={
                isFullyPaid
                  ? styles.paidTotalRow
                  : isPartiallyPaid
                  ? `${styles.paidTotalRow} ${styles.statusBadgePartial}`
                  : styles.totalRow
              }
              style={{
                marginTop: '6px',
                padding: isFullyPaid || isPartiallyPaid ? '8px 12px' : '4px 0',
                borderRadius: '6px',
              }}
            >
              <span>Amount Paid:</span>
              <span style={{ fontWeight: 800 }}>{fmt(amountPaid)}</span>
            </div>

            <div className={styles.totalRow} style={{ marginTop: '6px', fontSize: '13px' }}>
              <span>Balance Due:</span>
              <span
                style={{
                  fontWeight: 700,
                  color: isFullyPaid ? '#15803d' : balanceDue > 0 ? '#dc2626' : '#64748b',
                }}
              >
                {balanceDue <= 0 ? '₦0.00 (PAID IN FULL)' : `${fmt(balanceDue)} (OUTSTANDING)`}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <p style={{ fontWeight: 700, color: '#093961', margin: '0 0 4px' }}>
            Thank you for choosing Albion Pharmaceuticals!
          </p>
          <p style={{ margin: '0 0 4px' }}>
            Official customer payment receipt generated by AlbionOS Enterprise • NAFDAC Regulated Distribution
          </p>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            For corporate enquiries or consignment tracking, contact: support@albionpharmaceuticals.com | +234 803 123 4567
          </p>
        </div>
      </div>
    </>
  );
}
