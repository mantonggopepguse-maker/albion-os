-- ============================================================
-- AlbionOS --- Plain PostgreSQL Schema (Neon / `albion` schema)
-- ============================================================
-- Migrated off Supabase (auth.users / RLS / storage) to a single,
-- plain-PostgreSQL schema on Neon. Row-level security is RE-MOVED;
-- authorization is enforced in the Express API layer via JWT + roles.
--
-- Run: psql "$DATABASE_URL" -f schema-albion.sql
-- ============================================================

CREATE SCHEMA IF NOT EXISTS albion;
SET search_path TO albion, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. LOCATIONS (Tenant Anchor)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('warehouse', 'territory', 'clinic')),
  region TEXT,
  state TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. PROFILES (Application Users --- replaces auth.users)
-- ============================================================
-- id is self-generated (no auth.users FK). password_hash stores a
-- bcrypt hash used by the Express login route. email is UNIQUE so
-- signup/login can locate the account without an external auth server.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'super_admin', 'sales_rep', 'finance_manager', 'inventory_manager',
    'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist',
    'regional_manager', 'ceo', 'security', 'lab_scientist'
  )),
  location_id UUID REFERENCES locations(id),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. PRODUCTS (Master Catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  nafdac_number TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. INVENTORY (Stock at Each Location)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'expired', 'allocated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  state TEXT,
  credit_limit NUMERIC(12,2) DEFAULT 0,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  location_id UUID REFERENCES locations(id),
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  sales_rep_id UUID NOT NULL REFERENCES profiles(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  created_by UUID REFERENCES profiles(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
  notes TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. INVOICE ITEMS (Line Items)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'bank_transfer')),
  proof_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  recorded_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. SUPPLIERS (defined before stock_movements so its FK can resolve)
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
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

-- ============================================================
-- 11. STOCK MOVEMENTS (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  supplier_id UUID REFERENCES suppliers(id),
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL DEFAULT 'allocation' CHECK (movement_type IN ('allocation', 'return', 'receipt', 'adjustment', 'write_off', 'sale')),
  reference_id UUID,
  notes TEXT,
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. SALARY GRADES
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade TEXT NOT NULL UNIQUE,
  min_salary NUMERIC(12,2) NOT NULL,
  max_salary NUMERIC(12,2) NOT NULL,
  housing_allowance_pct NUMERIC(5,2) DEFAULT 0,
  transport_allowance_pct NUMERIC(5,2) DEFAULT 0,
  medical_allowance_pct NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 13. SALARIES
-- ============================================================
CREATE TABLE IF NOT EXISTS salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salary_grade_id UUID NOT NULL REFERENCES salary_grades(id),
  basic_salary NUMERIC(12,2) NOT NULL,
  housing_allowance NUMERIC(12,2) DEFAULT 0,
  transport_allowance NUMERIC(12,2) DEFAULT 0,
  medical_allowance NUMERIC(12,2) DEFAULT 0,
  total_gross NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 7.5,
  pension_rate NUMERIC(5,2) DEFAULT 8.0,
  nhis_rate NUMERIC(5,2) DEFAULT 2.5,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 14. PAYROLL RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'cancelled')),
  total_gross NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  total_net NUMERIC(12,2) DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  processed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 15. PAYSLIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  basic_salary NUMERIC(12,2) NOT NULL,
  housing_allowance NUMERIC(12,2) DEFAULT 0,
  transport_allowance NUMERIC(12,2) DEFAULT 0,
  medical_allowance NUMERIC(12,2) DEFAULT 0,
  gross_pay NUMERIC(12,2) NOT NULL,
  paye_tax NUMERIC(12,2) DEFAULT 0,
  pension_deduction NUMERIC(12,2) DEFAULT 0,
  nhis_deduction NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 16. LEAVE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'study')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 17. LEAVE BALANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'study')),
  total_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(5,1) GENERATED ALWAYS AS (total_days - used_days) STORED,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, leave_type, year)
);

