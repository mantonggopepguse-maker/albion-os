/**
 * @file components/layout/MobileNavbar.tsx — Unified Glassmorphic Top Header for Mobile
 *
 * Sticky top navigation bar designed exclusively for mobile viewports (<= 768px).
 * Replaces the stacked double-header (MobileMenu + Topbar) with a single, ultra-slick
 * 56px glassmorphic bar.
 *
 * Components:
 *   - Left: Animated hamburger trigger for the slide-out drawer + current page title.
 *   - Right: Real-time offline sync status dot, notifications dropdown, and user avatar.
 */

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, getRoleColor } from '@/lib/auth-context';
import { NAV_ITEMS } from '@/lib/navigation';
import { getOfflineQueue } from '@/lib/offline-sync';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import styles from './MobileNavbar.module.css';

interface MobileNavbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export default function MobileNavbar({ onToggleSidebar, isSidebarOpen }: MobileNavbarProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  // ── Offline sync state ──
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkQueue = () => {
      try {
        const q = getOfflineQueue();
        setPendingSyncCount(q.length);
      } catch {}
    };

    checkQueue();

    const handleOnline = () => { setIsOnline(true); checkQueue(); };
    const handleOffline = () => { setIsOnline(false); checkQueue(); };
    const handleStatus = (e: Event) => {
      const custom = e as CustomEvent<{ count?: number }>;
      setPendingSyncCount(custom.detail?.count || 0);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('albion:sync-status', handleStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('albion:sync-status', handleStatus);
    };
  }, []);

  if (!user) return null;

  // Resolve current active page title
  const activeItem = NAV_ITEMS.find(
    (item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
  );

  let pageIcon = activeItem?.icon || '🏛️';
  let pageTitle = activeItem?.label || 'AlbionOS';

  if (!activeItem) {
    if (pathname.startsWith('/staff/')) {
      pageIcon = '🧑‍💼';
      pageTitle = 'Staff Profile';
    } else if (pathname.startsWith('/clinic/')) {
      pageIcon = '🏥';
      pageTitle = 'Clinic Detail';
    } else if (pathname.startsWith('/invoices/')) {
      pageIcon = '🧾';
      pageTitle = 'Invoice Details';
    }
  }

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={styles.navbar}>
      {/* Left: Hamburger trigger + Current Page Title */}
      <div className={styles.leftGroup}>
        <button
          className={`${styles.menuBtn} ${isSidebarOpen ? styles.menuBtnOpen : ''}`}
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
          aria-expanded={isSidebarOpen}
        >
          <span className={styles.burger}>
            <span className={styles.burgerLine} />
            <span className={`${styles.burgerLine} ${!isSidebarOpen ? styles.burgerLineShort : ''}`} />
            <span className={styles.burgerLine} />
          </span>
        </button>

        <div className={styles.titleBox}>
          <div className={styles.pageTitle} title={pageTitle}>
            <span>{pageIcon}</span>
            <span>{pageTitle}</span>
          </div>
          <span className={styles.brandSub}>Albion OS</span>
        </div>
      </div>

      {/* Right Controls: Sync Dot + Notifications + Avatar */}
      <div className={styles.rightControls}>
        {/* Offline sync indicator */}
        <div
          className={styles.syncIndicator}
          title={isOnline ? (pendingSyncCount > 0 ? `${pendingSyncCount} offline changes pending sync` : 'Connected to Server') : 'Offline Mode — Changes queued locally'}
        >
          <div className={`${styles.syncDot} ${isOnline ? styles.syncDotOnline : styles.syncDotOffline}`} />
          {pendingSyncCount > 0 && <span className={styles.syncBadge}>{pendingSyncCount}</span>}
        </div>

        {/* Notifications Dropdown */}
        <NotificationDropdown />

        {/* User profile avatar (tapping opens drawer) */}
        <button
          className={styles.avatarBtn}
          style={{ backgroundColor: getRoleColor(user.role) }}
          onClick={onToggleSidebar}
          title={`${user.full_name} — Tap for menu`}
          aria-label="User profile"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
