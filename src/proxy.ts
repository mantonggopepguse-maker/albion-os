/**
 * @file proxy.ts
 * @description Next.js proxy entry point (renamed from middleware.ts in Next.js 16).
 *   Delegates to the Supabase session refresh and route protection logic.
 *
 * The `config.matcher` pattern ensures we only run on routes that need auth
 * protection or session refresh, rather than every single request.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getSupabaseConfig, isSupabaseMockMode } from '@/lib/supabase/config';

export async function proxy(request: NextRequest) {
  if (isSupabaseMockMode()) {
    return NextResponse.next();
  }

  try {
    getSupabaseConfig();
  } catch {
    return NextResponse.json({ error: 'Service configuration unavailable' }, { status: 503 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
