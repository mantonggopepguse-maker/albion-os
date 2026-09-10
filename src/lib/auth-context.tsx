/**
 * @file auth-context.tsx — Supabase-powered authentication for AlbionOS
 *
 * Provides the authentication layer using React Context + Supabase Auth.
 * After login, fetches the user's profile (role, location, name) from
 * the `profiles` table joined with `locations`.
 *
 * **Key exports:**
 * - `AuthProvider`  — React context provider (wraps the app)
 * - `useAuth`       — Hook to access user, login, logout
 * - `AuthUser`      — Shape of the logged-in user
 * - `UserRole`      — Union type of application roles
 * - `getRoleLabel`  — Human-readable role name
 * - `getRoleColor`  — CSS variable color for a role
 */
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';

/**
 * Represents an authenticated user within AlbionOS.
 * Populated from the `profiles` table after Supabase Auth login.
 */
export interface AuthUser {
  /** UUID from auth.users — also the PK in profiles */
  id: string;
  /** Corporate email address */
  email: string;
  /** Display name from profiles.full_name */
  full_name: string;
  /** The user's primary role */
  role: UserRole;
  /** Array of all roles assigned to user (supports multi-role personnel) */
  roles?: UserRole[];
  /** FK to locations table — scopes data visibility */
  location_id: string;
  /** Human-readable location name (joined from locations table) */
  location_name: string;
  /** Optional avatar URL */
  avatar_url: string | null;
  /** Phone number */
  phone: string;
}

/**
 * Shape of the auth context value consumed via useAuth().
 */
export interface DemoProfile {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  roles?: UserRole[];
  roleTitle: string;
  location_name: string;
  location_id: string;
  description: string;
  badgeColor: string;
  icon: string;
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'admin@albionpharma.com',
    name: 'Dr. Emeka Moneke',
    role: 'super_admin',
    roles: ['super_admin', 'ceo'],
    roleTitle: 'Super Admin (CEO)',
    location_name: 'Lagos Headquarters',
    location_id: 'loc-0001-onitsha-hq',
    description: 'Master command over commercial pharma, clinic fleet & corporate governance',
    badgeColor: '#0f766e',
    icon: '👑',
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    email: 'chidi@albionpharma.com',
    name: 'Chidi Okafor',
    role: 'sales_rep',
    roles: ['sales_rep'],
    roleTitle: 'Sales Representative',
    location_name: 'Lagos Commercial Territory',
    location_id: 'loc-0002-lagos-territory',
    description: 'Field sales orders, customer accounts, territory stock & targets',
    badgeColor: '#0284c7',
    icon: '💼',
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    email: 'ngozi@albionpharma.com',
    name: 'Ngozi Eze',
    role: 'finance_manager',
    roles: ['finance_manager'],
    roleTitle: 'Finance Manager',
    location_name: 'Onitsha HQ',
    location_id: 'loc-0001-onitsha-hq',
    description: 'Receivables, payment approval queue, payroll runs & audit trails',
    badgeColor: '#16a34a',
    icon: '💰',
  },
  {
    id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    email: 'tunde@albionpharma.com',
    name: 'Tunde Adeyemi',
    role: 'inventory_manager',
    roles: ['inventory_manager'],
    roleTitle: 'Inventory Manager',
    location_name: 'Central Distribution Warehouse',
    location_id: 'loc-0001-onitsha-hq',
    description: 'Warehouse stocks, batch expirations, rep allocations & suppliers',
    badgeColor: '#d97706',
    icon: '📦',
  },
  {
    id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567891',
    email: 'clinicadmin@albionpharma.com',
    name: 'Dr. Kalu Okonkwo',
    role: 'clinic_admin',
    roles: ['clinic_admin', 'vet'],
    roleTitle: 'Clinic Admin & Clinician',
    location_name: 'Albion Pet Clinic - Lekki Branch',
    location_id: 'loc-0005-lekki-clinic',
    description: 'Dual role: Practice administration, staff roster, plus clinical treatments',
    badgeColor: '#8b5cf6',
    icon: '🏥',
  },
  {
    id: 'c2b2c3d4-e5f6-7890-abcd-ef1234567892',
    email: 'vet@albionpharma.com',
    name: 'Dr. Amaka Bello, DVM',
    role: 'vet',
    roles: ['vet'],
    roleTitle: 'Attending Veterinarian',
    location_name: 'Albion Pet Clinic - Onitsha Central',
    location_id: 'loc-0004-onitsha-clinic',
    description: 'Patient consultations, surgical cases, treatment plans & triage queue',
    badgeColor: '#0d9488',
    icon: '🩺',
  },
  {
    id: 'c3b2c3d4-e5f6-7890-abcd-ef1234567893',
    email: 'reception@albionpharma.com',
    name: 'Chioma Eze',
    role: 'receptionist',
    roles: ['receptionist'],
    roleTitle: 'Front Desk & Patient Intake',
    location_name: 'Albion Pet Clinic - Lekki Branch',
    location_id: 'loc-0005-lekki-clinic',
    description: 'Patient check-in, live waiting queue, appointment booking & billing',
    badgeColor: '#ec4899',
    icon: '📋',
  },
  {
    id: 'c4b2c3d4-e5f6-7890-abcd-ef1234567894',
    email: 'lab@albionpharma.com',
    name: 'Babatunde Adeleke',
    role: 'lab_scientist',
    roles: ['lab_scientist'],
    roleTitle: 'Diagnostic Lab Scientist',
    location_name: 'Central Diagnostic Laboratory',
    location_id: 'loc-0001-onitsha-hq',
    description: 'Sample processing, pathology reports, hematology & lab diagnostics',
    badgeColor: '#2563eb',
    icon: '🔬',
  },
  {
    id: 'c5b2c3d4-e5f6-7890-abcd-ef1234567895',
    email: 'vettech@albionpharma.com',
    name: 'Ibrahim Musa',
    role: 'vet_tech',
    roles: ['vet_tech', 'vet_assistant'],
    roleTitle: 'Veterinary Technician',
    location_name: 'Albion Pet Clinic - Lekki Branch',
    location_id: 'loc-0005-lekki-clinic',
    description: 'Inpatient vitals, medication administration, ICU monitoring & care',
    badgeColor: '#f97316',
    icon: '🐾',
  },
];

