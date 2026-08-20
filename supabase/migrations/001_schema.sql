-- AlbionOS Database Schema
-- Migration 001: Core tables

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 1. Locations (enums and reference data)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('warehouse', 'territory', 'clinic')),
  region text not null,
  state text not null,
  address text not null default '',
  created_at timestamptz not null default now()
);

-- 2. Profiles (synced with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text,
  role text not null check (role in ('super_admin', 'sales_rep', 'finance_manager', 'inventory_manager', 'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'regional_manager', 'ceo')) default 'sales_rep',
  location_id uuid references public.locations(id),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'sales_rep'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  category text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price > 0),
  unit text not null default 'piece',
  dosage_form text not null default '',
  strength text not null default '',
  manufacturer text not null default '',
  nafdac_number text not null default '',
  requires_prescription boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text not null,
  email text,
  phone text not null,
  address text not null default '',
  state text not null default '',
  credit_limit numeric(12, 2) not null default 0 check (credit_limit >= 0),
  outstanding_balance numeric(12, 2) not null default 0 check (outstanding_balance >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Inventory
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  location_id uuid not null references public.locations(id),
  batch_number text not null,
  quantity integer not null check (quantity >= 0),
  expiry_date date not null,
  status text not null default 'in_stock' check (status in ('in_stock', 'low_stock', 'out_of_stock', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, location_id, batch_number)
);

-- 6. Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.customers(id),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  vat_rate numeric(5, 4) not null default 0.075,
  vat_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Invoice Items
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total numeric(12, 2) not null check (total >= 0)
);

-- 8. Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  customer_id uuid not null references public.customers(id),
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'bank_transfer', 'cheque', 'pos')),
  proof_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text,
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- 9. Stock Movements (audit log for allocations)
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  from_location_id uuid references public.locations(id),
  to_location_id uuid not null references public.locations(id),
  quantity integer not null check (quantity > 0),
  batch_number text not null,
  moved_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 10. Salary Grades
create table if not exists public.salary_grades (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_salary numeric(12, 2) not null check (min_salary > 0),
  max_salary numeric(12, 2) not null check (max_salary > 0)
);

-- 11. Salaries
create table if not exists public.salaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  grade_id uuid references public.salary_grades(id),
  basic_salary numeric(12, 2) not null check (basic_salary > 0),
  housing_allowance numeric(12, 2) not null default 0,
  transport_allowance numeric(12, 2) not null default 0,
  medical_allowance numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, is_active)
);

-- 12. Payroll Runs
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  payment_date date not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  total_gross numeric(12, 2) not null default 0,
  total_deductions numeric(12, 2) not null default 0,
  total_net numeric(12, 2) not null default 0,
  employee_count integer not null default 0,
  processed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 13. Payslips
create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id),
  user_id uuid not null references public.profiles(id),
  basic_salary numeric(12, 2) not null,
  housing_allowance numeric(12, 2) not null default 0,
  transport_allowance numeric(12, 2) not null default 0,
  medical_allowance numeric(12, 2) not null default 0,
  gross_pay numeric(12, 2) not null,
  paye_tax numeric(12, 2) not null default 0,
  pension_deduction numeric(12, 2) not null default 0,
  nhis_deduction numeric(12, 2) not null default 0,
  total_deductions numeric(12, 2) not null,
  net_pay numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

-- 14. Leave Requests
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  leave_type text not null check (leave_type in ('annual', 'sick', 'personal', 'maternity', 'paternity')),
  start_date date not null,
  end_date date not null,
  duration_days integer not null check (duration_days > 0),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 15. Attendance Logs
create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  date date not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

-- 16. Employee Documents
create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  name text not null,
  type text not null,
  url text not null,
  uploaded_at timestamptz not null default now()
);

-- 17. Performance Targets
create table if not exists public.performance_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text not null,
  description text not null default '',
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'achieved', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 18. Performance Reviews
create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  reviewer_id uuid not null references public.profiles(id),
  period text not null,
  rating integer check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 19. Patients (clinic module)
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null default '',
  breed text not null default '',
  age_years numeric(4, 1) default 0,
  weight_kg numeric(5, 1),
  color text not null default '',
  owner text not null,
  owner_phone text not null default '',
  last_visit date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 20. Appointments
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  date date not null,
  time time not null,
  reason text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 21. Patient Queue
