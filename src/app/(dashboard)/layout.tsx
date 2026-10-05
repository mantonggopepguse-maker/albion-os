/**
 * @file (dashboard)/layout.tsx — Dashboard Layout (Route Group)
 *
 * This is the shared layout for ALL authenticated dashboard pages.
 * It sits inside the `(dashboard)` directory, which uses the Next.js
 * **Route Group** convention (parenthesised folder name). Route groups:
 *   - Do NOT add a URL segment (there's no `/dashboard-group/…` in the URL).
 *   - Allow grouping routes that share a common layout or behaviour
 *     without affecting the public URL structure.
 *   - In this case, every page under `(dashboard)/` gets the sidebar,
 *     auth guard, and loading screen automatically.
 *
 * Component architecture (two components, one file):
 *
 *   `DashboardLayout` (exported)
 *     └─ `<AuthProvider>`       ← provides auth context to the tree
 *          └─ `DashboardShell`  ← consumes auth, renders UI or redirects
 *               ├─ `<Sidebar />`
 *               └─ `<main>{children}</main>`
 *
 * Why two components?
 *   `DashboardLayout` is responsible ONLY for wrapping children in an
 *   `<AuthProvider>`. It cannot call `useAuth()` itself because hooks
 *   must be called inside the provider, not at the same level.
 *   `DashboardShell` is rendered *inside* the provider, so it can
 *   safely call `useAuth()` to implement the auth guard.
 *
 * Auth guard pattern:
 *   1. While `isLoading` is true → show a branded loading screen.
 *   2. If loading finishes and `user` is null → redirect to `/login`.
 *   3. If `user` exists → render the dashboard shell (sidebar + content).
 */

'use client';

/* ────────────────────────────────────────────
   Dependencies
   ──────────────────────────────────────────── */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { NotificationsProvider } from '@/lib/notifications-context';
import Sidebar from '@/components/layout/Sidebar';
import MobileNavbar from '@/components/layout/MobileNavbar';
import MobileSidebarDrawer from '@/components/layout/MobileSidebarDrawer';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import styles from './dashboard-layout.module.css';

/* ────────────────────────────────────────────
   DashboardShell — Internal auth-guarded shell
   ──────────────────────────────────────────── */

/**
 * DashboardShell — the inner layout that requires authentication.
 *
 * This component implements a **client-side auth guard**:
 *   - Redirects unauthenticated users to `/login`.
 *   - Shows a full-screen loading indicator during the initial auth check.
 *   - Renders the mobile top glassmorphic navbar, slide-out drawer, desktop sidebar,
 *     and main content area once confirmed.
 *
 * @param children - The page content rendered inside the `<main>` element.
 * @returns The dashboard shell UI, a loading screen, or null (during redirect).
 */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  /* ── Auth guard redirect ──
     Runs after the AuthProvider finishes its initial session check.
     If no user session is found, navigate to the login page.
     `replace` is used so `/dashboard` doesn't stay in browser history. */
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  /* ── Loading state ──
     Shown while the AuthProvider is checking the session on first mount.
     Displays a branded "AlbionOS" loading animation so the user doesn't
     see a flash of unauthenticated content or a blank screen. */
  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingLogo}>A</div>
        <p className={styles.loadingText}>Loading AlbionOS...</p>
      </div>
    );
  }

  /* ── Null guard ──
     If loading is complete but there's no user, return null.
     The useEffect above will be firing the redirect simultaneously.
     This prevents rendering dashboard UI for a split second before
     the navigation completes. */
  if (!user) return null;

  /* ── Authenticated layout ──
     Mobile top navbar + sweet slide-out drawer on mobile screens;
     fixed sidebar on desktop, scrollable main on the right. */
  return (
    <div className={styles.layout}>
      <TopProgressBar />
      <MobileNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />
      <MobileSidebarDrawer
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────
   DashboardLayout — Exported Layout Component
   ──────────────────────────────────────────── */

/**
 * DashboardLayout — the default export, used by Next.js as the layout
 * for all routes inside the `(dashboard)` route group.
 *
 * Its only job is to wrap children in an `<AuthProvider>` and `<NotificationsProvider>`
 * so that `DashboardShell` (and all descendant pages/components) can access
 * auth and notification context.
 *
 * @param children - The nested page or layout to render.
 * @returns The provider-wrapped dashboard shell.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <DashboardShell>{children}</DashboardShell>
      </NotificationsProvider>
    </AuthProvider>
  );
}

