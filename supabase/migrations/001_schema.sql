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
  role text not null check (role in ('super_admin', 'sales_rep', 'finance_manager', 'inventory_manager', 'ceo')) default 'sales_rep',
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

-- Indexes for performance
create index if not exists idx_inventory_product on public.inventory(product_id);
create index if not exists idx_inventory_location on public.inventory(location_id);
create index if not exists idx_inventory_expiry on public.inventory(expiry_date);
create index if not exists idx_invoices_customer on public.invoices(customer_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_leave_requests_user on public.leave_requests(user_id);
create index if not exists idx_attendance_logs_user on public.attendance_logs(user_id);
create index if not exists idx_attendance_logs_date on public.attendance_logs(date);
create index if not exists idx_payroll_runs_status on public.payroll_runs(status);
create index if not exists idx_payslips_run on public.payslips(payroll_run_id);
create index if not exists idx_payslips_user on public.payslips(user_id);
create index if not exists idx_appointments_patient on public.appointments(patient_id);
create index if not exists idx_appointments_date on public.appointments(date);
create index if not exists idx_chat_messages_sender on public.chat_messages(sender_id);
create index if not exists idx_chat_messages_receiver on public.chat_messages(receiver_id);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(read);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