create table if not exists public.patient_queue (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  appointment_id uuid references public.appointments(id),
  priority text not null default 'normal' check (priority in ('emergency', 'urgent', 'normal')),
  status text not null default 'waiting' check (status in ('waiting', 'with_vet', 'completed', 'cancelled')),
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 22. Veterinary Services
create table if not exists public.vet_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 23. Treatments
create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  appointment_id uuid references public.appointments(id),
  diagnosis text not null default '',
  notes text,
  performed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 24. Treatment Medications
create table if not exists public.treatment_medications (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  product_id uuid not null references public.products(id),
  dosage text not null default '',
  frequency text not null default '',
  duration text not null default '',
  notes text
);

-- 25. Chat Messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  receiver_id uuid references public.profiles(id),
  message text not null,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 26. Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 27. Audit Log (immutable financial trail)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('approved', 'rejected', 'reconciled', 'created', 'updated', 'deleted')),
  actor_id uuid not null references public.profiles(id),
  actor_role text not null,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helper Functions for Row Level Security
-- ============================================================

create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.get_user_location()
returns uuid as $$
  select location_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.salary_grades enable row level security;
alter table public.salaries enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
alter table public.leave_requests enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.employee_documents enable row level security;
alter table public.performance_targets enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.patient_queue enable row level security;
alter table public.vet_services enable row level security;
alter table public.treatments enable row level security;
alter table public.treatment_medications enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Locations
create policy "locations_select" on public.locations for select using (true);
create policy "locations_manage_admin" on public.locations for all using (get_user_role() = 'super_admin');

-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());
create policy "profiles_insert_admin" on public.profiles for insert with check (get_user_role() = 'super_admin');
create policy "profiles_insert_ceo" on public.profiles for insert with check (get_user_role() = 'ceo');
create policy "profiles_update_ceo" on public.profiles for update using (get_user_role() = 'ceo');
create policy "profiles_delete_admin" on public.profiles for delete using (get_user_role() = 'super_admin');
create policy "profiles_delete_ceo" on public.profiles for delete using (get_user_role() = 'ceo');

-- Products
create policy "products_select" on public.products for select using (true);
create policy "products_manage" on public.products for all using (
  get_user_role() in ('super_admin', 'inventory_manager')
);

-- Inventory
create policy "inventory_select_admin" on public.inventory for select using (
  get_user_role() = 'super_admin'
);
create policy "inventory_select_rep" on public.inventory for select using (
  get_user_role() = 'sales_rep' and location_id = get_user_location()
);
create policy "inventory_select_inv_mgr" on public.inventory for select using (
  get_user_role() = 'inventory_manager'
);
create policy "inventory_select_finance" on public.inventory for select using (
  get_user_role() = 'finance_manager'
);
create policy "inventory_select_ceo" on public.inventory for select using (get_user_role() = 'ceo');
create policy "inventory_manage" on public.inventory for all using (
  get_user_role() in ('super_admin', 'inventory_manager')
);

-- Customers
create policy "customers_select_global" on public.customers for select using (
  get_user_role() in ('super_admin', 'finance_manager')
);
create policy "customers_select_rep" on public.customers for select using (
  get_user_role() = 'sales_rep'
);
create policy "customers_select_ceo" on public.customers for select using (get_user_role() = 'ceo');
create policy "customers_insert" on public.customers for insert with check (
  get_user_role() in ('super_admin', 'sales_rep')
);
create policy "customers_update" on public.customers for update using (
  get_user_role() in ('super_admin', 'finance_manager')
);

