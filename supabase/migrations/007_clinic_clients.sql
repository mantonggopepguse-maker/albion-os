-- Migration 007: Dedicated Clinic Clients (Pet Owners)
-- Establishes clinic_clients separate from pharma customers and staff profiles

CREATE TABLE IF NOT EXISTS public.clinic_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT DEFAULT 'Lagos',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  preferred_contact TEXT DEFAULT 'Phone' CHECK (preferred_contact IN ('Phone', 'WhatsApp', 'Email', 'SMS')),
  referral_source TEXT,
  notes TEXT,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinic_clients ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clinic_clients_phone ON public.clinic_clients(phone);
CREATE INDEX IF NOT EXISTS idx_clinic_clients_location ON public.clinic_clients(location_id);

-- RLS Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "clinic_clients_select" ON public.clinic_clients;
  CREATE POLICY "clinic_clients_select" ON public.clinic_clients FOR SELECT USING (
    get_user_role() IN ('super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'finance_manager')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping clinic_clients_select — table missing';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "clinic_clients_insert" ON public.clinic_clients;
  CREATE POLICY "clinic_clients_insert" ON public.clinic_clients FOR INSERT WITH CHECK (
    get_user_role() IN ('super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping clinic_clients_insert — table missing';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "clinic_clients_update" ON public.clinic_clients;
  CREATE POLICY "clinic_clients_update" ON public.clinic_clients FOR UPDATE USING (
    get_user_role() IN ('super_admin', 'ceo', 'clinic_admin', 'vet', 'receptionist')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping clinic_clients_update — table missing';
END $$;

-- Auto-update updated_at timestamp trigger
DROP TRIGGER IF EXISTS trg_clinic_clients_updated_at ON public.clinic_clients;
CREATE TRIGGER trg_clinic_clients_updated_at
  BEFORE UPDATE ON public.clinic_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
