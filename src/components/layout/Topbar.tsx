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
import { useAuth, getRoleLabel, getRoleColor } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import LocaleSwitcher from '@/components/i18n/LocaleSwitcher';
import { NotificationsProvider } from '@/lib/notifications-context';
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

  return (
    <header className={styles.topbar}>

      {/* ── Left section: Page Title ── */}
      <div className={styles.left}>
        {title && <h1 className={styles.title}>{title}</h1>}
      </div>

      {/* ── Right section: Locale Switcher + Notifications + User Menu ── */}
      <div className={styles.right}>

        <LocaleSwitcher />

        <NotificationsProvider>
          <NotificationDropdown />
        </NotificationsProvider>

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
            <span className={styles.userRole}>{getRoleLabel(user.role)}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            🚪
          </button>
        </div>
      </div>
    </header>
  );
}

