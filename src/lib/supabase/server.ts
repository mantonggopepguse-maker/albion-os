/**
 * @file server.ts
 * @description Server-side Supabase client for AlbionOS.
 *
 * Creates a Supabase client intended for use in **Server Components**,
 * `generateMetadata`, and **Route Handlers** (`app/api/…/route.ts`).
 * Unlike the browser client (`client.ts`), this one reads and writes
 * cookies through Next.js's `cookies()` API, which is only available
 * on the server.
 *
 * **Cookie handling for auth sessions:**
 * Supabase stores the user's JWT access and refresh tokens in cookies.
 * The `getAll` / `setAll` callbacks bridge Supabase's cookie operations
 * with Next.js's read-only cookie jar:
 * - `getAll` — reads all cookies from the incoming request so Supabase
 *   can find and validate the existing session tokens.
 * - `setAll` — writes updated tokens back (e.g. after a token refresh).
 *   This can fail silently when called from a **Server Component** because
 *   Server Components cannot set response headers. The `try/catch` ensures
 *   the component still renders; the middleware layer will handle the
 *   actual cookie write on the next request.
 *
 * **When to use this file:**
 * - Server Components that need authenticated data (e.g. `page.tsx`).
 * - Route Handlers (`POST`, `GET`, etc.) that need the user's session.
 * - `generateMetadata` functions.
 *
 * **When to use `client.ts` instead:**
 * - Client Components (`'use client'`) running in the browser.
 *
 * **Environment variables read:**
 * - `NEXT_PUBLIC_SUPABASE_URL`      — Supabase project URL
 * - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public API key
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client configured for server-side usage.
 *
 * This function is `async` because Next.js 15 requires `await cookies()`
 * to access the cookie store in Server Components and Route Handlers.
 *
 * @returns A Supabase `SupabaseClient` instance with cookie-based auth.
 *
 * @example
 * ```ts
 * // In a Server Component (app/dashboard/page.tsx):
 * import { createServerSupabaseClient } from '@/lib/supabase/server';
 *
 * export default async function DashboardPage() {
 *   const supabase = await createServerSupabaseClient();
 *   const { data } = await supabase.from('invoices').select('*');
 *   return <InvoiceList invoices={data} />;
 * }
 * ```
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * Reads all cookies from the incoming request.
         * Supabase uses these to extract and validate JWT tokens.
         */
        getAll() {
          return cookieStore.getAll();
        },

        /**
         * Writes updated cookies (e.g. refreshed JWT tokens) to the response.
         *
         * Wrapped in try/catch because Server Components cannot set response
         * headers — cookie writes will silently fail there. This is safe:
         * the middleware (`middleware.ts`) handles token refresh and cookie
         * writes on every request, so the session stays valid.
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — cookies are read-only
          }
        },
      },
    }
  );
}