interface AuthContextType {
  /** Current user or null if not authenticated */
  user: AuthUser | null;
  /** True during initial session check or login attempt */
  isLoading: boolean;
  /** Log in with email + password via Supabase Auth */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** 1-click instant demo profile login */
  loginAsDemo: (profile: DemoProfile) => Promise<{ success: boolean; error?: string }>;
  /** Sign up a new user via Supabase Auth */
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  /** Send a password-reset email via Supabase Auth */
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  /** True when the current session is a password-recovery session (user clicked the reset link) */
  hasRecoverySession: boolean;
  /** Set a new password during a recovery session */
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  /** Log out and clear the Supabase session */
  logout: () => void;
  /** Dev helper: switch user (re-login as another user) */
  switchUser: (userId: string) => void;
}

/* ============================================================
   Demo quick-login credentials (active by default)
   ============================================================ */
export const ENABLE_DEMO_LOGIN =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== 'false';

const QUICK_LOGIN_USERS = DEMO_PROFILES.map((p) => ({
  email: p.email,
  label: `${p.name} (${p.roleTitle})`,
  role: p.role,
}));

/** Shared dev password — all demo accounts use this */
const DEV_PASSWORD = 'AlbionTest123!';

/* ============================================================
   Context & Provider
   ============================================================ */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fetches the full user profile from the `profiles` table,
 * joined with `locations` to get the location name.
 *
 * @param userId - The auth.users UUID
 * @returns AuthUser object or null if profile not found
 */
async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const supabase = createClient();

  /* Query profile + location name in a single call.
     Supabase PostgREST supports FK-based joins via the `locations(name)` syntax */
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, location_id, avatar_url, locations(name)')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('[Auth] Failed to fetch profile:', error?.message);
    return null;
  }

  /* Build the AuthUser object from the query result */
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role as UserRole,
    location_id: data.location_id || '',
    /* Supabase PostgREST returns FK joins as arrays — take the first element */
    location_name: (data.locations as { name: string }[] | null)?.[0]?.name || 'Unknown',
    avatar_url: data.avatar_url || null,
    phone: data.phone || '',
  };
}