-- Invoices
create policy "invoices_select_global" on public.invoices for select using (
  get_user_role() in ('super_admin', 'finance_manager')
);
create policy "invoices_select_rep" on public.invoices for select using (
  get_user_role() = 'sales_rep' and created_by = auth.uid()
);
create policy "invoices_select_ceo" on public.invoices for select using (get_user_role() = 'ceo');
create policy "invoices_insert" on public.invoices for insert with check (
  get_user_role() in ('super_admin', 'sales_rep')
);
create policy "invoices_update_rep" on public.invoices for update using (
  get_user_role() = 'sales_rep' and created_by = auth.uid() and status = 'draft'
);
create policy "invoices_update_admin" on public.invoices for update using (
  get_user_role() in ('super_admin', 'finance_manager')
);

-- Invoice Items
create policy "invoice_items_select_admin" on public.invoice_items for select using (
  get_user_role() in ('super_admin', 'finance_manager', 'ceo')
);
create policy "invoice_items_select_rep" on public.invoice_items for select using (
  get_user_role() = 'sales_rep' and exists (
    select 1 from public.invoices where invoices.id = invoice_items.invoice_id and invoices.created_by = auth.uid()
  )
);
create policy "invoice_items_manage" on public.invoice_items for all using (
  get_user_role() in ('super_admin', 'finance_manager')
  or (
    get_user_role() = 'sales_rep'
    and exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.created_by = auth.uid()
    )
  )
);

-- Payments
create policy "payments_select_global" on public.payments for select using (
  get_user_role() in ('super_admin', 'finance_manager')
);
create policy "payments_select_rep" on public.payments for select using (
  get_user_role() = 'sales_rep' and created_by = auth.uid()
);
create policy "payments_select_ceo" on public.payments for select using (get_user_role() = 'ceo');
create policy "payments_insert" on public.payments for insert with check (
  get_user_role() in ('super_admin', 'sales_rep')
);
create policy "payments_update_finance" on public.payments for update using (
  get_user_role() in ('super_admin', 'finance_manager')
);

-- Chat Messages
create policy "chat_select" on public.chat_messages for select using (
  sender_id = auth.uid() or receiver_id = auth.uid()
);
create policy "chat_insert" on public.chat_messages for insert with check (
  sender_id = auth.uid()
);
create policy "chat_update_read" on public.chat_messages for update using (
  receiver_id = auth.uid()
);

-- Stock Movements
create policy "stock_movements_select" on public.stock_movements for select using (
  get_user_role() in ('super_admin', 'inventory_manager')
);
create policy "stock_movements_select_ceo" on public.stock_movements for select using (get_user_role() = 'ceo');
create policy "stock_movements_insert" on public.stock_movements for insert with check (
  get_user_role() in ('super_admin', 'inventory_manager')
);

-- Salary Grades
create policy "salary_grades_select" on public.salary_grades for select using (true);
create policy "salary_grades_manage" on public.salary_grades for all using (
  get_user_role() in ('super_admin', 'ceo')
);

-- Salaries
create policy "salaries_select_admin" on public.salaries for select using (
  get_user_role() in ('super_admin', 'finance_manager', 'ceo')
);
create policy "salaries_select_own" on public.salaries for select using (
  user_id = auth.uid()
);
create policy "salaries_manage" on public.salaries for all using (
  get_user_role() in ('super_admin', 'ceo')
);

-- Payroll Runs
create policy "payroll_runs_select" on public.payroll_runs for select using (
  get_user_role() in ('super_admin', 'finance_manager', 'ceo')
);
create policy "payroll_runs_manage" on public.payroll_runs for all using (
  get_user_role() in ('super_admin', 'ceo')
);

-- Payslips
create policy "payslips_select_admin" on public.payslips for select using (
  get_user_role() in ('super_admin', 'finance_manager', 'ceo')
);
create policy "payslips_select_own" on public.payslips for select using (
  user_id = auth.uid()
);

-- Leave Requests
create policy "leave_requests_select_admin" on public.leave_requests for select using (
  get_user_role() in ('super_admin', 'ceo')
);
create policy "leave_requests_select_own" on public.leave_requests for select using (
  user_id = auth.uid()
);
create policy "leave_requests_insert" on public.leave_requests for insert with check (
  user_id = auth.uid() or get_user_role() in ('super_admin', 'ceo')
);
create policy "leave_requests_update" on public.leave_requests for update using (
  get_user_role() in ('super_admin', 'ceo') or (user_id = auth.uid() and status = 'pending')
);

