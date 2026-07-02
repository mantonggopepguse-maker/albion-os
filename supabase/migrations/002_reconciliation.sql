-- AlbionOS Database Migration 002: Schema Reconciliation
-- Adds RLS policies, helper functions, and missing tables/columns
-- that exist in schema.sql but are absent from 001_schema.sql

-- ─── Helper Functions (SECURITY DEFINER to bypass RLS recursion) ───
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_location()
RETURNS UUID AS $$
  SELECT location_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Missing Columns on 001_schema Tables ───

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.salaries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS movement_type TEXT NOT NULL DEFAULT 'allocation' CHECK (movement_type IN ('allocation', 'return', 'receipt', 'adjustment', 'write_off'));
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.profiles(id);

-- ─── Missing Tables ───

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'study')),
  total_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(5,1) GENERATED ALWAYS AS (total_days - used_days) STORED,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, leave_type, year)
);

-- ─── Audit Log Table ───
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Row Level Security ───

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ───

-- Profiles
CREATE POLICY IF NOT EXISTS "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY IF NOT EXISTS "profiles_insert_admin" ON public.profiles FOR INSERT WITH CHECK (get_user_role() = 'super_admin');
CREATE POLICY IF NOT EXISTS "profiles_insert_ceo" ON public.profiles FOR INSERT WITH CHECK (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "profiles_update_ceo" ON public.profiles FOR UPDATE USING (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "profiles_delete_ceo" ON public.profiles FOR DELETE USING (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "profiles_delete_admin" ON public.profiles FOR DELETE USING (get_user_role() = 'super_admin');

-- Locations
CREATE POLICY IF NOT EXISTS "locations_select" ON public.locations FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "locations_manage_admin" ON public.locations FOR ALL USING (get_user_role() = 'super_admin');

-- Products
CREATE POLICY IF NOT EXISTS "products_select" ON public.products FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "products_manage" ON public.products FOR ALL USING (get_user_role() IN ('super_admin', 'inventory_manager'));

-- Inventory
CREATE POLICY IF NOT EXISTS "inventory_select_admin" ON public.inventory FOR SELECT USING (get_user_role() = 'super_admin');
CREATE POLICY IF NOT EXISTS "inventory_select_rep" ON public.inventory FOR SELECT USING (get_user_role() = 'sales_rep' AND location_id = get_user_location());
CREATE POLICY IF NOT EXISTS "inventory_select_inv_mgr" ON public.inventory FOR SELECT USING (get_user_role() = 'inventory_manager');
CREATE POLICY IF NOT EXISTS "inventory_select_finance" ON public.inventory FOR SELECT USING (get_user_role() = 'finance_manager');
CREATE POLICY IF NOT EXISTS "inventory_select_ceo" ON public.inventory FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "inventory_manage" ON public.inventory FOR ALL USING (get_user_role() IN ('super_admin', 'inventory_manager'));

-- Customers
CREATE POLICY IF NOT EXISTS "customers_select_global" ON public.customers FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager'));
CREATE POLICY IF NOT EXISTS "customers_select_rep" ON public.customers FOR SELECT USING (get_user_role() = 'sales_rep' AND (location_id = get_user_location() OR created_by = auth.uid()));
CREATE POLICY IF NOT EXISTS "customers_select_ceo" ON public.customers FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "customers_insert_rep" ON public.customers FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'sales_rep'));
CREATE POLICY IF NOT EXISTS "customers_update" ON public.customers FOR UPDATE USING (get_user_role() IN ('super_admin', 'finance_manager') OR created_by = auth.uid());

-- Invoices
CREATE POLICY IF NOT EXISTS "invoices_select_global" ON public.invoices FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager'));
CREATE POLICY IF NOT EXISTS "invoices_select_rep" ON public.invoices FOR SELECT USING (get_user_role() = 'sales_rep' AND sales_rep_id = auth.uid());
CREATE POLICY IF NOT EXISTS "invoices_select_ceo" ON public.invoices FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "invoices_insert_rep" ON public.invoices FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'sales_rep'));
CREATE POLICY IF NOT EXISTS "invoices_update_rep" ON public.invoices FOR UPDATE USING (get_user_role() = 'sales_rep' AND sales_rep_id = auth.uid() AND status = 'draft');
CREATE POLICY IF NOT EXISTS "invoices_update_admin" ON public.invoices FOR UPDATE USING (get_user_role() IN ('super_admin', 'finance_manager'));

