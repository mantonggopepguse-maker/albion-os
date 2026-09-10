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

import type { UserRole } from '@/lib/types';

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

   ┌─────────────────────┬────────┬──────────┬─────────┬───────────┬─────┐
   │ Page                │ Admin  │ SalesRep │ Finance │ Inventory │ CEO │
   ├─────────────────────┼────────┼──────────┼─────────┼───────────┼─────┤
   │ Dashboard           │  ✓     │  ✓       │  ✓      │  ✓        │ ✓   │
   │ Chat                │  ✓     │  ✓       │  ✓      │  ✓        │ ✓   │
   │ Products            │  ✓     │          │         │  ✓        │ ✓   │
   │ Inventory           │  ✓     │  ✓       │         │  ✓        │ ✓   │
   │ Customers           │  ✓     │  ✓       │         │           │ ✓   │
   │ Invoices            │  ✓     │  ✓       │  ✓      │           │ ✓   │
   │ Payments            │  ✓     │          │  ✓      │           │ ✓   │
   │ Reports             │  ✓     │          │  ✓      │           │ ✓   │
   │ Staff               │  ✓     │          │         │           │ ✓   │
   └─────────────────────┴────────┴──────────┴─────────┴───────────┴─────┘
   ============================================================ */

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    roles: [
      'super_admin', 'sales_rep', 'finance_manager', 'inventory_manager', 'ceo',
      'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'lab_scientist', 'security', 'regional_manager'
    ],
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: '💬',
    roles: [
      'super_admin', 'sales_rep', 'finance_manager', 'inventory_manager', 'ceo',
      'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'lab_scientist', 'security', 'regional_manager'
    ],
  },
  {
    // Products — catalog management and browsing
    label: 'Products',
    href: '/products',
    icon: '💊',
    roles: ['super_admin', 'inventory_manager', 'ceo', 'sales_rep', 'clinic_admin', 'vet'],
  },
  {
    // Inventory — stock levels, batch tracking, rep and clinic branch allocations
    label: 'Inventory',
    href: '/inventory',
    icon: '📦',
    roles: ['super_admin', 'sales_rep', 'inventory_manager', 'ceo', 'clinic_admin', 'vet'],
  },
  {
    // Customers — commercial buyers and retail pharmacies
    label: 'Customers',
    href: '/customers',
    icon: '👥',
    roles: ['super_admin', 'sales_rep', 'ceo', 'clinic_admin', 'receptionist'],
  },
  {
    // Invoices — sales orders and billing
    label: 'Invoices',
    href: '/invoices',
    icon: '🧾',
    roles: ['super_admin', 'sales_rep', 'finance_manager', 'ceo', 'clinic_admin', 'receptionist'],
  },
  {
    // Payments — recording, receipts, and verification queue
    label: 'Payments',
    href: '/payments',
    icon: '💰',
    roles: ['super_admin', 'finance_manager', 'ceo', 'clinic_admin', 'receptionist'],
  },
  {
    // Expenses — operational overheads, diesel generator fuel, consumables, maintenance
    label: 'Expenses',
    href: '/expenses',
    icon: '💸',
    roles: ['super_admin', 'finance_manager', 'ceo', 'clinic_admin'],
  },
  {
    // Reports — revenue, receivables, BI analytics
    label: 'Reports',
    href: '/reports',
    icon: '📈',
    roles: ['super_admin', 'finance_manager', 'ceo', 'clinic_admin', 'regional_manager'],
  },
  {
    // Suppliers — vendor directories and incoming stock
    label: 'Suppliers',
    href: '/suppliers',
    icon: '🏭',
    roles: ['super_admin', 'inventory_manager', 'ceo', 'clinic_admin'],
  },
  {
    // Payroll — salary structures, staff allowances and payslips
    label: 'Payroll',
    href: '/payroll',
    icon: '💳',
    roles: ['super_admin', 'finance_manager', 'ceo', 'clinic_admin'],
  },
  {
    // Clinic Branches — multi-practice network overview
    label: 'Clinics',
    href: '/clinic',
    icon: '🏥',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'regional_manager'],
  },
  {
    // Queue & Triage — live clinical intake and waiting room
    label: 'Queue & Triage',
    href: '/clinic/queue',
    icon: '⏱️',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist'],
  },
  {
    // Appointments — patient bookings and consultations
    label: 'Appointments',
    href: '/clinic/appointments',
    icon: '📅',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist'],
  },
  {
    // Patient Recalls & Preventive Care Reminders
    label: 'Recalls',
    href: '/clinic/reminders',
    icon: '🔔',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'receptionist'],
  },
  {
    // Patients — pet and animal medical records registry
    label: 'Patients',
    href: '/clinic/patients',
    icon: '🐾',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'lab_scientist'],
  },
  {
    // Treatments — clinical diagnosis, EHR and SOAP notes
    label: 'Treatments',
    href: '/clinic/treatments',
    icon: '🩺',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant'],
  },
  {
    // Procedures — clinical service catalog & fee schedule
    label: 'Procedures',
    href: '/clinic/procedures',
    icon: '📋',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet'],
  },
  {
    // Duty Roster — clinic shifts and workforce timetable
    label: 'Duty Roster',
    href: '/clinic/shifts',
    icon: '🗓️',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'receptionist'],
  },
  {
    // Lab Hub — specimen testing, haematology & biochemistry
    label: 'Lab Hub',
    href: '/clinic/lab',
    icon: '🔬',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'lab_scientist'],
  },
  {
    // ICU Board — inpatient cages, vitals and fluid infusion monitoring
    label: 'ICU Board',
    href: '/clinic/icu',
    icon: '🛏️',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant'],
  },
  {
    // Pharmacy POS — clinical prescription checkout and narcotics lockbox
    label: 'Pharmacy POS',
    href: '/clinic/pharmacy',
    icon: '🏪',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'pharmacist', 'receptionist'],
  },
  {
    // Surgical Suite — pre-op checklist, anesthesia depth and procedure logging
    label: 'Surgical Suite',
    href: '/clinic/surgery',
    icon: '⚡',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech'],
  },
  {
    // Cash Reconciliation — daily cash drawer, POS card slips, and transfer balancing
    label: 'Cash Register',
    href: '/clinic/reconciliation',
    icon: '💵',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'finance_manager', 'receptionist'],
  },
  {
    // Clinical Calculators — drug dosing (mg/ml) and 24h fluid therapy infusion math
    label: 'Calculators',
    href: '/clinic/calculators',
    icon: '🧮',
    roles: ['super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'pharmacist'],
  },
  {
    // Staff — user management and workforce roles
    label: 'Staff',
    href: '/staff',
    icon: '⚙️',
    roles: ['super_admin', 'ceo', 'clinic_admin'],
  },
  {
    // Audit Log — immutable trail of financial, narcotics, inventory, and security events
    label: 'Audit Log',
    href: '/audit',
    icon: '🛡️',
    roles: ['super_admin', 'ceo', 'finance_manager'],
  },
];

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Returns the subset of `NAV_ITEMS` that a given role (or combination of roles) is authorised to see.
 * Multi-role personnel see all features available to ANY of their assigned roles without manual switching.
 *
 * @param role - Primary role of the user.
 * @param roles - Optional array of additional/concurrent roles for multi-role personnel.
 * @returns Filtered array of authorized `NavItem` objects.
 */
export function getNavItemsForRole(role: UserRole, roles?: UserRole[]): NavItem[] {
  const allUserRoles = roles && roles.length > 0 ? roles : [role];
  if (allUserRoles.includes('super_admin') || allUserRoles.includes('ceo')) {
    return NAV_ITEMS;
  }
  return NAV_ITEMS.filter((item) =>
    item.roles.some((r) => allUserRoles.includes(r))
  );
}

/**
 * Returns a user-friendly display name for each role.
 */
export function getRoleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    ceo: 'Chief Executive Officer',
    sales_rep: 'Sales Representative',
    finance_manager: 'Finance Manager',
    inventory_manager: 'Warehouse & Inventory Manager',
    clinic_admin: 'Clinic Administrator',
    vet: 'Veterinarian Surgeon',
    vet_tech: 'Veterinary Technician',
    vet_assistant: 'Veterinary Assistant',
    receptionist: 'Front Desk Receptionist',
    regional_manager: 'Regional Manager',
    security: 'Security Personnel',
    lab_scientist: 'Laboratory Scientist',
    pharmacist: 'Clinical Pharmacist',
    support_staff: 'Support & Facilities Staff',
  };
  return map[role] || role;
}


