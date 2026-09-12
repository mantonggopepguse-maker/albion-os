'use client';

import React, { createContext, useContext, useMemo, useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCustomers, useInvoices, useInventory } from '@/hooks/use-supabase-data';

export interface AppNotification {
  id: string;
  type: 'expiring_stock' | 'overdue_invoice' | 'pending_payment';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  link?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { customers } = useCustomers();
  const { invoices } = useInvoices();
  const { inventory } = useInventory();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('albion_dismissed_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const [now] = useState(() => Date.now());

  const notifications = useMemo<AppNotification[]>(() => {
    if (!user) return [];
    const list: AppNotification[] = [];

    // ── Expiring stock notifications ──
    const nowMs = now;
    for (const item of inventory) {
      if (!item.expiry_date || item.quantity <= 0) continue;
      const days = (new Date(item.expiry_date).getTime() - nowMs) / 86400000;
      if (days <= 0) continue;

      if (days <= 30) {
        list.push({
          id: `exp-${item.id}`,
          type: 'expiring_stock',
          title: 'Stock Expiring Soon',
          message: `${item.batch_number || 'Batch'} expires in ${Math.floor(days)} days (${item.quantity} units)`,
          severity: 'high',
          link: '/inventory',
          createdAt: new Date().toISOString(),
          read: readIds.has(`exp-${item.id}`),
        });
      } else if (days <= 60) {
        list.push({
          id: `exp-${item.id}`,
          type: 'expiring_stock',
          title: 'Stock Expiring',
          message: `${item.batch_number || 'Batch'} expires in ${Math.floor(days)} days`,
          severity: 'medium',
          link: '/inventory',
          createdAt: new Date().toISOString(),
          read: readIds.has(`exp-${item.id}`),
        });
      }
    }

    // ── Overdue invoice notifications ──
    for (const inv of invoices) {
      if (inv.status !== 'overdue') continue;
      list.push({
        id: `inv-overdue-${inv.id}`,
        type: 'overdue_invoice',
        title: 'Overdue Invoice',
        message: `Invoice ${inv.invoice_number} — ${formatCurrency(inv.total)} overdue`,
        severity: 'high',
        link: `/invoices`,
        createdAt: new Date().toISOString(),
        read: readIds.has(`inv-overdue-${inv.id}`),
      });
    }

    // ── Pending payment notifications ──
    const pendingCustomers = customers.filter((c) => c.outstanding_balance > 0);
    for (const c of pendingCustomers) {
      list.push({
        id: `pending-bal-${c.id}`,
        type: 'pending_payment',
        title: 'Outstanding Balance',
        message: `${c.name} — ${formatCurrency(c.outstanding_balance)} outstanding`,
        severity: 'medium',
        link: '/customers',
        createdAt: new Date().toISOString(),
        read: readIds.has(`pending-bal-${c.id}`),
      });
    }

    // Sort: unread first, then by severity, then newest first
    const severityWeight = { high: 0, medium: 1, low: 2 };
    return list.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      const sw = severityWeight[a.severity] - severityWeight[b.severity];
      if (sw !== 0) return sw;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [user, inventory, invoices, customers, now, readIds]);

  const activeNotifications = useMemo(
    () => notifications.filter((n) => !dismissed.has(n.id)),
    [notifications, dismissed]
  );

  const unreadCount = useMemo(
    () => activeNotifications.filter((n) => !n.read).length,
    [activeNotifications]
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem('albion_dismissed_notifications', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setReadIds((prev) => new Set(prev).add(id));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      try {
        localStorage.setItem('albion_dismissed_notifications', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      return next;
    });
  }, [notifications]);

  return (
    <NotificationsContext.Provider
      value={{ notifications: activeNotifications, unreadCount, markAsRead, dismiss, dismissAll }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
