/**
 * @file components/layout/MobileSidebarDrawer.tsx — Sweet Slide-Out Mobile Navigation Drawer
 *
 * An off-canvas, GPU-accelerated navigation drawer that hides completely until
 * triggered from the MobileNavbar hamburger button.
 *
 * Features:
 *   1. Full dark glassmorphic styling with luxury gold accents.
 *   2. Grouped, role-filtered navigation items (only authorized links shown).
 *   3. Active page pill with "You're on [Page]" context hint.
 *   4. Unread badge notifications on items with pending counts.
 *   5. Body scroll-lock while open and dismissible via backdrop tap or Escape.
 *   6. User profile card with 1-tap logout and safe-area insets.
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, getRoleLabel, getRoleColor } from '@/lib/auth-context';
import { getNavItemsForRole, NavItem } from '@/lib/navigation';
import styles from './MobileSidebarDrawer.module.css';

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

export default function MobileSidebarDrawer({ isOpen, onClose }: MobileSidebarDrawerProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const prevPathname = useRef(pathname);

  // Scroll lock and Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Close only on ACTUAL route navigation (when path changes)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  const navItems = useMemo(() => {
    return user ? getNavItemsForRole(user.role, user.roles) : [];
  }, [user]);

  const activeItem = useMemo(() => {
    return navItems.find(
      (item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
    );
  }, [navItems, pathname]);

  // Group items cleanly for mobile ease-of-use
  const groupedCategories: NavCategory[] = useMemo(() => {
    const overviewHrefs = ['/dashboard', '/reports', '/audit'];
    const commercialHrefs = ['/products', '/inventory', '/customers', '/invoices', '/payments', '/expenses', '/suppliers'];
    const clinicHrefs = [
      '/clinic',
      '/clinic/clients',
      '/clinic/appointments',
      '/clinic/reminders',
      '/clinic/patients',
      '/clinic/treatments',
      '/clinic/lab',
      '/clinic/icu',
      '/clinic/pharmacy',
      '/clinic/surgery',
      '/clinic/reconciliation',
      '/clinic/calculators',
      '/clinic/procedures',
      '/clinic/shifts',
    ];
    const teamHrefs = ['/chat', '/staff', '/requests', '/payroll'];

    const overviewItems = navItems.filter((it) => overviewHrefs.includes(it.href));
    const commercialItems = navItems.filter((it) => commercialHrefs.includes(it.href));
    const clinicItems = navItems.filter((it) => clinicHrefs.includes(it.href));
    const teamItems = navItems.filter((it) => teamHrefs.includes(it.href));
    const otherItems = navItems.filter(
      (it) =>
        !overviewHrefs.includes(it.href) &&
        !commercialHrefs.includes(it.href) &&
        !clinicHrefs.includes(it.href) &&
        !teamHrefs.includes(it.href)
    );

    const categories: NavCategory[] = [];
    if (overviewItems.length > 0) categories.push({ title: 'Overview & Intelligence', items: overviewItems });
    if (commercialItems.length > 0) categories.push({ title: 'Commercial & Distribution', items: commercialItems });
    if (clinicItems.length > 0) categories.push({ title: 'Veterinary Clinical Network', items: clinicItems });
    if (teamItems.length > 0) categories.push({ title: 'Team & Operations', items: teamItems });
    if (otherItems.length > 0) categories.push({ title: 'More Services', items: otherItems });

    return categories;
  }, [navItems]);

  if (!user || !isOpen) return null;

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleDisplay = user.roles && user.roles.length > 1
    ? user.roles.map((r) => getRoleLabel(r)).join(' · ')
    : getRoleLabel(user.role);

  const handleLogout = () => {
    onClose();
    logout();
    router.push('/login');
  };

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Navigation Menu">
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.brand}>
            <div className={styles.brandLogo}>
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="10" width="18" height="9" rx="4.5" transform="rotate(-30 12 14.5)" fill="currentColor" fillOpacity="0.25" />
                <path d="M12 5v14M5 12h14" strokeWidth="2.8" />
              </svg>
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandName}>Albion OS</span>
              <span className={styles.brandDesc}>Pharmaceuticals & Clinics</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close navigation">
            ✕
          </button>
        </div>

        {/* You Are Here Bar */}
        <div className={styles.contextBar}>
          <span>You&apos;re on: <strong style={{ color: '#fff' }}>{activeItem?.label || 'Dashboard'}</strong></span>
          <span className={styles.contextDot} />
        </div>

        {/* Nav list */}
        <nav className={styles.drawerNav}>
          {groupedCategories.map((group) => (
            <div key={group.title}>
              <div className={styles.sectionHeader}>{group.title}</div>
              {group.items.map((item) => {
                const isActive = item.href === activeItem?.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={onClose}
                  >
                    <span className={styles.itemIcon}>{item.icon}</span>
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={styles.itemBadge}>{item.badge}</span>
                    )}
                    {isActive && <span className={styles.activeDot} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Card & Logout */}
        <div className={styles.drawerFooter}>
          <div className={styles.userCard}>
            <div
              className={styles.userAvatar}
              style={{ backgroundColor: getRoleColor(user.role) }}
            >
              {initials}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.full_name}</span>
              <span className={styles.userRole} title={roleDisplay}>{roleDisplay}</span>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
