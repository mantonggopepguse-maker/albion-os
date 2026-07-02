/**
 * @file navigation.ts
 * @description Centralised navigation configuration for AlbionOS.
 *
 * This file defines every sidebar navigation item and which user roles are
 * allowed to see it. The sidebar component (`AppSidebar`) reads this data
 * at render time, filtering items through `getNavItemsForRole()` so each
 * user only sees the pages relevant to their job function.
 *
 * **Architecture role:**
 * - Single source of truth for sidebar links and role-based visibility.
 * - Consumed by the sidebar, breadcrumbs, and any component that needs to
 *   know "which pages exist and who can access them".
 * - Adding a new page to the app requires adding a new entry to `NAV_ITEMS`.
 *
 * **Key exports:**
 * - `NavItem`             — TypeScript interface for a single nav entry
 * - `NAV_ITEMS`           — ordered array of all navigation entries
 * - `getNavItemsForRole`  — filter helper that returns only the entries a
 *                           given role is permitted to access
 */

import { UserRole } from './auth-context';

/* ============================================================
   Type Definitions
   ============================================================ */

/**
 * Represents a single item in the application's sidebar navigation.
 */
export interface NavItem {
  /** The text label displayed in the sidebar (e.g. "Dashboard", "Products"). */
  label: string;

  /** The Next.js route path this item links to (e.g. "/dashboard"). */
  href: string;

  /** Emoji icon rendered beside the label. Will be replaced with SVG icons later. */
  icon: string;

  /**
   * Which roles are allowed to see this nav item.
   * The sidebar filters `NAV_ITEMS` using this array so that, for example,
   * a `sales_rep` never sees the "Users" management page.
   */
  roles: UserRole[];

  /**
   * Optional notification badge count (e.g. unread messages).
   * When present, a small badge is rendered on top of the nav icon.
   */
  badge?: number;
}

/* ============================================================
   Navigation Items
   ============================================================
   Items are listed in the order they appear in the sidebar.
   The `roles` array on each entry controls visibility per role:

   ┌─────────────────────┬────────┬──────────┬─────────┬───────────┐
   │ Page                │ Admin  │ SalesRep │ Finance │ Inventory │
   ├─────────────────────┼────────┼──────────┼─────────┼───────────┤
   │ Dashboard           │  ✓     │  ✓       │  ✓      │  ✓        │
   │ Chat                │  ✓     │  ✓       │  ✓      │  ✓        │
   │ Products            │  ✓     │          │         │  ✓        │
   │ Inventory           │  ✓     │  ✓       │         │  ✓        │
   │ Customers           │  ✓     │  ✓       │         │           │
   │ Invoices            │  ✓     │  ✓       │  ✓      │           │
   │ Payments            │  ✓     │          │  ✓      │           │
   │ Reports             │  ✓     │          │  ✓      │           │
   │ Users               │  ✓     │          │         │           │
   └─────────────────────┴────────┴──────────┴─────────┴───────────┘
   ============================================================ */

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    roles: ['super_admin', 'sales_rep', 'finance_manager', 'inventory_manager', 'ceo'],
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: '💬',
    roles: ['super_admin', 'sales_rep', 'finance_manager', 'inventory_manager', 'ceo'],
  },
  {
    // Products — catalog management. Admin, inventory manager, and CEO.
    label: 'Products',
    href: '/products',
    icon: '💊',
    roles: ['super_admin', 'inventory_manager', 'ceo'],
  },
  {
    // Inventory — stock levels, batch tracking. Sales reps see read-only stock. CEO sees all read-only.
    label: 'Inventory',
    href: '/inventory',
    icon: '📦',
    roles: ['super_admin', 'sales_rep', 'inventory_manager', 'ceo'],
  },
  {
    // Customers — CRM-like customer records. Sales reps manage their own territory. CEO views global.
    label: 'Customers',
    href: '/customers',
    icon: '👥',
    roles: ['super_admin', 'sales_rep', 'ceo'],
  },
  {
    // Invoices — creation and tracking. Finance/CEO sees all; sales reps see their own.
    label: 'Invoices',
    href: '/invoices',
    icon: '🧾',
    roles: ['super_admin', 'sales_rep', 'finance_manager', 'ceo'],
  },
  {
    // Payments — recording and approval. Finance approves; admin oversees; CEO views global.
    label: 'Payments',
    href: '/payments',
    icon: '💰',
    roles: ['super_admin', 'finance_manager', 'ceo'],
  },
  {
    // Reports — revenue, receivables, performance. Finance, admin, and CEO.
    label: 'Reports',
    href: '/reports',
    icon: '📈',
    roles: ['super_admin', 'finance_manager', 'ceo'],
  },
  {
    // Payroll — salary and payroll management. Super admin, finance, and CEO.
    label: 'Payroll',
    href: '/payroll',
    icon: '💰',
    roles: ['super_admin', 'finance_manager', 'ceo'],
  },
  {
    label: 'Clinic',
    href: '/clinic',
    icon: '🏥',
    roles: ['super_admin', 'ceo'],
  },
  {
    // Staff — user management. Super admin and CEO.
    label: 'Staff',
    href: '/staff',
    icon: '⚙️',
    roles: ['super_admin', 'ceo'],
  },
];

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Returns the subset of `NAV_ITEMS` that a given role is authorised to see.
 *
 * Used by the sidebar component to render only the links the current user
 * should have access to. The order of the returned array matches the
 * original `NAV_ITEMS` order.
 *
 * @param role - The `UserRole` of the currently logged-in user.
 * @returns A filtered array of `NavItem` objects.
 *
 * @example
 * ```ts
 * const items = getNavItemsForRole('sales_rep');
 * // → Dashboard, Chat, Inventory, Customers, Invoices
 * ```
 */
export function getNavItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
