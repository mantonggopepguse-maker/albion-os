import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.\n' +
      'Tip: copy .env.example to .env.local and fill in the values, then run `node --env-file=.env.local scripts/seed-users.mjs`.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD;
if (!DEFAULT_PASSWORD) {
  console.error(
    'Missing SEED_USER_PASSWORD env var. Set it in .env.local before running the seeder.'
  );
  process.exit(1);
}

const users = [
  { email: 'admin@albionpharma.com', full_name: 'Super admin(CEO)', role: 'super_admin' },
  { email: 'ceo@albionpharma.com', full_name: 'Chief Executive', role: 'ceo' },
  { email: 'chidi@albionpharma.com', full_name: 'Chidi', role: 'sales_rep' },
  { email: 'ngozi@albionpharma.com', full_name: 'Ngozi', role: 'finance_manager' },
  { email: 'tunde@albionpharma.com', full_name: 'Tunde', role: 'inventory_manager' },
];

async function seed() {
  console.log('Seeding demo users via Supabase Admin API...');
  let failed = 0;
  for (const u of users) {
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });
    if (error) {
      console.log(`Failed to create ${u.email}:`, error.message);
      failed++;
    } else {
      console.log(`Created ${u.email}`);
    }
  }
  if (failed > 0) process.exit(1);
}

seed();
