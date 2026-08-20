/**
 * @file middleware.ts  (lib/supabase/)
 * @description Supabase auth session refresh + role-based route protection.
 *
 * This file is **not** the Next.js middleware entry point itself — that lives
 * at `src/middleware.ts`. Instead, this file exports the `updateSession`
 * helper that the entry-point middleware delegates to.
 *
 * **Purpose:**
 * On every matched request, `updateSession` performs three jobs:
 * 1. **Token refresh** — calls `supabase.auth.getUser()` which automatically
 *    refreshes expired JWTs and writes the new tokens into cookies.
 * 2. **Auth route protection** — checks whether the requested path is in the
 *    `protectedPaths` list and redirects unauthenticated users to `/login`.
 *    Conversely, authenticated users hitting `/login` are redirected to
 *    `/dashboard`.
 * 3. **Role-based route gating** — restricts certain paths (e.g. /staff, /payroll)
 *    to specific roles, loading the user's profile from the `profiles` table.
 *
 * **The cookie relay pattern:**
 * Middleware in Next.js sits between the browser request and the server
 * response. Supabase needs to both *read* cookies (from the request) and
 * *write* updated cookies (onto the response). The `getAll` / `setAll`
 * callbacks implement a relay:
 *   - `getAll`  → reads cookies from `request.cookies`
 *   - `setAll`  → writes cookies to **both** `request.cookies` (so
 *     downstream Server Components see the fresh tokens) and
 *     `supabaseResponse.cookies` (so the browser receives the
 *     `Set-Cookie` headers).
 * A new `NextResponse.next()` is created inside `setAll` to ensure the
 * response object carries the updated request headers.
 *
 * **Key export:**
 * - `updateSession(request)` — called by `src/middleware.ts`
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './config';

/**
 * Refreshes the Supabase auth session and enforces route protection.
 *
 * Called on every request that matches the middleware `config.matcher`
 * pattern (see `src/middleware.ts`).
 *
 * @param request - The incoming `NextRequest` from Next.js middleware.
 * @returns A `NextResponse` — either the original response (with updated
 *          cookies) or a redirect to `/login` or `/dashboard`.
 */
export async function updateSession(request: NextRequest) {
  /*
   * Start with a "pass-through" response that forwards the original
   * request. This response will be returned at the end unless a
   * redirect is triggered.
   */
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSupabaseConfig();

  // ── Create a Supabase client wired to the middleware cookie relay ──
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        /**
         * Read all cookies from the incoming browser request.
         */
        getAll() {
          return request.cookies.getAll();
        },

        /**
         * Write updated cookies to both the request (for downstream
         * Server Components) and the response (for the browser).
         *
         * A fresh `NextResponse.next()` is created so that the
         * modified request headers propagate correctly.
         */
        setAll(cookiesToSet) {
          // 1. Mirror cookies onto the request so Server Components see them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // 2. Rebuild the response with the updated request
          supabaseResponse = NextResponse.next({
            request,
          });

          // 3. Set cookies on the outgoing response for the browser
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Refresh the auth token ──
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* ============================================================
     Auth Route Protection
     ============================================================
     Any path that starts with one of these prefixes requires an
     authenticated Supabase user. If the user is not logged in,
     they are redirected to the login page.
     ============================================================ */
  const protectedPaths = [
    '/dashboard',
    '/chat',
    '/clinic',
    '/products',
    '/inventory',
    '/customers',
    '/invoices',
    '/payments',
    '/payroll',
    '/reports',
    '/staff',
  ];

  // Check if the current path matches any protected prefix
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Unauthenticated user trying to access a protected route → redirect to login
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user visiting the login page → redirect to dashboard
  if (request.nextUrl.pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  /* ============================================================
     Role-Based Route Gating
     ============================================================
     Certain admin-only routes require specific roles beyond just
     being authenticated. If the user lacks the required role,
     redirect to /dashboard with an appropriate message.
     ============================================================ */
  if (user) {
    // Fetch the user's profile to check their role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      const role = profile.role as string;
      const pathname = request.nextUrl.pathname;

      // Routes restricted to super_admin or ceo only
      const adminOnlyPaths = ['/staff', '/payroll'];
      if (adminOnlyPaths.some((p) => pathname.startsWith(p))) {
        if (role !== 'super_admin' && role !== 'ceo') {
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }
      }

      // Routes restricted to finance_manager, super_admin, or ceo
      if (pathname.startsWith('/payments')) {
        if (role !== 'finance_manager' && role !== 'super_admin' && role !== 'ceo') {
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // ── Default: pass the (potentially cookie-updated) response through ──
  return supabaseResponse;
}
