-- Migration 012: Reconcile audit_log schema for universal compatibility
-- Ensures both (actor_id, actor_role, details) and (performed_by, new_data, old_data) coexist,
-- and removes restrictive action check constraints so all operational events can be recorded.

DO $$
BEGIN
  -- Add columns if missing
  ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_role TEXT;
  ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS details JSONB;
  ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS new_data JSONB;
  ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS old_data JSONB;
  ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;

  -- Relax constraints that may block inserts from different RPC styles
  ALTER TABLE public.audit_log ALTER COLUMN record_id DROP NOT NULL;
  ALTER TABLE public.audit_log ALTER COLUMN actor_id DROP NOT NULL;
  ALTER TABLE public.audit_log ALTER COLUMN actor_role DROP NOT NULL;

  -- Drop restrictive action check constraints if they exist
  ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping audit_log column or constraint alterations: %', SQLERRM;
END $$;
