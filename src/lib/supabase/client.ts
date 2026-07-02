/**
 * @file client.ts
 * @description Browser-side (client) Supabase client for AlbionOS.
 *
 * Creates a Supabase client intended for use in **Client Components**
 * (files marked with `'use client'`). This client runs in the browser
 * and automatically manages auth tokens via cookies set by `@supabase/ssr`.
 *
 * **When to use this file:**
 * - In React components that run in the browser (onClick handlers,
 *   useEffect hooks, event callbacks, etc.).
 * - For real-time subscriptions (`supabase.channel()`).
 * - For client-side data fetching where server-side rendering is not needed.
 *
 * **When to use `server.ts` instead:**
 * - Inside Next.js Server Components, `generateMetadata`, or Route Handlers
 *   where you need the request's cookie context.
 *
 * **Environment variables read:**
 * - `NEXT_PUBLIC_SUPABASE_URL`      — The Supabase project URL
 *   (e.g. `https://xxxxx.supabase.co`). Must be prefixed with `NEXT_PUBLIC_`
 *   so Next.js exposes it to the browser bundle.
 * - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — The Supabase anonymous/public API key.
 *   Safe to expose in the browser; Row Level Security (RLS) policies on the
 *   database enforce per-user access control.
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates and returns a Supabase client configured for browser-side usage.
 *
 * Each call returns a **new** lightweight client instance. In practice,
 * you can call this at the top of a component or inside a hook without
 * worrying about excessive overhead — `@supabase/ssr` shares the
 * underlying connection internally.
 *
 * @returns A Supabase `SupabaseClient` instance for browser use.
 *
 * @example
 * ```tsx
 * 'use client';
 * import { createClient } from '@/lib/supabase/client';
 *
 * export default function MyComponent() {
 *   const supabase = createClient();
 *   // supabase.from('products').select('*') ...
 * }
 * ```
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
