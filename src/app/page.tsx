/**
 * @file page.tsx — Root Page (`/`)
 *
 * Server-side entry point that immediately redirects to `/login`.
 * Running server-side eliminates the client hydration delay and blank-screen flash.
 */

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
}


