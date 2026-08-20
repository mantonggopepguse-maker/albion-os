/**
 * @file components/layout/Sidebar.tsx — Main Navigation Sidebar
 *
 * The persistent sidebar displayed on every authenticated dashboard page.
 * It is rendered by `DashboardShell` in `(dashboard)/layout.tsx`.
 *
 * Key features:
 *   1. **Role-based navigation** — only shows menu items the current
 *      user's role is allowed to see. The filtering is delegated to
 *      `getNavItemsForRole()` from `@/lib/navigation`, which checks
 *      each item's `roles` array against the user's role.
 *   2. **Active route highlighting** — uses Next.js `usePathname()`
 *      to detect the current URL and apply an active class.
 *   3. **User profile card** — displays the logged-in user's initials
 *      (computed from their full name), name, and role label at the
 *      bottom of the sidebar.
 *   4. **Notification badges** — nav items can optionally carry a
 *      numeric badge (e.g., unread counts), rendered as a small pill.
 *
 * Layout structure:
 *   ┌─────────────────┐
 *   │  Logo / Brand   │
 *   ├─────────────────┤
 *   │  Nav Items      │  ← role-filtered, with active indicator
 *   │  ...            │
 *   ├─────────────────┤
 *   │  User Card      │  ← avatar initials + name + role
 *   └─────────────────┘
 */

'use client';

/* ────────────────────────────────────────────
   Dependencies
   ──────────────────────────────────────────── */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, getRoleLabel, getRoleColor } from '@/lib/auth-context';
import { getNavItemsForRole } from '@/lib/navigation';
import styles from './Sidebar.module.css';

/* ────────────────────────────────────────────
   Sidebar Component
   ──────────────────────────────────────────── */

/**
 * Sidebar — the main navigation panel for the AlbionOS dashboard.
 *
 * Consumes the auth context to:
 *   - Determine which nav items to show (role-based filtering).
 *   - Display the user's name, role, and colour-coded avatar.
 *
 * @returns The sidebar `<aside>` element, or `null` if no user is logged in.
 */
export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Guard: if there's no authenticated user, render nothing.
  // This shouldn't happen in practice because the DashboardShell
  // already redirects unauthenticated users, but it's a safety net.
  if (!user) return null;

  /* ── Role-based navigation items ──
     `getNavItemsForRole` filters the master NAV_ITEMS array
     (defined in @/lib/navigation.ts) to only include items whose
     `roles` array contains the current user's role.
     e.g., a 'sales_rep' won't see the 'Users' admin page. */
  const navItems = getNavItemsForRole(user.role);

  /* ── User initials generation ──
     Takes the full name (e.g., "Dr. Emeka Moneke"), splits on spaces,
     grabs the first character of each word → "DEM", then slices to
     the first 2 characters → "DE" and uppercases for the avatar. */
  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className={styles.sidebar}>

      {/* ── Logo / Brand Block ── */}
      <div className={styles.logo}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 via-emerald-500 to-teal-700 p-0.5 shadow-md shadow-teal-500/20 flex items-center justify-center flex-shrink-0">
          <div className="w-full h-full rounded-[14px] bg-slate-950/20 backdrop-blur-md flex items-center justify-center overflow-hidden">
            <svg className="w-6 h-6 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="10" width="18" height="9" rx="4.5" transform="rotate(-30 12 14.5)" fill="currentColor" fillOpacity="0.25" />
              <path d="M12 5v14M5 12h14" strokeWidth="2.5" />
              <path d="M17 7c-2 0-4 1.5-4 4.5" stroke="currentColor" strokeWidth="2" opacity="0.85" />
            </svg>
          </div>
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>Albion OS</span>
          <span className={styles.logoSubtitle}>Pharmaceuticals Suite</span>
        </div>
      </div>

      {/* ── Navigation Links ── */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.navSectionLabel}>Menu</span>
          {navItems.map((item) => {
            /* Active route detection:
               A nav item is "active" if the current pathname exactly
               matches the item's href (e.g., "/dashboard" === "/dashboard")
               OR if the pathname starts with the href followed by a slash
               (e.g., "/products/123" starts with "/products/").
               This ensures sub-pages also highlight their parent nav item. */
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {/* Optional numeric badge — only rendered when the value
                    is defined and greater than zero (e.g., unread messages). */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={styles.navBadge}>{item.badge}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── User Profile Card ──
          Anchored to the bottom of the sidebar via CSS flex layout.
          The avatar background colour is role-specific (set via
          `getRoleColor`), providing a quick visual role indicator. */}
      <div className={styles.userCard}>
        <div className={styles.avatar} style={{ backgroundColor: getRoleColor(user.role) }}>
          {initials}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.full_name}</span>
          <span className={styles.userRole}>{getRoleLabel(user.role)}</span>
        </div>
      </div>
    </aside>
  );
}

