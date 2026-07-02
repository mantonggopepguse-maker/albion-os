/**
 * @file proxy.ts
 * @description Next.js proxy entry point (renamed from middleware.ts in Next.js 16).
 *   Delegates to the Supabase session refresh and route protection logic.
 *
 * The `config.matcher` pattern ensures we only run on routes that need auth
 * protection or session refresh, rather than every single request.
 */

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
