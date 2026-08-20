-- Migration 006: Branch Expenses and Flexible Payroll Extensions

-- 1. Create branch_expenses table
CREATE TABLE IF NOT EXISTS public.branch_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('inventory_purchase', 'utilities', 'payroll', 'maintenance', 'rent', 'equipment', 'other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES public.profiles(id),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.branch_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branch_expenses
DO $$ BEGIN
  DROP POLICY IF EXISTS "branch_expenses_select" ON public.branch_expenses;
  CREATE POLICY "branch_expenses_select" ON public.branch_expenses FOR SELECT USING (
    get_user_role() IN ('super_admin', 'finance_manager', 'ceo', 'clinic_admin') OR location_id = get_user_location()
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping branch_expenses_select — table missing';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "branch_expenses_insert" ON public.branch_expenses;
  CREATE POLICY "branch_expenses_insert" ON public.branch_expenses FOR INSERT WITH CHECK (
    get_user_role() IN ('super_admin', 'finance_manager', 'ceo', 'clinic_admin')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping branch_expenses_insert — table missing';
END $$;

-- Trigger for branch_expenses updated_at
DROP TRIGGER IF EXISTS trg_branch_expenses_updated_at ON public.branch_expenses;
CREATE TRIGGER trg_branch_expenses_updated_at
  BEFORE UPDATE ON public.branch_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 2. Extend salaries table for flexible debits & additions
ALTER TABLE public.salaries ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.salaries ADD COLUMN IF NOT EXISTS loan_repayment NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.salaries ADD COLUMN IF NOT EXISTS unmet_target_penalty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.salaries ADD COLUMN IF NOT EXISTS custom_deductions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.salaries ADD COLUMN IF NOT EXISTS custom_additions JSONB DEFAULT '[]'::jsonb;

-- 3. Extend payslips table for flexible debits & additions
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS loan_repayment NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS unmet_target_penalty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS custom_deductions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS custom_additions JSONB DEFAULT '[]'::jsonb;