-- Invoice Items (fixed — parent-ownership check)
CREATE POLICY IF NOT EXISTS "invoice_items_select_admin" ON public.invoice_items FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager', 'ceo'));
CREATE POLICY IF NOT EXISTS "invoice_items_select_rep" ON public.invoice_items FOR SELECT USING (get_user_role() = 'sales_rep' AND EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.sales_rep_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "invoice_items_insert" ON public.invoice_items FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'sales_rep') AND EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND (invoices.sales_rep_id = auth.uid() OR get_user_role() = 'super_admin')));
CREATE POLICY IF NOT EXISTS "invoice_items_update" ON public.invoice_items FOR UPDATE USING (get_user_role() IN ('super_admin', 'sales_rep') AND EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND (invoices.sales_rep_id = auth.uid() OR get_user_role() = 'super_admin')));
CREATE POLICY IF NOT EXISTS "invoice_items_delete" ON public.invoice_items FOR DELETE USING (get_user_role() IN ('super_admin', 'sales_rep') AND EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND (invoices.sales_rep_id = auth.uid() OR get_user_role() = 'super_admin')));

-- Payments
CREATE POLICY IF NOT EXISTS "payments_select_global" ON public.payments FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager'));
CREATE POLICY IF NOT EXISTS "payments_select_rep" ON public.payments FOR SELECT USING (get_user_role() = 'sales_rep' AND recorded_by = auth.uid());
CREATE POLICY IF NOT EXISTS "payments_select_ceo" ON public.payments FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "payments_insert_rep" ON public.payments FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'sales_rep'));
CREATE POLICY IF NOT EXISTS "payments_update_finance" ON public.payments FOR UPDATE USING (get_user_role() IN ('super_admin', 'finance_manager'));

-- Chat Messages
CREATE POLICY IF NOT EXISTS "chat_select" ON public.chat_messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY IF NOT EXISTS "chat_insert" ON public.chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY IF NOT EXISTS "chat_update_read" ON public.chat_messages FOR UPDATE USING (receiver_id = auth.uid());

-- Stock Movements
CREATE POLICY IF NOT EXISTS "stock_movements_select" ON public.stock_movements FOR SELECT USING (get_user_role() IN ('super_admin', 'inventory_manager'));
CREATE POLICY IF NOT EXISTS "stock_movements_select_ceo" ON public.stock_movements FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY IF NOT EXISTS "stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'inventory_manager'));

-- Salary Grades
CREATE POLICY IF NOT EXISTS "salary_grades_select" ON public.salary_grades FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "salary_grades_manage" ON public.salary_grades FOR ALL USING (get_user_role() IN ('super_admin', 'ceo'));

-- Salaries
CREATE POLICY IF NOT EXISTS "salaries_select_admin" ON public.salaries FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager', 'ceo'));
CREATE POLICY IF NOT EXISTS "salaries_select_own" ON public.salaries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "salaries_manage" ON public.salaries FOR ALL USING (get_user_role() IN ('super_admin', 'ceo'));

-- Payroll Runs
CREATE POLICY IF NOT EXISTS "payroll_runs_select" ON public.payroll_runs FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager', 'ceo'));
CREATE POLICY IF NOT EXISTS "payroll_runs_manage" ON public.payroll_runs FOR ALL USING (get_user_role() IN ('super_admin', 'ceo'));

-- Payslips
CREATE POLICY IF NOT EXISTS "payslips_select_admin" ON public.payslips FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager', 'ceo'));
CREATE POLICY IF NOT EXISTS "payslips_select_own" ON public.payslips FOR SELECT USING (user_id = auth.uid());