-- Attendance Logs
create policy "attendance_select_admin" on public.attendance_logs for select using (
  get_user_role() in ('super_admin', 'ceo')
);
create policy "attendance_select_own" on public.attendance_logs for select using (
  user_id = auth.uid()
);
create policy "attendance_insert" on public.attendance_logs for insert with check (
  user_id = auth.uid() or get_user_role() in ('super_admin', 'ceo')
);
create policy "attendance_update" on public.attendance_logs for update using (
  user_id = auth.uid() or get_user_role() in ('super_admin', 'ceo')
);

-- Employee Documents
create policy "documents_select_admin" on public.employee_documents for select using (
  get_user_role() in ('super_admin', 'ceo')
);
create policy "documents_select_own" on public.employee_documents for select using (
  user_id = auth.uid()
);
create policy "documents_manage" on public.employee_documents for all using (
  get_user_role() in ('super_admin', 'ceo')
);

-- Performance Targets
create policy "targets_select_admin" on public.performance_targets for select using (
  get_user_role() in ('super_admin', 'finance_manager', 'ceo')
);
create policy "targets_select_own" on public.performance_targets for select using (
  user_id = auth.uid()
);
create policy "targets_manage" on public.performance_targets for all using (
  get_user_role() in ('super_admin', 'ceo')
);

-- Performance Reviews
create policy "reviews_select_admin" on public.performance_reviews for select using (
  get_user_role() in ('super_admin', 'ceo')
);
create policy "reviews_select_own" on public.performance_reviews for select using (
  user_id = auth.uid() or reviewer_id = auth.uid()
);
create policy "reviews_manage" on public.performance_reviews for all using (
  get_user_role() in ('super_admin', 'ceo')
);

-- Patients
create policy "patients_select" on public.patients for select using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
create policy "patients_insert" on public.patients for insert with check (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
create policy "patients_update" on public.patients for update using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin')
);

-- Appointments
create policy "appointments_select" on public.appointments for select using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
create policy "appointments_manage" on public.appointments for all using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'receptionist', 'clinic_admin')
);

-- Treatments
create policy "treatments_select" on public.treatments for select using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin')
);
create policy "treatments_manage" on public.treatments for all using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'clinic_admin')
);

-- Treatment Medications
create policy "tx_meds_select" on public.treatment_medications for select using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin')
);
create policy "tx_meds_manage" on public.treatment_medications for all using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'clinic_admin')
);

-- Patient Queue
create policy "queue_select" on public.patient_queue for select using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
create policy "queue_manage" on public.patient_queue for all using (
  get_user_role() in ('super_admin', 'ceo', 'vet', 'receptionist', 'clinic_admin')
);

-- Vet Services
create policy "vet_services_select" on public.vet_services for select using (true);
create policy "vet_services_manage" on public.vet_services for all using (
  get_user_role() in ('super_admin', 'ceo', 'clinic_admin')
);

-- Notifications
create policy "notifications_select_admin" on public.notifications for select using (
  get_user_role() in ('super_admin', 'ceo')
);
create policy "notifications_select_own" on public.notifications for select using (
  user_id = auth.uid()
);
create policy "notifications_insert" on public.notifications for insert with check (true);
create policy "notifications_update" on public.notifications for update using (
  user_id = auth.uid()
);

