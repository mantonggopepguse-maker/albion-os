import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.\n' +
      'Tip: copy .env.example to .env.local and fill in the values, then run `node --env-file=.env.local scripts/fix-roles.mjs`.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const users = [
  { email: 'admin@albionpharma.com', role: 'super_admin' },
  { email: 'ceo@albionpharma.com', role: 'ceo' },
  { email: 'chidi@albionpharma.com', role: 'sales_rep' },
  { email: 'ngozi@albionpharma.com', role: 'finance_manager' },
  { email: 'tunde@albionpharma.com', role: 'inventory_manager' },
];

async function fix() {
  let failed = 0;
  for (const u of users) {
    const { error } = await supabase.from('profiles').update({ role: u.role }).eq('email', u.email);
    if (error) {
      console.log(`Failed to update ${u.email}:`, error.message);
      failed++;
    } else {
      console.log(`Updated ${u.email} to ${u.role}`);
    }
  }
  if (failed > 0) process.exit(1);
}

fix();
