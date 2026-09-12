/**
 * @file components/layout/Topbar.tsx — Top Navigation Bar
 *
 * A horizontal header bar displayed at the top of every dashboard page.
 * It complements the `Sidebar` by providing:
 *   1. **Page title** — an optional `title` prop rendered as an `<h1>`.
 *      Each page passes its own title (e.g., "Dashboard", "Products").
 *   2. **Notification bell** — a placeholder button with a coloured dot
 *      indicating unread notifications (currently static / cosmetic).
 *   3. **User menu** — shows the user's colour-coded avatar (initials),
 *      full name, role label, and a logout button.
 *
 * Logout flow:
 *   When the user clicks the logout button:
 *     1. `logout()` from auth context signs out via Supabase and clears user state.
 *     2. `router.push('/login')` navigates to the login page.
 */

'use client';

/* ────────────────────────────────────────────
   Dependencies
   ──────────────────────────────────────────── */
import { useState, useEffect } from 'react';
import { useAuth, getRoleLabel, getRoleColor } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { getOfflineQueue } from '@/lib/offline-sync';
import LocaleSwitcher from '@/components/i18n/LocaleSwitcher';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import styles from './Topbar.module.css';

/* ────────────────────────────────────────────
   Topbar Component
   ──────────────────────────────────────────── */

/**
 * Topbar — the top navigation bar for authenticated dashboard pages.
 *
 * @param title - Optional page title displayed on the left side of the bar.
 *                When omitted, the left section is simply empty.
 * @returns The `<header>` element containing the topbar, or `null` if
 *          no user is logged in (safety guard).
 */
export default function Topbar({ title }: { title?: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── Offline sync state (hooks unconditionally at the top) ──
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

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

  // Guard: render nothing if there's no authenticated user.
  if (!user) return null;

  /* ── User initials for avatar ──
     Same algorithm as Sidebar: split full name on spaces, take the
     first character of each word, join, and slice to 2 characters.
     e.g., "Ngozi Eze" → "NE" */
  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  /**
   * handleLogout — clears the auth session and navigates to login.
   *
   * `logout()` signs the user out via Supabase Auth and clears user state.
   * After that, redirect to `/login` via `router.push`.
   */
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const roleDisplay = user.roles && user.roles.length > 1
    ? user.roles.map((r) => getRoleLabel(r)).join(' · ')
    : getRoleLabel(user.role);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { syncPendingMutations } = await import('@/lib/offline-sync');
      const res = await syncPendingMutations();
      setPendingSyncCount(res.remaining);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className={styles.topbar}>

      {/* ── Left section: Page Title ── */}
      <div className={styles.left}>
        {title && <h1 className={styles.title}>{title}</h1>}
      </div>

      {/* ── Right section: Locale Switcher + Sync + Notifications + User Menu ── */}
      <div className={styles.right}>

        {/* Network & Sync indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
          {!isOnline || pendingSyncCount > 0 ? (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              title={isOnline ? `${pendingSyncCount} pending offline changes. Click to sync.` : 'Offline mode active.'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-full)',
                background: isOnline ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: isOnline ? '#b45309' : '#b91c1c',
                border: `1px solid ${isOnline ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                cursor: 'pointer',
              }}
            >
              <span>{isOnline ? '🟠' : '🔴'}</span>
              <span>{isOnline ? `${pendingSyncCount} pending` : 'Offline'}</span>
              <span style={{ transform: syncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>🔄</span>
            </button>
          ) : (
            <span
              title="System connected and synchronized"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#15803d',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                fontSize: '0.7rem',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Live
            </span>
          )}
        </div>

        <LocaleSwitcher />

        <NotificationDropdown />

        {/* User Menu
            Displays the authenticated user's avatar (colour-coded by
            role), full name, role label, and a logout button. */}
        <div className={styles.userMenu}>
          <div
            className={styles.avatar}
            style={{ backgroundColor: getRoleColor(user.role) }}
          >
            {initials}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.full_name}</span>
            <span className={styles.userRole} title={roleDisplay}>{roleDisplay}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            🚪
          </button>
        </div>
      </div>
    </header>
  );
}