-- Audit Log
create policy "audit_log_select" on public.audit_log for select using (true);
create policy "audit_log_insert" on public.audit_log for insert with check (
  get_user_role() in ('super_admin', 'finance_manager')
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- Inventory
create index if not exists idx_inventory_product on public.inventory(product_id);
create index if not exists idx_inventory_location on public.inventory(location_id);
create index if not exists idx_inventory_expiry on public.inventory(expiry_date);

-- Profiles
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_location on public.profiles(location_id);

-- Invoices
create index if not exists idx_invoices_customer on public.invoices(customer_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_created_by on public.invoices(created_by);

-- Payments
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_created_by on public.payments(created_by);

-- Leave Requests
create index if not exists idx_leave_requests_user on public.leave_requests(user_id);
create index if not exists idx_leave_requests_status on public.leave_requests(status);

-- Attendance Logs
create index if not exists idx_attendance_logs_user on public.attendance_logs(user_id);
create index if not exists idx_attendance_logs_date on public.attendance_logs(date);

-- Payroll Runs
create index if not exists idx_payroll_runs_status on public.payroll_runs(status);

-- Payslips
create index if not exists idx_payslips_run on public.payslips(payroll_run_id);
create index if not exists idx_payslips_user on public.payslips(user_id);

-- Salaries
create index if not exists idx_salaries_user on public.salaries(user_id);
create index if not exists idx_salaries_grade on public.salaries(grade_id);

-- Appointments
create index if not exists idx_appointments_patient on public.appointments(patient_id);
create index if not exists idx_appointments_date on public.appointments(date);
create index if not exists idx_appointments_status on public.appointments(status);

-- Chat Messages
create index if not exists idx_chat_messages_sender on public.chat_messages(sender_id);
create index if not exists idx_chat_messages_receiver on public.chat_messages(receiver_id);
create index if not exists idx_chat_messages_created_at on public.chat_messages(created_at);

-- Notifications
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(read);

-- Stock Movements
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);

-- Employee Documents
create index if not exists idx_employee_documents_user on public.employee_documents(user_id);

-- Performance Targets
create index if not exists idx_performance_targets_user on public.performance_targets(user_id);
create index if not exists idx_performance_targets_status on public.performance_targets(status);

-- Performance Reviews
create index if not exists idx_performance_reviews_user on public.performance_reviews(user_id);
create index if not exists idx_performance_reviews_reviewer on public.performance_reviews(reviewer_id);

-- Treatments
create index if not exists idx_treatments_patient on public.treatments(patient_id);
create index if not exists idx_treatments_performed_by on public.treatments(performed_by);

-- Treatment Medications
create index if not exists idx_treatment_medications_treatment on public.treatment_medications(treatment_id);

-- Patient Queue
create index if not exists idx_patient_queue_status on public.patient_queue(status);
create index if not exists idx_patient_queue_priority on public.patient_queue(priority);

-- Audit Log
create index if not exists idx_audit_log_table on public.audit_log(table_name);
create index if not exists idx_audit_log_record on public.audit_log(record_id);
create index if not exists idx_audit_log_actor on public.audit_log(actor_id);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at);

-- ============================================================
-- Payment Approval RPCs
-- ============================================================