-- ============================================================
-- 18. ATTENDANCE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave')),
  hours_worked NUMERIC(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ============================================================
-- 19. EMPLOYEE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'id_card', 'certification', 'degree', 'nafdac_license', 'other')),
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  expiry_date DATE,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 20. PERFORMANCE TARGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('monthly', 'quarterly', 'annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sales_target NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_sales NUMERIC(12,2) DEFAULT 0,
  collection_target NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_collection NUMERIC(12,2) DEFAULT 0,
  new_customers_target INTEGER DEFAULT 0,
  new_customers_actual INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 21. PERFORMANCE REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  review_period TEXT NOT NULL,
  sales_achievement NUMERIC(5,2),
  collection_rate NUMERIC(5,2),
  customer_satisfaction NUMERIC(5,2),
  overall_rating NUMERIC(3,1),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 22. PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('Dog', 'Cat', 'Bird', 'Rabbit', 'Fish', 'Reptile', 'Horse', 'Goat', 'Sheep', 'Cattle', 'Poultry', 'Other')),
  breed TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  date_of_birth DATE,
  age_years INTEGER,
  age_months INTEGER,
  weight_kg NUMERIC(5,1),
  color TEXT,
  microchip_id TEXT,
  spayed_neutered BOOLEAN DEFAULT false,
  allergies TEXT,
  medical_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 23. APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  vet_id UUID REFERENCES profiles(id),
  location_id UUID REFERENCES locations(id),
  procedure_type TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  reason TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 24. TREATMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  chief_complaint TEXT,
  diagnosis TEXT,
  assessment TEXT,
  plan TEXT,
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'cancelled')),
  follow_up_date DATE,
  total_cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 25. TREATMENT MEDICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id UUID NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory(id),
  drug_name TEXT NOT NULL,
  dosage TEXT,
  route TEXT,
  frequency TEXT,
  duration TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 26. PATIENT QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  location_id UUID REFERENCES locations(id),
  department TEXT NOT NULL DEFAULT 'general',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'emergency')),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled', 'no_show')),
  reason TEXT,
  assigned_vet_id UUID REFERENCES profiles(id),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 27. VET SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  species TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 28. AUDIT LOG (Immutable Financial Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'reconciled', 'created', 'updated', 'deleted', 'INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  actor_id UUID REFERENCES profiles(id),
  actor_role TEXT,
  details JSONB,
  performed_by UUID REFERENCES profiles(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 29. CLINIC STAFF ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'security', 'lab_scientist')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, clinic_id, role)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_customers_location ON customers(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_rep ON invoices(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_salaries_user ON salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_salaries_grade ON salaries(salary_grade_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payslips_run ON payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user ON payslips(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_documents_user ON employee_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_user ON performance_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_status ON performance_targets(status);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON performance_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients(owner_id);
CREATE INDEX IF NOT EXISTS idx_patients_species ON patients(species);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_vet ON treatments(vet_id);
CREATE INDEX IF NOT EXISTS idx_tx_meds_treatment ON treatment_medications(treatment_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON patient_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_location ON patient_queue(location_id);
CREATE INDEX IF NOT EXISTS idx_vet_services_category ON vet_services(category);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_name ON suppliers(name);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_salaries_updated_at BEFORE UPDATE ON salaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_payroll_runs_updated_at BEFORE UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_leave_balances_updated_at BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_attendance_logs_updated_at BEFORE UPDATE ON attendance_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_employee_documents_updated_at BEFORE UPDATE ON employee_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_performance_targets_updated_at BEFORE UPDATE ON performance_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_performance_reviews_updated_at BEFORE UPDATE ON performance_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_treatments_updated_at BEFORE UPDATE ON treatments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_patient_queue_updated_at BEFORE UPDATE ON patient_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_vet_services_updated_at BEFORE UPDATE ON vet_services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Invoice numbering sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- create_invoice
CREATE OR REPLACE FUNCTION create_invoice(
  p_customer_id UUID,
  p_sales_rep_id UUID,
  p_location_id UUID,
  p_due_date DATE,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id UUID;
  v_subtotal NUMERIC(12,2);
  v_vat NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_year TEXT;
  v_seq INT;
  v_invoice_number TEXT;
  v_item JSONB;
BEGIN
  SELECT COALESCE(SUM((item->>'total')::NUMERIC), 0) INTO v_subtotal
  FROM jsonb_array_elements(COALESCE(p_items, '[]')) AS item;

  v_vat := ROUND(v_subtotal * 0.075, 2);
  v_total := v_subtotal + v_vat;

  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_seq := NEXTVAL('invoice_number_seq');
  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');

  INSERT INTO invoices (invoice_number, customer_id, sales_rep_id, location_id, created_by, subtotal, vat, total, status, due_date)
  VALUES (v_invoice_number, p_customer_id, p_sales_rep_id, p_location_id, p_sales_rep_id, v_subtotal, v_vat, v_total, 'draft', p_due_date)
  RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'))
  LOOP
    INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, total)
    VALUES (
      v_invoice_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::NUMERIC(12,2),
      (v_item->>'total')::NUMERIC(12,2)
    );
  END LOOP;

  RETURN v_invoice_id;
END;
$$;

-- approve_payment (server-side business logic)
CREATE OR REPLACE FUNCTION approve_payment(
  p_payment_id UUID,
  p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_invoice invoices%ROWTYPE;
  v_customer customers%ROWTYPE;
  v_approved_total NUMERIC(12,2);
  v_new_paid NUMERIC(12,2);
  v_inv_status TEXT;
  v_actor_role TEXT;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment is not pending');
  END IF;

  SELECT role INTO v_actor_role FROM profiles WHERE id = p_approver_id;
  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approver not found');
  END IF;

  IF v_actor_role NOT IN ('finance_manager', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  IF v_payment.invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Linked invoice not found');
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_approved_total
    FROM payments
    WHERE invoice_id = v_payment.invoice_id AND status = 'approved';

    v_new_paid := v_approved_total + v_payment.amount;

    IF v_new_paid > v_invoice.total THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Payment exceeds remaining invoice balance'
      );
    END IF;

    v_inv_status := CASE WHEN v_new_paid >= v_invoice.total THEN 'paid' ELSE 'partial' END;
    UPDATE invoices SET status = v_inv_status WHERE id = v_payment.invoice_id;
    UPDATE customers
    SET outstanding_balance = GREATEST(0, outstanding_balance - v_payment.amount)
    WHERE id = v_payment.customer_id;
  END IF;

  UPDATE payments
  SET status = 'approved', approved_by = p_approver_id, updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO audit_log (table_name, record_id, action, actor_id, actor_role, details)
  VALUES (
    'payments', p_payment_id, 'approved', p_approver_id, v_actor_role,
    jsonb_build_object('amount', v_payment.amount, 'method', v_payment.method,
                       'invoice_id', v_payment.invoice_id, 'customer_id', v_payment.customer_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- reject_payment
CREATE OR REPLACE FUNCTION reject_payment(
  p_payment_id UUID,
  p_approver_id UUID,
  p_reason TEXT DEFAULT 'Rejected by finance'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_actor_role TEXT;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment is not pending');
  END IF;

  SELECT role INTO v_actor_role FROM profiles WHERE id = p_approver_id;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('finance_manager', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  UPDATE payments
  SET status = 'rejected', approved_by = p_approver_id, notes = p_reason, updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO audit_log (table_name, record_id, action, actor_id, actor_role, performed_by, details)
  VALUES (
    'payments', p_payment_id, 'rejected', p_approver_id, v_actor_role, p_approver_id,
    jsonb_build_object('reason', p_reason, 'method', v_payment.method)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO locations (name, type, region, state, address) VALUES
  ('Onitsha HQ Warehouse', 'warehouse', 'South East', 'Anambra', 'Plot 12, Industrial Layout, Onitsha'),
  ('Lagos Sales Territory', 'territory', 'South West', 'Lagos', 'Victoria Island, Lagos'),
  ('Abuja Sales Territory', 'territory', 'North Central', 'FCT', 'Garki, Abuja'),
  ('Delta Veterinary Clinic', 'clinic', 'South South', 'Delta', 'Asaba Main Road, Delta')
ON CONFLICT DO NOTHING;

-- Demo user accounts (password hash of 'AlbionTest123!' via pgcrypto crypt)
INSERT INTO profiles (email, password_hash, full_name, phone, role, location_id)
SELECT 'admin@albionpharma.com', crypt('AlbionTest123!', gen_salt('bf', 10)), 'Dr. Emeka Moneke', '+234 803 000 0001', 'super_admin', (SELECT id FROM locations WHERE name LIKE '%HQ%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'admin@albionpharma.com');

INSERT INTO profiles (email, password_hash, full_name, phone, role, location_id)
SELECT 'chidi@albionpharma.com', crypt('AlbionTest123!', gen_salt('bf', 10)), 'Chidi Okafor', '+234 803 000 0002', 'sales_rep', (SELECT id FROM locations WHERE name LIKE '%Lagos%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'chidi@albionpharma.com');

INSERT INTO profiles (email, password_hash, full_name, phone, role, location_id)
SELECT 'ngozi@albionpharma.com', crypt('AlbionTest123!', gen_salt('bf', 10)), 'Ngozi Eze', '+234 803 000 0003', 'finance_manager', (SELECT id FROM locations WHERE name LIKE '%HQ%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'ngozi@albionpharma.com');

INSERT INTO profiles (email, password_hash, full_name, phone, role, location_id)
SELECT 'tunde@albionpharma.com', crypt('AlbionTest123!', gen_salt('bf', 10)), 'Tunde Adeyemi', '+234 803 000 0004', 'inventory_manager', (SELECT id FROM locations WHERE name LIKE '%HQ%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'tunde@albionpharma.com');

INSERT INTO profiles (email, password_hash, full_name, phone, role, location_id)
SELECT 'ceo@albionpharma.com', crypt('AlbionTest123!', gen_salt('bf', 10)), 'CEO Albion', '+234 803 000 0005', 'ceo', (SELECT id FROM locations WHERE name LIKE '%HQ%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'ceo@albionpharma.com');