export const isSupabaseMockMode = (): boolean =>
  process.env.NEXT_PUBLIC_USE_MOCK === 'true';

/** Returns true if a valid, reachable live Supabase project configuration is present. */
export const isSupabaseConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return false;
  // Dead, expired, or placeholder hosts must fall back to mock mode
  if (url.includes('knabfxzouliunawxirdh') || url.includes('placeholder')) {
    return false;
  }
  return true;
};

/** Returns live Supabase configuration and fails closed when it is incomplete. */
export const getSupabaseConfig = (): { url: string; anonKey: string } => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      'Live mode requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return { url, anonKey };
};
