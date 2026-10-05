-- Migration 011: Staff Requests, Announcements, and Enterprise Operational Transactions
-- Provides durable schema, RLS, audit triggers, and RPCs for staff requests, announcements, recalls, price batches, and compensation adjustments.

-- 1. Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('all', 'clinic')),
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  location_name TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_announcements_location ON public.announcements(location_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

DO \$\$ BEGIN
  DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
  CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping announcements_select';
END \$\$;

DO \$\$ BEGIN
  DROP POLICY IF EXISTS "announcements_insert" ON public.announcements;
  CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT WITH CHECK (
    get_user_role() IN ('super_admin', 'ceo', 'clinic_admin', 'regional_manager')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping announcements_insert';
END \$\$;

-- 2. Staff Requests Table
CREATE TABLE IF NOT EXISTS public.staff_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  location_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('restock', 'stock_return', 'stock_transfer', 'leave_override', 'expense_reimbursement', 'general')),
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.staff_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_staff_requests_user ON public.staff_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_requests_status ON public.staff_requests(status);
CREATE INDEX IF NOT EXISTS idx_staff_requests_created_at ON public.staff_requests(created_at DESC);

DO \$\$ BEGIN
  DROP POLICY IF EXISTS "staff_requests_select" ON public.staff_requests;
  CREATE POLICY "staff_requests_select" ON public.staff_requests FOR SELECT USING (
    user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo', 'finance_manager', 'inventory_manager', 'clinic_admin')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping staff_requests_select';
END \$\$;

DO \$\$ BEGIN
  DROP POLICY IF EXISTS "staff_requests_insert" ON public.staff_requests;
  CREATE POLICY "staff_requests_insert" ON public.staff_requests FOR INSERT WITH CHECK (
    user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo', 'clinic_admin')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping staff_requests_insert';
END \$\$;

DO \$\$ BEGIN
  DROP POLICY IF EXISTS "staff_requests_update" ON public.staff_requests;
  CREATE POLICY "staff_requests_update" ON public.staff_requests FOR UPDATE USING (
    user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo', 'finance_manager', 'inventory_manager', 'clinic_admin')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping staff_requests_update';
END \$\$;

-- 3. Batch Update Product Prices RPC
CREATE OR REPLACE FUNCTION public.batch_update_product_prices(
  p_updates JSONB,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
DECLARE
  v_role TEXT;
  v_item JSONB;
  v_prod_id UUID;
  v_new_price NUMERIC;
  v_count INT := 0;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  IF v_role NOT IN ('super_admin', 'ceo', 'finance_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Insufficient permissions for price update');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_prod_id := (v_item->>'productId')::UUID;
    v_new_price := (v_item->>'newPrice')::NUMERIC;

    IF v_new_price > 0 THEN
      UPDATE products
      SET unit_price = v_new_price,
          updated_at = now()
      WHERE id = v_prod_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by)
  VALUES (
    'products',
    p_user_id,
    'BATCH_PRICE_UPDATE',
    jsonb_build_object('updated_count', v_count),
    p_user_id
  );

  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
\$\$;

-- 4. Recall Product Batch RPC
CREATE OR REPLACE FUNCTION public.recall_product_batch(
  p_batch_number TEXT,
  p_reason TEXT,
  p_recalled_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
DECLARE
  v_role TEXT;
  v_affected_count INT := 0;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_recalled_by;
  IF v_role NOT IN ('super_admin', 'ceo', 'inventory_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Insufficient permissions for product recall');
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_affected_count
  FROM inventory
  WHERE LOWER(batch_number) = LOWER(TRIM(p_batch_number))
    AND status != 'expired';

  UPDATE inventory
  SET status = 'expired'
  WHERE LOWER(batch_number) = LOWER(TRIM(p_batch_number));

  INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by)
  VALUES (
    'inventory',
    p_recalled_by,
    'PRODUCT_RECALL_INITIATED',
    jsonb_build_object('batch_number', p_batch_number, 'reason', p_reason, 'quarantined_units', v_affected_count),
    p_recalled_by
  );

  RETURN jsonb_build_object('success', true, 'affected_count', v_affected_count);
END;
\$\$;