/**
 * AuthProvider — wraps the app and supplies auth state via context.
 *
 * On mount, checks for an existing Supabase session. If found,
 * fetches the user profile and restores the session automatically.
 * Listens for auth state changes (login, logout, token refresh).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const IS_MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

  /* ── Restore session on mount + listen for auth changes ── */
  useEffect(() => {
    /* If in mock mode, restore from localStorage */
    if (IS_MOCK_MODE) {
      /* Defer state updates out of the synchronous effect body — the React
         compiler linter forbids calling setState directly within an effect. */
      queueMicrotask(() => {
        try {
          const stored = localStorage.getItem('albion_os_user');
          if (stored) {
            setUser(JSON.parse(stored));
          }
        } catch {
          // Ignore localStorage parse errors
        }
        setIsLoading(false);
      });
      return;
    }

    const supabase = createClient();

    /* Check for existing session */
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          /* Session exists — fetch the profile from our profiles table */
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            setUser(profile);
            setIsLoading(false);
            return;
          }
        }

        /* Check for persisted demo session */
        try {
          const stored = localStorage.getItem('albion_os_user');
          if (stored) {
            setUser(JSON.parse(stored));
          }
        } catch {
          // Ignore localStorage parse errors
        }

        /* Detect a password-recovery link (supabase-js appends #type=recovery to the URL) */
        try {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          if (hashParams.get('type') === 'recovery') {
            setHasRecoverySession(true);
          }
        } catch {
          // Ignore URL parse failures
        }
      } catch {
        console.warn('[Auth] Supabase session check skipped.');
        try {
          const stored = localStorage.getItem('albion_os_user');
          if (stored) {
            setUser(JSON.parse(stored));
          }
        } catch {}
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    /* Listen for auth state changes */
    let subscription: Subscription | null = null;
    try {
      const res = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const profile = await fetchProfile(session.user.id);
            if (profile) setUser(profile);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setHasRecoverySession(false);
          } else if (event === 'PASSWORD_RECOVERY') {
            setHasRecoverySession(true);
          }
        }
      );
      subscription = res.data.subscription;
    } catch {
      // Ignore listener error when Supabase URL is invalid
    }

    return () => { subscription?.unsubscribe(); };
  }, [IS_MOCK_MODE]);

  /* ── Sign Up ── */
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    if (IS_MOCK_MODE) {
      const newUser: AuthUser = {
        id: `mock-${Date.now()}`,
        email,
        full_name: fullName || email.split('@')[0],
        role: 'super_admin',
        location_id: 'loc-1',
        location_name: 'Lagos Headquarters',
        avatar_url: null,
        phone: '+234 800 123 4567',
      };
      try { localStorage.setItem('albion_os_user', JSON.stringify(newUser)); } catch {}
      setUser(newUser);
      setIsLoading(false);
      return { success: true };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (!error && data.user) {
        const profile = await fetchProfile(data.user.id);
        if (profile) {
          setUser(profile);
          setIsLoading(false);
          return { success: true };
        }
      }
    } catch {
      // Fallback
    }

    setIsLoading(false);
    return { success: false, error: 'Sign up failed or database unreachable.' };
  }, [IS_MOCK_MODE]);

  /* ── Password Reset ── */
  const resetPassword = useCallback(async (email: string) => {
    if (IS_MOCK_MODE) return { success: true };

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      });

      if (!error) return { success: true };
    } catch {
      // Fallback
    }
    return { success: true };
  }, [IS_MOCK_MODE]);

  /* ── Update Password (recovery session) ── */
  const updatePassword = useCallback(async (newPassword: string) => {
    if (IS_MOCK_MODE) return { success: true };

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        return { success: false, error: error.message };
      }
      setHasRecoverySession(false);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to update password. Please try again.' };
    }
  }, [IS_MOCK_MODE]);

  /* ── Login ── */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);

    if (IS_MOCK_MODE) {
      const mockMatch = QUICK_LOGIN_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );

      const mockUser: AuthUser = {
        id: mockMatch ? `mock-${mockMatch.role}` : `mock-user-${Date.now()}`,
        email: mockMatch ? mockMatch.email : email,
        full_name: mockMatch ? mockMatch.label : email.split('@')[0],
        role: (mockMatch?.role as UserRole) || 'super_admin',
        location_id: 'loc-1',
        location_name: 'Lagos Headquarters',
        avatar_url: null,
        phone: '+234 800 123 4567',
      };

      try { localStorage.setItem('albion_os_user', JSON.stringify(mockUser)); } catch {}
      setUser(mockUser);
      setIsLoading(false);
      return { success: true };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        const profile = await fetchProfile(data.user.id);
        if (profile) {
          setUser(profile);
          setIsLoading(false);
          return { success: true };
        }
      }
    } catch (fetchErr) {
      console.warn('[Auth] Supabase auth network error, attempting demo fallback:', fetchErr);
    }

    /* Fallback if Supabase call fails — check demo profiles */
    if (ENABLE_DEMO_LOGIN) {
      const demoMatch = DEMO_PROFILES.find(
        (p) => p.email.toLowerCase() === email.toLowerCase()
      );
      if (demoMatch) {
        return loginAsDemo(demoMatch);
      }

      const mockMatch = QUICK_LOGIN_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );

      const fallbackUser: AuthUser = {
        id: mockMatch ? `mock-${mockMatch.role}` : `mock-user-${Date.now()}`,
        email: mockMatch ? mockMatch.email : email,
        full_name: mockMatch ? mockMatch.label : email.split('@')[0],
        role: (mockMatch?.role as UserRole) || 'super_admin',
        location_id: 'loc-1',
        location_name: 'Lagos Headquarters',
        avatar_url: null,
        phone: '+234 800 123 4567',
      };

      try { localStorage.setItem('albion_os_user', JSON.stringify(fallbackUser)); } catch {}
      setUser(fallbackUser);
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return { success: false, error: 'Unable to sign in. Please try again.' };
  }, [IS_MOCK_MODE]);

  /* ── 1-Click Instant Demo Login ── */
  const loginAsDemo = useCallback(async (profile: DemoProfile) => {
    setIsLoading(true);
    const demoUser: AuthUser = {
      id: profile.id || `mock-${profile.role}`,
      email: profile.email,
      full_name: profile.name,
      role: profile.role,
      roles: profile.roles || [profile.role],
      location_id: profile.location_id,
      location_name: profile.location_name,
      avatar_url: null,
      phone: '+234 800 123 4567',
    };

    try {
      localStorage.setItem('albion_os_user', JSON.stringify(demoUser));
    } catch {
      // Ignore localStorage error
    }

    setUser(demoUser);
    setIsLoading(false);
    return { success: true };
  }, []);

  /* ── Logout ── */
  const logout = useCallback(async () => {
    try { localStorage.removeItem('albion_os_user'); } catch {}
    if (!IS_MOCK_MODE) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {}
    }
    setUser(null);
  }, [IS_MOCK_MODE]);

  /* ── Switch User (dev helper) — logs in as another demo user ── */
  const switchUser = useCallback(async (userId: string) => {
    /* Find the quick-login user by checking their email */
    const demoProfile = DEMO_PROFILES.find((p) => p.email === userId);
    if (demoProfile) {
      await loginAsDemo(demoProfile);
      return;
    }
    const quickUser = QUICK_LOGIN_USERS.find((u) => u.email === userId);
    if (quickUser) {
      await login(quickUser.email, DEV_PASSWORD);
    }
  }, [login, loginAsDemo]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAsDemo, signUp, resetPassword, hasRecoverySession, updatePassword, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ============================================================
   Hook
   ============================================================ */

/**
 * useAuth — consume the auth context from any component.
 * Must be inside <AuthProvider>. Throws if used outside.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/* ============================================================
   Utility Helpers
   ============================================================ */

/** Returns a human-readable label for a role */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    sales_rep: 'Sales Representative',
    finance_manager: 'Finance Manager',
    inventory_manager: 'Inventory Manager',
    ceo: 'Chief Executive Officer',
    clinic_admin: 'Clinic Admin',
    vet: 'Veterinarian',
    vet_assistant: 'Vet Assistant',
    receptionist: 'Receptionist',
    vet_tech: 'Vet Technician',
    regional_manager: 'Regional Manager',
    security: 'Security',
    lab_scientist: 'Lab Scientist',
    pharmacist: 'Clinical Pharmacist',
    support_staff: 'Support Staff',
  };
  return labels[role];
}

