/**
 * @file page.tsx — Root Page (`/`)
 *
 * This is the application entry point. It does NOT render any visible UI.
 * Its sole purpose is to check the user's authentication state and redirect:
 *   - Authenticated users  → `/dashboard`
 *   - Unauthenticated users → `/login`
 *
 * The redirect runs entirely on the client side because authentication state
 * is managed by the `AuthProvider` context via Supabase Auth.
 * A server-side redirect isn't possible here since the server has no access
 * to the auth session from client components.
 *
 * Architecture note:
 *  `HomePage` wraps `HomeRedirect` inside an `AuthProvider` because the
 *  `useAuth()` hook requires an `AuthProvider` ancestor in the component
 *  tree. Each route tree that needs auth must supply its own provider
 *  (the provider is not in RootLayout to avoid forcing every page —
 *  including `/login` — into the same provider instance).
 */

'use client';

/* ────────────────────────────────────────────
   Dependencies
   ──────────────────────────────────────────── */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';

/* ────────────────────────────────────────────
   HomeRedirect — Internal redirect logic
   ──────────────────────────────────────────── */

/**
 * HomeRedirect — a renderless component that performs the auth-based redirect.
 *
 * It is intentionally separated from `HomePage` so it can call `useAuth()`,
 * which requires being rendered *inside* an `<AuthProvider>`.
 *
 * @returns `null` — this component renders nothing; it only triggers navigation.
 */
function HomeRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until the AuthProvider has finished checking the session.
    // `isLoading` is true during the initial hydration check.
    if (!isLoading) {
      if (user) {
        // User session found → send to dashboard.
        // `replace` is used instead of `push` so the `/` route doesn't
        // appear in the browser's back-button history.
        router.replace('/dashboard');
      } else {
        // No stored session → send to login screen.
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  // This component is purely side-effect-driven; it renders no DOM.
  return null;
}

/* ────────────────────────────────────────────
   HomePage — Exported Page Component
   ──────────────────────────────────────────── */

/**
 * HomePage — the default export for the `/` route.
 *
 * Wraps `HomeRedirect` in an `AuthProvider` so the auth context is available.
 * This pattern (provider-in-page, consumer-as-child) is repeated across
 * every top-level route that requires authentication awareness.
 *
 * @returns The provider tree with the redirect logic.
 */
export default function HomePage() {
  return (
    <AuthProvider>
      <HomeRedirect />
    </AuthProvider>
  );
}

