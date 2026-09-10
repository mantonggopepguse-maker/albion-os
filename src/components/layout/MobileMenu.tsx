/**
 * @file components/layout/MobileMenu.tsx — Smart Mobile Navigation Menu
 *
 * Mobile-first replacement for the sidebar. On screens ≤768px the sidebar is
 * hidden (see `Sidebar.module.css`) and this menu takes over as the primary
 * navigation surface.
 *
 * Why it's "smart":
 *   1. **Morphing trigger** — a clay pill button whose hamburger lines
 *      animate into an ✕ while the panel is open, so the trigger state is
 *      always obvious.
 *   2. **Role-filtered pages** — the same `getNavItemsForRole()` used by the
 *      sidebar, so each user only ever sees pages they can actually access.
 *   3. **You-are-here affordance** — the current route is highlighted with a
 *      gold active pill and a live "You're on …" hint in the panel header.
 *   4. **Route-aware auto-close** — navigating, pressing Escape, or tapping
 *      the backdrop closes the menu; the body is scroll-locked while open.
 *   5. **Staggered entrance** — items drop in one after another with a
 *      spring curve, matching the claymorphic design language.
 *
 * The panel slides down from beneath the sticky header (which stays visible
 * with the ✕ trigger), keeping the user oriented at all times.
 */

'use client';

/* ────────────────────────────────────────────
   Dependencies
   ──────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, getRoleLabel, getRoleColor } from '@/lib/auth-context';
import { getNavItemsForRole } from '@/lib/navigation';
import styles from './MobileMenu.module.css';

/* ────────────────────────────────────────────
   MobileMenu Component
   ──────────────────────────────────────────── */

/**
 * MobileMenu — hamburger trigger + slide-down navigation panel.
 *
 * Only rendered on mobile breakpoints (CSS `display: none` on desktop),
 * so the desktop sidebar and topbar layout remain untouched.
 *
 * @returns The mobile menu trigger and overlay panel, or `null` if the user
 *          is not authenticated.
 */
export default function MobileMenu() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  /* ── Auto-close on navigation ──
     Whenever the route changes (link click, back button, redirect) the
     panel closes itself so the user lands on the page unobstructed. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* ── Escape key + scroll lock ──
     While the panel is open the background page must not scroll and the
     Escape key must close the menu (accessibility). */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  // Guard: nothing to render without an authenticated user.
  if (!user) return null;

  /* ── Role-filtered navigation ──
     Reuses the exact same filter as the desktop sidebar, so mobile and
     desktop users see identical, permission-aware menus. */
  const navItems = getNavItemsForRole(user.role, user.roles);

  /* ── Current page detection ──
     Same rules as the sidebar: exact match, or a sub-path of the item's
     href (e.g. "/products/123" activates "Products"). */
  const activeItem = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  );

  /* ── User initials for avatar ── */
  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  /**
   * handleLogout — closes the menu, signs out, and navigates to login.
   */
  const handleLogout = () => {
    setOpen(false);
    logout();
    router.push('/login');
  };

  const roleDisplay = user.roles && user.roles.length > 1
    ? user.roles.map((r) => getRoleLabel(r)).join(' · ')
    : getRoleLabel(user.role);

  return (
    <div className={styles.root}>
      {/* ── Top Mobile Navbar ── */}
      <div className={styles.navbar}>
        <div className={styles.brand}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 p-0.5 shadow-sm flex items-center justify-center flex-shrink-0">
            <div className="w-full h-full rounded-[10px] bg-slate-950/30 backdrop-blur-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="10" width="18" height="9" rx="4.5" transform="rotate(-30 12 14.5)" fill="currentColor" fillOpacity="0.25" />
                <path d="M12 5v14M5 12h14" strokeWidth="2.5" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className={styles.brandTitle}>Albion OS</span>
            <span className={styles.brandSubtitle}>Pharmaceuticals</span>
          </div>
        </div>

        {/* ── Trigger: morphing hamburger pill ── */}
        <button
          className={`${styles.menuBtn} ${open ? styles.menuBtnOpen : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu-panel"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <span className={styles.burger} aria-hidden="true">
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
          </span>
          <span className={styles.menuBtnText}>{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>

      {/* ── Overlay: backdrop + slide-down panel ── */}
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />

          <div id="mobile-menu-panel" className={styles.panel} role="dialog" aria-label="Navigation menu">
            {/* Panel header — live "you are here" hint */}
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Navigation</span>
              <span className={styles.panelHint}>
                {activeItem ? (
                  <>
                    You're on <strong>{activeItem.label}</strong>
                  </>
                ) : (
                  'Pick a page'
                )}
              </span>
            </div>

            {/* Role-filtered page list */}
            <nav className={styles.nav}>
              {navItems.map((item, i) => {
                const isActive = item.href === activeItem?.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                    style={{ animationDelay: `${90 + i * 45}ms` }}
                    onClick={() => setOpen(false)}
                  >
                    <span className={styles.itemIcon}>{item.icon}</span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemLabel}>{item.label}</span>
                      <span className={styles.itemPath}>{item.href}</span>
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={styles.itemBadge}>{item.badge}</span>
                    )}
                    {isActive && (
                      <span className={styles.itemActiveDot} title="Current page" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Footer — user card + logout */}
            <div className={styles.footer}>
              <div className={styles.userCard}>
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
                  <span aria-hidden="true">🚪</span> Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}