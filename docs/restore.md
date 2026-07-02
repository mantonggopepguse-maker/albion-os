# Disaster Recovery / Restore Procedure

## Prerequisites
- Supabase project access (dashboard or CLI)
- Latest backup file (`albionos_YYYY-MM-DD.sql`)
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Full Restore

### 1. Database
**Via Supabase Dashboard:**
1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Run migrations in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_reconciliation.sql`
   - `supabase/migrations/003_storage.sql`
3. To restore data: Use Dashboard → Database → Restore (PITR) or
   run the backup SQL file in SQL Editor.

**Via CLI (if configured):**
```bash
supabase db restore --file albionos_YYYY-MM-DD.sql
```

### 2. Storage Buckets
The `003_storage.sql` migration creates three buckets:
- `receipts` (public, 5MB, images + PDF)
- `chat_attachments` (public, 10MB, images + PDF + docs)
- `employee_documents` (private, 20MB, HR docs)

Verify with:
```sql
SELECT * FROM storage.buckets WHERE id IN ('receipts', 'chat_attachments', 'employee_documents');
```

### 3. Environment
Copy `.env.example` to `.env.local` and fill in:
```bash
cp .env.example .env.local
```

### 4. Application Build
```bash
npm ci
npm run build
npm start
```

### 5. Verify
1. Visit `/login` and confirm auth works
2. Check `/dashboard` loads with data
3. Run `npm run test` to confirm 94+ tests pass

## Point-in-Time Recovery (PITR)
- Supabase Pro plan includes 7-day PITR
- Dashboard → Database → Backups → Restore
- Select target timestamp before the incident

## Backup Schedule (Recommended)
- Daily: `pg_dump` via cron (automated in `scripts/backup.sh`)
- Weekly: Download from Supabase Dashboard

## Rollback a Migration
```sql
-- Reverse specific changes if needed
-- Example: drop RLS policies from 002
DROP POLICY IF EXISTS ... ON public.table;
```
