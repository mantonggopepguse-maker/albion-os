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

/* ============================================================
   Type Definitions
   ============================================================ */

/**
 * Union type for the five application roles.
 * Drives navigation, dashboard selection, and RLS policies.
 */
export type UserRole = 'super_admin' | 'sales_rep' | 'finance_manager' | 'inventory_manager' | 'ceo';

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
  /** The user's role — drives permissions everywhere */
  role: UserRole;
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
interface AuthContextType {
  /** Current user or null if not authenticated */
  user: AuthUser | null;
  /** True during initial session check or login attempt */
  isLoading: boolean;
  /** Log in with email + password via Supabase Auth */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Sign up a new user via Supabase Auth */
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  /** Send a password-reset email via Supabase Auth */
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  /** Log out and clear the Supabase session */
  logout: () => void;
  /** Dev helper: switch user (re-login as another user) */
  switchUser: (userId: string) => void;
}

/* ============================================================
   Quick-login credentials for development
   Used by the login page's "Quick Login" buttons
   ============================================================ */
const QUICK_LOGIN_USERS = [
  { email: 'admin@albionpharma.com', label: 'Dr. Emeka (Admin)', role: 'super_admin' as UserRole },
  { email: 'ceo@albionpharma.com', label: 'Chief Executive (CEO)', role: 'ceo' as UserRole },
  { email: 'chidi@albionpharma.com', label: 'Chidi (Sales)', role: 'sales_rep' as UserRole },
  { email: 'ngozi@albionpharma.com', label: 'Ngozi (Finance)', role: 'finance_manager' as UserRole },
  { email: 'tunde@albionpharma.com', label: 'Tunde (Inventory)', role: 'inventory_manager' as UserRole },
];

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

  /* ── Restore session on mount + listen for auth changes ── */
  useEffect(() => {
    const supabase = createClient();

    /* Check for existing session */
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          /* Session exists — fetch the profile from our profiles table */
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
        }
      } catch (err) {
        console.error('[Auth] Session restore error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    /* Listen for auth state changes (sign in, sign out, token refresh) */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    /* Cleanup subscription on unmount */
    return () => { subscription.unsubscribe(); };
  }, []);

  /* ── Sign Up via Supabase Auth ── */
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      if (profile) {
        setUser(profile);
      }
    }

    setIsLoading(false);
    return { success: true };
  }, []);

  /* ── Password Reset via Supabase Auth ── */
  const resetPassword = useCallback(async (email: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  /* ── Login via Supabase Auth ── */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    if (data.user) {
      /* Auth succeeded — now fetch the profile for role/location info */
      const profile = await fetchProfile(data.user.id);
      if (profile) {
        setUser(profile);
        setIsLoading(false);
        return { success: true };
      } else {
        /* Auth worked but no profile row exists — shouldn't happen with seeded data */
        setIsLoading(false);
        return { success: false, error: 'User profile not found. Contact your admin.' };
      }
    }

    setIsLoading(false);
    return { success: false, error: 'Login failed. Please try again.' };
  }, []);

  /* ── Logout via Supabase Auth ── */
  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  /* ── Switch User (dev helper) — logs in as another demo user ── */
  const switchUser = useCallback(async (userId: string) => {
    /* Find the quick-login user by checking their email */
    const quickUser = QUICK_LOGIN_USERS.find((u) => u.email === userId);
    if (quickUser) {
      await login(quickUser.email, DEV_PASSWORD);
    }
  }, [login]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signUp, resetPassword, logout, switchUser }}>
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
  };
  return colors[role];
}

/* Export quick-login data for the login page */
export { QUICK_LOGIN_USERS, DEV_PASSWORD };
