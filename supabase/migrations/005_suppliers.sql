-- Migration 005: Suppliers Table

-- 1. Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 2. RLS policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
  CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (
    get_user_role() IN ('super_admin', 'inventory_manager', 'ceo')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping suppliers_select — table missing';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
  CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (
    get_user_role() IN ('super_admin', 'inventory_manager')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping suppliers_insert — table missing';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
  CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (
    get_user_role() IN ('super_admin', 'inventory_manager')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping suppliers_update — table missing';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "suppliers_delete" ON public.suppliers;
  CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (
    get_user_role() = 'super_admin'
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping suppliers_delete — table missing';
END $$;

-- 3. Ensure update_updated_at function exists, then add trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 4. Add supplier_id to stock_movements for tracking receipts from suppliers
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);
