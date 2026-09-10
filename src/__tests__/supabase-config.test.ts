import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseConfig, isSupabaseMockMode, isSupabaseConfigured } from '@/lib/supabase/config';

describe('Supabase runtime configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('enables mock mode only when explicitly requested', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', '');
    expect(isSupabaseMockMode()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true');
    expect(isSupabaseMockMode()).toBe(true);
  });

  it('fails closed when live Supabase configuration is incomplete', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(() => getSupabaseConfig()).toThrow('Live mode requires');
  });

  it('returns complete live configuration', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
    expect(getSupabaseConfig()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'public-anon-key',
    });
  });

  it('identifies unresolvable or expired Supabase project domains', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://knabfxzouliunawxirdh.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'some-key');
    expect(isSupabaseConfigured()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://valid-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'some-key');
    expect(isSupabaseConfigured()).toBe(true);
  });
});
