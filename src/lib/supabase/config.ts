export const isSupabaseMockMode = (): boolean =>
  process.env.NEXT_PUBLIC_USE_MOCK === 'true';

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