/** Returns a CSS variable color for a role */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    super_admin: 'var(--color-navy)',
    sales_rep: 'var(--color-ocean)',
    finance_manager: 'var(--color-success)',
    inventory_manager: 'var(--color-warning)',
    ceo: 'var(--color-gold-dark)',
    clinic_admin: 'var(--color-purple)',
    vet: 'var(--color-teal)',
    vet_assistant: 'var(--color-teal-light)',
    receptionist: 'var(--color-pink)',
    vet_tech: 'var(--color-orange)',
    regional_manager: 'var(--color-indigo)',
    security: 'var(--color-gray)',
    lab_scientist: 'var(--color-blue)',
    pharmacist: 'var(--color-blue)',
    support_staff: 'var(--color-gray)',
  };
  return colors[role];
}


/**
 * Checks if a user possesses a specific role, checking both primary role and multi-role array.
 * Super admins and CEOs possess universal access across all role features.
 */
export function hasRole(user: AuthUser | null, targetRole: UserRole): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'ceo') return true;
  if (user.roles && (user.roles.includes('super_admin') || user.roles.includes('ceo'))) return true;
  if (user.roles && user.roles.includes(targetRole)) return true;
  return user.role === targetRole;
}

/* Export quick-login data for the login page */
export { QUICK_LOGIN_USERS, DEV_PASSWORD };
