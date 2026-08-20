/**
 * pg database pool for AlbionOS.
 *
 * All tables live in the `albion` schema. The pool search_path is pinned
 * to `albion, public` so unqualified queries resolve to our tables while
 * built-ins (extensions like pgcrypto) remain reachable.
 */
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL (or DIRECT_URL) must be set');
}

export const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

// Neon's pooler rejects `search_path` in the startup `options` parameter, so we
// set it per-connection instead. This keeps unqualified table names resolving to
// the `albion` schema while leaving `public` (pgcrypto etc.) reachable.
pool.on('connect', (client) => {
  client.query('SET search_path TO albion,public').catch((err) => {
    console.error('Failed to set search_path on new client:', err.message);
  });
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export async function checkDb(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}