create or replace function public.approve_payment(
  p_payment_id uuid,
  p_approver_id uuid
)
returns jsonb
language plpgsql security definer
as $$
declare
  v_payment public.payments%rowtype;
  v_invoice public.invoices%rowtype;
  v_customer public.customers%rowtype;
  v_approved_total numeric(12,2);
  v_new_paid numeric(12,2);
  v_inv_status text;
  v_actor_role text;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Payment not found');
  end if;

  if v_payment.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'Payment is not pending');
  end if;

  select role into v_actor_role from public.profiles where id = p_approver_id;
  if v_actor_role is null then
    return jsonb_build_object('success', false, 'error', 'Approver not found');
  end if;

  if v_actor_role not in ('finance_manager', 'super_admin') then
    return jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  end if;

  if v_payment.invoice_id is not null then
    select * into v_invoice from public.invoices where id = v_payment.invoice_id for update;
    if not found then
      return jsonb_build_object('success', false, 'error', 'Linked invoice not found');
    end if;

    select coalesce(sum(amount), 0) into v_approved_total
    from public.payments
    where invoice_id = v_payment.invoice_id and status = 'approved';

    v_new_paid := v_approved_total + v_payment.amount;

    if v_new_paid > v_invoice.total then
      return jsonb_build_object(
        'success', false,
        'error', 'Payment exceeds remaining invoice balance'
      );
    end if;

    v_inv_status := case when v_new_paid >= v_invoice.total then 'paid' else 'partial' end;
    update public.invoices set status = v_inv_status where id = v_payment.invoice_id;

    update public.customers
    set outstanding_balance = greatest(0, outstanding_balance - v_payment.amount)
    where id = v_payment.customer_id;
  end if;

  update public.payments
  set status = 'approved', approved_by = p_approver_id, approved_at = now()
  where id = p_payment_id;

  insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, details)
  values (
    'payments',
    p_payment_id,
    'approved',
    p_approver_id,
    v_actor_role,
    jsonb_build_object(
      'amount', v_payment.amount,
      'method', v_payment.method,
      'invoice_id', v_payment.invoice_id,
      'customer_id', v_payment.customer_id
    )
  );

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.reject_payment(
  p_payment_id uuid,
  p_approver_id uuid,
  p_reason text default 'Rejected by finance'
)
returns jsonb
language plpgsql security definer
as $$
declare
  v_payment public.payments%rowtype;
  v_actor_role text;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Payment not found');
  end if;

  if v_payment.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'Payment is not pending');
  end if;

  select role into v_actor_role from public.profiles where id = p_approver_id;
  if v_actor_role not in ('finance_manager', 'super_admin') then
    return jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  end if;

  update public.payments
  set status = 'rejected', approved_by = p_approver_id, notes = p_reason
  where id = p_payment_id;

  insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, details)
  values (
    'payments',
    p_payment_id,
    'rejected',
    p_approver_id,
    v_actor_role,
    jsonb_build_object('reason', p_reason, 'method', v_payment.method)
  );

  return jsonb_build_object('success', true);
end;
$$;

-- allocate_stock: Atomic FEFO stock allocation across locations.
create or replace function public.allocate_stock(
  p_product_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_quantity numeric,
  p_batch_number text default null,
  p_performed_by uuid default null
)
returns jsonb
language plpgsql security definer
as $$
declare
  v_remaining numeric := p_quantity;
  v_source record;
  v_taken numeric;
  v_dest_id uuid;
  v_last_batch text;
  v_last_expiry date;
begin
  for v_source in
    select * from public.inventory
    where product_id = p_product_id
      and location_id = p_from_location_id
      and quantity > 0
    order by expiry_date asc, batch_number asc
    for update
  loop
    exit when v_remaining <= 0;

    if p_batch_number is not null and v_source.batch_number != p_batch_number then
      continue;
    end if;

    v_taken := least(v_source.quantity, v_remaining);
    v_remaining := v_remaining - v_taken;
    v_last_batch := v_source.batch_number;
    v_last_expiry := v_source.expiry_date;

    update public.inventory
    set
      quantity = v_source.quantity - v_taken,
      status = case
        when v_source.quantity - v_taken = 0 then 'out_of_stock'::text
        when v_source.quantity - v_taken < 50 then 'low_stock'::text
        else 'in_stock'::text
      end
    where id = v_source.id;

    select id into v_dest_id
    from public.inventory
    where product_id = p_product_id
      and location_id = p_to_location_id
      and batch_number = v_source.batch_number;

    if v_dest_id is not null then
      update public.inventory
      set quantity = quantity + v_taken, status = 'in_stock'
      where id = v_dest_id;
    else
      insert into public.inventory (product_id, location_id, quantity, batch_number, expiry_date, status)
      values (p_product_id, p_to_location_id, v_taken, v_source.batch_number, v_source.expiry_date, 'in_stock');
    end if;

    insert into public.stock_movements (product_id, from_location_id, to_location_id, quantity, movement_type, performed_by, reference_id, notes)
    values (p_product_id, p_from_location_id, p_to_location_id, v_taken, 'allocation', p_performed_by, v_source.id, 'Allocated via RPC');
  end loop;

  if v_remaining > 0 then
    return jsonb_build_object('success', false, 'error', format('Insufficient stock. Still need %s units.', v_remaining));
  end if;

  return jsonb_build_object('success', true, 'batch_number', v_last_batch);
end;
$$;