-- Leave Requests
CREATE POLICY IF NOT EXISTS "leave_requests_select_admin" ON public.leave_requests FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "leave_requests_select_own" ON public.leave_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "leave_requests_insert" ON public.leave_requests FOR INSERT WITH CHECK (user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "leave_requests_update" ON public.leave_requests FOR UPDATE USING (get_user_role() IN ('super_admin', 'ceo') OR (user_id = auth.uid() AND status = 'pending'));

-- Leave Balances
CREATE POLICY IF NOT EXISTS "leave_balances_select_admin" ON public.leave_balances FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "leave_balances_select_own" ON public.leave_balances FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "leave_balances_manage" ON public.leave_balances FOR ALL USING (get_user_role() IN ('super_admin', 'ceo'));

-- Attendance Logs
CREATE POLICY IF NOT EXISTS "attendance_select_admin" ON public.attendance_logs FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "attendance_select_own" ON public.attendance_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "attendance_insert" ON public.attendance_logs FOR INSERT WITH CHECK (user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "attendance_update" ON public.attendance_logs FOR UPDATE USING (user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo'));

-- Employee Documents
CREATE POLICY IF NOT EXISTS "documents_select_admin" ON public.employee_documents FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "documents_select_own" ON public.employee_documents FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "documents_manage" ON public.employee_documents FOR ALL USING (get_user_role() IN ('super_admin', 'ceo'));

-- Performance Targets
CREATE POLICY IF NOT EXISTS "targets_select_admin" ON public.performance_targets FOR SELECT USING (get_user_role() IN ('super_admin', 'finance_manager', 'ceo'));
CREATE POLICY IF NOT EXISTS "targets_select_own" ON public.performance_targets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "targets_manage" ON public.performance_targets FOR ALL USING (get_user_role() IN ('super_admin', 'ceo'));

-- Performance Reviews
CREATE POLICY IF NOT EXISTS "reviews_select_admin" ON public.performance_reviews FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "reviews_select_own" ON public.performance_reviews FOR SELECT USING (user_id = auth.uid() OR reviewer_id = auth.uid());
CREATE POLICY IF NOT EXISTS "reviews_manage" ON public.performance_reviews FOR ALL USING (get_user_role() IN ('super_admin', 'ceo'));

-- Patients
CREATE POLICY IF NOT EXISTS "patients_select_all" ON public.patients FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin'));
CREATE POLICY IF NOT EXISTS "patients_select_own" ON public.patients FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY IF NOT EXISTS "patients_insert" ON public.patients FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin'));
CREATE POLICY IF NOT EXISTS "patients_update" ON public.patients FOR UPDATE USING (get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin'));

-- Appointments
CREATE POLICY IF NOT EXISTS "appointments_select_all" ON public.appointments FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin'));
CREATE POLICY IF NOT EXISTS "appointments_select_own" ON public.appointments FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY IF NOT EXISTS "appointments_manage" ON public.appointments FOR ALL USING (get_user_role() IN ('super_admin', 'ceo', 'vet', 'receptionist', 'clinic_admin'));

-- Treatments
CREATE POLICY IF NOT EXISTS "treatments_select_all" ON public.treatments FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin'));
CREATE POLICY IF NOT EXISTS "treatments_select_own" ON public.treatments FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE owner_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "treatments_manage" ON public.treatments FOR ALL USING (get_user_role() IN ('super_admin', 'ceo', 'vet', 'clinic_admin'));

-- Treatment Medications
CREATE POLICY IF NOT EXISTS "treatment_medications_select" ON public.treatment_medications FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "treatment_medications_manage" ON public.treatment_medications FOR ALL USING (get_user_role() IN ('super_admin', 'vet', 'clinic_admin'));

-- Patient Queue
CREATE POLICY IF NOT EXISTS "patient_queue_select" ON public.patient_queue FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "patient_queue_manage" ON public.patient_queue FOR ALL USING (get_user_role() IN ('super_admin', 'receptionist', 'clinic_admin', 'vet'));

-- Vet Services
CREATE POLICY IF NOT EXISTS "vet_services_select" ON public.vet_services FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "vet_services_manage" ON public.vet_services FOR ALL USING (get_user_role() IN ('super_admin', 'clinic_admin'));

-- Audit Log (insert-only, admin/ceo read)
CREATE POLICY IF NOT EXISTS "audit_log_select" ON public.audit_log FOR SELECT USING (get_user_role() IN ('super_admin', 'ceo'));
CREATE POLICY IF NOT EXISTS "audit_log_insert" ON public.audit_log FOR INSERT WITH CHECK (true);

-- ─── Missing Indexes ───
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_rep ON public.invoices(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON public.chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_location ON public.customers(location_id);
CREATE INDEX IF NOT EXISTS idx_salaries_user ON public.salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_salaries_grade ON public.salaries(grade_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON public.leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.employee_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_user ON public.performance_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_status ON public.performance_targets(status);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.performance_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_patients_owner ON public.patients(owner_id);
CREATE INDEX IF NOT EXISTS idx_patients_species ON public.patients(species);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON public.treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_vet ON public.treatments(performed_by);
CREATE INDEX IF NOT EXISTS idx_tx_meds_treatment ON public.treatment_medications(treatment_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON public.patient_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_location ON public.patient_queue(location_id);
CREATE INDEX IF NOT EXISTS idx_vet_services_category ON public.vet_services(category);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at);
