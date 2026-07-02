'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useInvoices, useCustomers, useProducts, findCustomerById } from '@/hooks/use-supabase-data';
import styles from './print.module.css';

function fmt(n: number): string {
  return '\u20A6' + n.toLocaleString('en-NG');
}

export default function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading: authLoading } = useAuth();
  const { invoices, loading: invLoading } = useInvoices();
  const { customers } = useCustomers();
  const { products } = useProducts();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!invLoading && invoices.length > 0) {
      setTimeout(() => { setReady(true); window.print(); }, 500);
    }
  }, [invLoading, invoices]);

  const invoice = invoices.find((inv) => inv.id === id || inv.invoice_number === id);
  const customer = invoice ? findCustomerById(customers, invoice.customer_id) : null;

  if (authLoading || invLoading || !invoice) {
    return <div className={styles.loading}>Loading invoice...</div>;
  }

  function statusStyle(status: string): string {
    const map: Record<string, string> = {
      draft: styles.statusDraft,
      sent: styles.statusSent,
      paid: styles.statusPaid,
      partial: styles.statusSent,
      overdue: styles.statusOverdue,
      cancelled: styles.statusDraft,
    };
    return map[status] || '';
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.logoRow}>
            <div className={styles.logoBox}>A</div>
            <div>
              <h1 className={styles.companyName}>Albion Pharmaceuticals</h1>
              <p className={styles.companyTagline}>Nigeria&apos;s Trusted Veterinary Partner</p>
            </div>
          </div>
        </div>
        <div className={styles.invoiceTitle}>
          <h2 className={styles.invoiceHeading}>INVOICE</h2>
          <p className={styles.invoiceNumber}>#{invoice.invoice_number}</p>
        </div>
      </div>

      <div className={styles.metaRow}>
        <span className={`${styles.statusBadge} ${statusStyle(invoice.status)}`}>
          {invoice.status.toUpperCase()}
        </span>
        <span className={styles.metaDate}>Date: {new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <span className={styles.metaDate}>Due: {new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className={styles.billingGrid}>
        <div className={styles.billingBox}>
          <p className={styles.billingLabel}>Bill To</p>
          <p className={styles.billingName}>{customer?.business_name || customer?.name || 'Unknown'}</p>
          <p className={styles.billingDetail}>{customer?.address || ''}<br />{customer?.state || ''}</p>
          <p className={styles.billingDetail}>{customer?.phone || ''}</p>
        </div>
        <div className={styles.billingBox}>
          <p className={styles.billingLabel}>NAFDAC Numbers</p>
          {invoice.items.map((item, i) => {
            const product = products.find((p) => p.id === item.product_id);
            return (
              <p key={i} className={styles.billingDetail}>
                {item.product_name}: {product?.nafdac_number || 'N/A'}
              </p>
            );
          })}
        </div>
      </div>

      <table className={styles.itemsTable}>
        <thead className={styles.tableHead}>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody className={styles.tableBody}>
          {invoice.items.map((item, i) => (
            <tr key={item.id}>
              <td>{i + 1}</td>
              <td>{item.product_name}</td>
              <td>{item.quantity}</td>
              <td>{fmt(item.unit_price)}</td>
              <td>{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.totalsSection}>
        <div className={styles.totalsInner}>
          <div className={styles.totalsColumn}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>VAT (7.5%)</span>
              <span>{fmt(invoice.vat)}</span>
            </div>
            <div className={styles.grandTotalRow}>
              <span>Total</span>
              <span>{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <p>Albion Pharmaceutical Co. Ltd. | Plot 12, Industrial Layout, Onitsha, Anambra State</p>
        <p>Invoice #{invoice.invoice_number} | Generated by AlbionOS</p>
        {!ready && <p className={styles.printNotice}>Preparing print view...</p>}
      </div>
    </div>
  );
}
