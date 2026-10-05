-- ============================================================
-- AlbionOS Database Schema
-- Supabase PostgreSQL Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
--
-- This file defines the complete database schema for AlbionOS,
-- the enterprise operating system for Albion Pharmaceuticals.
--
-- Structure overview:
-- ─────────────────────
--   1.  locations       – Physical sites (warehouses, territories, clinics)
--   2.  profiles        – User profiles linked 1:1 with auth.users
--   3.  products        – Master product catalog
--   4.  inventory       – Stock levels per product per location
--   5.  customers       – Pharmacy/clinic/dealer customer records
--   6.  invoices        – Sales invoice headers
--   7.  invoice_items   – Line items within an invoice
--   8.  payments        – Payment records pending verification
--   9.  chat_messages   – Internal team messaging
--   10. stock_movements – Inventory audit trail
--
-- Design principles:
-- ─────────────────────
-- • All PKs use UUID v4 (via uuid-ossp extension) for Supabase compatibility.
-- • Every mutable table has `created_at` / `updated_at` columns with
--   auto-updating triggers.
-- • CHECK constraints enforce allowed enum values inline (no separate
--   enum types), keeping migrations simpler.
-- • Row Level Security (RLS) is enabled on every table. Access is
--   role-based, resolved through two helper functions:
--     – get_user_role()     → returns the current user's role string
--     – get_user_location() → returns the current user's location_id
-- • The general RLS strategy is:
--     – super_admin sees/does everything
--     – finance_manager has broad read + payment approval
--     – sales_rep is scoped to own data (own invoices, own customers)
--     – inventory_manager manages stock across all warehouses
-- ============================================================


-- ─── Enable Required Extensions ───
-- uuid-ossp provides uuid_generate_v4() for primary key generation.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. LOCATIONS (Tenant Anchor)
-- ============================================================
-- Locations are the top-level organizational unit in AlbionOS.
-- Each user, customer, and inventory record is tied to a location.
-- Types:
--   • 'warehouse'  – HQ or distribution center (holds stock)
--   • 'territory'  – Sales region assigned to a rep
--   • 'clinic'     – Veterinary clinic (future vet module)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                           -- Human-readable location name
  type TEXT NOT NULL CHECK (type IN ('warehouse', 'territory', 'clinic')),
  region TEXT,                                  -- Geographic region (e.g. "South East")
  state TEXT,                                   -- Nigerian state
  address TEXT,                                 -- Full street address
  is_active BOOLEAN DEFAULT true,               -- Soft-delete flag
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 2. PROFILES (Linked to auth.users)
-- ============================================================
-- Every authenticated user has exactly one profile row.
-- The PK (`id`) is a FK to `auth.users(id)` — when the auth
-- user is deleted, the profile is cascade-deleted too.
--
-- The `role` column drives all RLS policies. Allowed roles:
--   • super_admin       – Full system access
--   • sales_rep         – Field sales, scoped to own territory
--   • finance_manager   – Payment approval, financial reports
--   • inventory_manager – Stock management across all warehouses
--   • clinic_admin, vet, vet_tech, vet_assistant, receptionist
--                       – Future veterinary clinic roles
--   • regional_manager  – Future role for multi-territory oversight
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'super_admin', 'sales_rep', 'finance_manager', 'inventory_manager',
    'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist',
    'regional_manager', 'ceo'
  )),
  location_id UUID REFERENCES locations(id),    -- The user's assigned location (nullable for super_admin)
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 3. PRODUCTS (Master Catalog)
-- ============================================================
-- Central product catalog for all Albion pharmaceutical and
-- veterinary products. SKU is the unique business identifier.
-- `nafdac_number` is the Nigerian drug regulatory approval code.
-- Products are location-independent; stock levels are tracked
-- in the `inventory` table per location.
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,                     -- Unique stock-keeping unit code (e.g. "ALB-IVM-001")
  nafdac_number TEXT,                           -- NAFDAC regulatory approval number
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Default unit price in Nigerian Naira
  category TEXT,                                -- Product category (injectable, premix, bolus, etc.)
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 4. INVENTORY (Stock at Each Location)
-- ============================================================
-- Tracks physical stock quantities. Each row represents a
-- specific batch of a product at a specific location.
-- Multiple rows per product are possible (different batches,
-- different expiry dates).
--
-- The `status` column reflects the current stock state:
--   • 'in_stock'     – Normal availability
--   • 'low_stock'    – Below reorder threshold (app-defined)
--   • 'out_of_stock' – Zero quantity
--   • 'expired'      – Past expiry_date
--   • 'allocated'    – Reserved for a pending order
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  batch_number TEXT,                            -- Manufacturer's batch/lot number
  expiry_date DATE,                             -- Product expiration date
  status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'expired', 'allocated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 5. CUSTOMERS
-- ============================================================
-- Pharmacies, clinics, agro-dealers, and other buyers.
-- Each customer is tied to a location (sales territory) and
-- was created by a specific user (sales rep or admin).
--
-- Financial fields:
--   • credit_limit         – Maximum allowed credit balance
--   • outstanding_balance  – Current unpaid amount
-- These are maintained by the application layer when payments
-- and invoices are processed.
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                           -- Contact person's name
  business_name TEXT,                           -- Company/pharmacy name
  phone TEXT,
  email TEXT,
  address TEXT,
  state TEXT,                                   -- Nigerian state
  credit_limit NUMERIC(12,2) DEFAULT 0,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  location_id UUID REFERENCES locations(id),    -- Which sales territory this customer belongs to
  created_by UUID REFERENCES profiles(id),      -- The rep/admin who added this customer
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 6. INVOICES
-- ============================================================
-- Sales invoice headers. Each invoice belongs to a customer,
-- was created by a sales rep, and is tied to a location.
--
-- Status lifecycle:
--   draft → sent → (paid | partial | overdue) → cancelled
--
-- Financial columns:
--   • subtotal – Sum of line item totals (before tax)
--   • vat      – Value Added Tax amount
--   • total    – subtotal + vat (final invoice amount)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,          -- Human-readable invoice number (e.g. "INV-2026-001")
  customer_id UUID NOT NULL REFERENCES customers(id),
  sales_rep_id UUID NOT NULL REFERENCES profiles(id),
  location_id UUID NOT NULL REFERENCES locations(id),
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
-- Individual products on an invoice. Each row links an invoice
-- to a product with quantity and pricing.
-- `product_name` is denormalized here so the line item preserves
-- the name at time of sale even if the product is later renamed.
-- Deleting an invoice cascades to delete its line items.
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,                   -- Snapshot of product name at time of invoicing
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,            -- Price per unit at time of sale
  total NUMERIC(12,2) NOT NULL,                 -- quantity × unit_price
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 8. PAYMENTS
-- ============================================================
-- Payment records submitted by sales reps for verification by
-- finance managers. Each payment is linked to a customer and
-- optionally to a specific invoice.
--
-- Verification workflow:
--   1. Sales rep records a payment (status = 'pending')
--   2. Finance manager reviews proof_url (bank receipt)
--   3. Finance manager approves or rejects
--
-- Columns:
--   • method      – 'cash' or 'bank_transfer'
--   • proof_url   – URL to uploaded bank transfer receipt image
--   • recorded_by – The sales rep who collected the payment
--   • approved_by – The finance manager who approved/rejected
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id),      -- Optional — payment may not be tied to a specific invoice
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'bank_transfer')),
  proof_url TEXT,                               -- Bank transfer receipt image URL
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  recorded_by UUID REFERENCES profiles(id),     -- Sales rep who collected payment
  approved_by UUID REFERENCES profiles(id),     -- Finance manager who verified
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 9. CHAT MESSAGES
-- ============================================================
-- Internal team messaging. Direct messages between two users.
-- No group chat support yet — each message has exactly one
-- sender and one receiver.
--
-- The `is_read` flag is toggled by the receiver when they view
-- the message. Attachments are stored as URLs with a type hint.
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT,                                 -- Message body (may be null if attachment-only)
  attachment_url TEXT,                          -- URL to attached file/image
  attachment_type TEXT,                         -- 'image', 'document', etc.
  is_read BOOLEAN DEFAULT false,               -- Toggled to true when receiver views the message
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 10b. SUPPLIERS (defined before stock_movements so its FK can resolve)
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 11. STOCK MOVEMENTS (Audit Trail)
-- ============================================================
-- Immutable log of all inventory changes. Every time stock is
-- allocated, returned, received, adjusted, or written off, a
-- row is inserted here.
--
-- `from_location_id` and `to_location_id` can be NULL:
--   • Receipt from supplier: from=NULL, to=warehouse
--   • Write-off: from=warehouse, to=NULL
--   • Transfer: both non-NULL
--
-- `reference_id` can point to an invoice, purchase order, or
-- other entity that triggered the movement.
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  from_location_id UUID REFERENCES locations(id),  -- Source location (NULL for receipts)
  to_location_id UUID REFERENCES locations(id),    -- Destination location (NULL for write-offs)
  supplier_id UUID REFERENCES suppliers(id),       -- Supplier for receipts (NULL otherwise)
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('allocation', 'return', 'receipt', 'adjustment', 'write_off', 'sale')),
  reference_id UUID,                               -- FK to the triggering entity (invoice, PO, etc.)
  notes TEXT,
  performed_by UUID REFERENCES profiles(id),       -- The user who performed the action
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 11. SALARY GRADES (Salary Bands)
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade TEXT NOT NULL UNIQUE,
  min_salary NUMERIC(12,2) NOT NULL,
  max_salary NUMERIC(12,2) NOT NULL,
  housing_allowance_pct NUMERIC(5,2) DEFAULT 0,
  transport_allowance_pct NUMERIC(5,2) DEFAULT 0,
  medical_allowance_pct NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. SALARIES (Per-Employee Salary Assignment)
-- ============================================================
CREATE TABLE IF NOT EXISTS salaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 13. PAYROLL RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 14. PAYSLIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 15. LEAVE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 16. LEAVE BALANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 17. ATTENDANCE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 18. EMPLOYEE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 19. PERFORMANCE TARGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 20. PERFORMANCE REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 20b. CLINIC CLIENTS (Pet Owners)
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 21. PATIENTS (Pets / Animals)
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_client_id UUID REFERENCES clinic_clients(id) ON DELETE SET NULL,
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
-- 22. APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 23. TREATMENTS (Medical Records)
-- ============================================================
CREATE TABLE IF NOT EXISTS treatments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 24. TREATMENT MEDICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 25. PATIENT QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 26. VET SERVICES (Procedure Catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 27. NARCOTIC LOGS (Controlled Substance Custody Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS narcotic_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  client_name TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  batch_number TEXT,
  dispensed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  dispenser_name TEXT NOT NULL,
  witness_name TEXT,
  purpose TEXT NOT NULL,
  notes TEXT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  dispensed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 28. ANNOUNCEMENTS (Broadcast Communications)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'hq', 'clinic', 'warehouse')),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 29. STAFF REQUESTS (Workforce Requests & Approvals)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('leave', 'transfer', 'restock', 'return', 'inquiry')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES (Performance)
-- ============================================================
-- Index strategy:
-- ─────────────────
-- Indexes are placed on columns that appear in:
--   • RLS policy WHERE clauses (role, location_id, sender/receiver)
--   • Common query filters (status, customer_id, sales_rep_id)
--   • JOIN conditions (foreign keys that are frequently queried)
--   • ORDER BY columns (created_at on chat for chronological queries)
--   • Date-range scans (expiry_date for expiry reports)
--
-- We avoid over-indexing: columns that are only used in rare
-- admin queries (e.g. products.sku) rely on sequential scans or
-- the UNIQUE constraint's implicit index.
-- ============================================================

-- Profiles: role-based RLS checks are the hottest path
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
-- Profiles: location-scoped queries (e.g. "all reps at Lagos")
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(location_id);

-- Inventory: product lookups (e.g. "all batches of product X")
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
-- Inventory: location-scoped stock views
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
-- Inventory: expiry-date range scans for the expiry report
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);

-- Customers: location-based filtering in sales rep views
CREATE INDEX IF NOT EXISTS idx_customers_location ON customers(location_id);

-- Invoices: customer-centric queries (e.g. "all invoices for customer X")
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
-- Invoices: rep-scoped queries (e.g. "my invoices" for a sales rep)
CREATE INDEX IF NOT EXISTS idx_invoices_rep ON invoices(sales_rep_id);
-- Invoices: status filtering (e.g. "all overdue invoices")
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Payments: status-based verification queue (pending → approved/rejected)
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
-- Payments: join back to invoice for financial reconciliation
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- Chat: sender-based lookups (e.g. "all messages I sent")
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id);
-- Chat: receiver-based lookups (e.g. "all messages sent to me")
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON chat_messages(receiver_id);
-- Chat: chronological ordering for conversation threads
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

-- Stock movements: product-centric audit trail
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- Salaries: user lookups
CREATE INDEX IF NOT EXISTS idx_salaries_user ON salaries(user_id);
-- Salaries: grade filtering
CREATE INDEX IF NOT EXISTS idx_salaries_grade ON salaries(salary_grade_id);

-- Suppliers: name lookups
CREATE INDEX IF NOT EXISTS idx_supplier_name ON suppliers(name);

-- Payroll runs: status-based views
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);

-- Payslips: payroll-run scoped queries
CREATE INDEX IF NOT EXISTS idx_payslips_run ON payslips(payroll_run_id);
-- Payslips: employee history
CREATE INDEX IF NOT EXISTS idx_payslips_user ON payslips(user_id);

-- Leave requests: employee-centric queries
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
-- Leave requests: pending approval queue
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- Leave balances: employee lookups
CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON leave_balances(user_id);

-- Attendance logs: date-range scans
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(date);

-- Employee documents: per-employee document lists
CREATE INDEX IF NOT EXISTS idx_documents_user ON employee_documents(user_id);

-- Performance targets: per-employee targets
CREATE INDEX IF NOT EXISTS idx_targets_user ON performance_targets(user_id);
-- Performance targets: active target lookups
CREATE INDEX IF NOT EXISTS idx_targets_status ON performance_targets(status);

-- Performance reviews: employee and reviewer lookups
CREATE INDEX IF NOT EXISTS idx_reviews_user ON performance_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON performance_reviews(reviewer_id);

-- Patients: owner-based lookups
CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients(owner_id);
-- Patients: species-based filtering
CREATE INDEX IF NOT EXISTS idx_patients_species ON patients(species);

-- Appointments: date-based schedule views
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
-- Appointments: patient history
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
-- Appointments: status filtering
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Treatments: patient medical history
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id);
-- Treatments: vet lookups
CREATE INDEX IF NOT EXISTS idx_treatments_vet ON treatments(vet_id);

-- Treatment medications: treatment-level lookups
CREATE INDEX IF NOT EXISTS idx_tx_meds_treatment ON treatment_medications(treatment_id);

-- Patient queue: status-based active queue view
CREATE INDEX IF NOT EXISTS idx_queue_status ON patient_queue(status);
-- Patient queue: location-based department view
CREATE INDEX IF NOT EXISTS idx_queue_location ON patient_queue(location_id);

-- Vet services: category grouping
CREATE INDEX IF NOT EXISTS idx_vet_services_category ON vet_services(category);


-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- RLS Strategy Overview:
-- ──────────────────────
-- Every table has RLS enabled. Policies use two helper functions
-- (defined below) to avoid repeated subqueries:
--
--   get_user_role()     → Returns the current user's role string.
--   get_user_location() → Returns the current user's location_id.
--
-- Both are marked SECURITY DEFINER so they can read the profiles
-- table regardless of the caller's own RLS constraints (avoids
-- infinite recursion), and STABLE to allow the query planner to
-- cache the result within a single statement.
--
-- General access tiers:
--   1. super_admin       → unrestricted on all tables
--   2. finance_manager   → broad read + payment write
--   3. inventory_manager → inventory + stock_movements read/write
--   4. sales_rep         → own data only (own invoices, own customers)
--   5. All authenticated → profiles (read), products (read), locations (read)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE vet_services ENABLE ROW LEVEL SECURITY;

-- ─── Helper Function: get_user_role() ───
-- Returns the role string for the currently authenticated user.
-- Used in almost every RLS policy to check role-based access.
-- SECURITY DEFINER: runs with the function owner's privileges,
-- bypassing RLS on the profiles table itself (prevents recursion).
-- STABLE: the result won't change within a single SQL statement,
-- so PostgreSQL can cache the lookup for multiple policy checks.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Helper Function: get_user_location() ───
-- Returns the location_id for the currently authenticated user.
-- Used in RLS policies that scope data to a user's assigned territory.
-- Same SECURITY DEFINER + STABLE rationale as get_user_role().
CREATE OR REPLACE FUNCTION get_user_location()
RETURNS UUID AS $$
  SELECT location_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── PROFILES ───
-- Read: Everyone can read all profiles (needed for chat contact lists,
-- user name lookups, and role-based UI rendering).
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
-- Update: Users can only update their own profile (name, phone, avatar).
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
-- Insert/Delete: Only super_admin can create or remove user profiles.
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT WITH CHECK (get_user_role() = 'super_admin');
CREATE POLICY "profiles_insert_ceo" ON profiles FOR INSERT WITH CHECK (get_user_role() = 'ceo');
CREATE POLICY "profiles_update_ceo" ON profiles FOR UPDATE USING (get_user_role() = 'ceo');
CREATE POLICY "profiles_delete_ceo" ON profiles FOR DELETE USING (get_user_role() = 'ceo');
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE USING (get_user_role() = 'super_admin');

-- ─── LOCATIONS ───
-- Read: All authenticated users can see locations (needed for dropdowns, etc.).
CREATE POLICY "locations_select" ON locations FOR SELECT USING (true);
-- Manage (insert/update/delete): Only super_admin can modify locations.
CREATE POLICY "locations_manage_admin" ON locations FOR ALL USING (get_user_role() = 'super_admin');

-- ─── PRODUCTS ───
-- Read: Everyone can view the product catalog.
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
-- Manage: Only admin and inventory_manager can create/edit/delete products.
CREATE POLICY "products_manage" ON products FOR ALL USING (
  get_user_role() IN ('super_admin', 'inventory_manager')
);

-- ─── INVENTORY ───
-- Read policies are role-specific to enforce data scoping:
-- Super admin: sees all inventory across all locations.
CREATE POLICY "inventory_select_admin" ON inventory FOR SELECT USING (
  get_user_role() = 'super_admin'
);
-- Sales rep: sees only inventory at their assigned location.
-- This prevents reps from seeing stock levels at other territories.
CREATE POLICY "inventory_select_rep" ON inventory FOR SELECT USING (
  get_user_role() = 'sales_rep' AND location_id = get_user_location()
);
-- Inventory manager: sees all inventory (they manage all warehouses).
CREATE POLICY "inventory_select_inv_mgr" ON inventory FOR SELECT USING (
  get_user_role() = 'inventory_manager'
);
-- Finance manager: read-only access to all inventory for reporting.
CREATE POLICY "inventory_select_finance" ON inventory FOR SELECT USING (
  get_user_role() = 'finance_manager'
);
-- CEO read: Full read-only access to all inventory data.
CREATE POLICY "inventory_select_ceo" ON inventory FOR SELECT USING (get_user_role() = 'ceo');
-- Write: Only admin and inventory_manager can modify stock records.
CREATE POLICY "inventory_manage" ON inventory FOR ALL USING (
  get_user_role() IN ('super_admin', 'inventory_manager')
);

-- ─── CUSTOMERS ───
-- Global read: Admin and finance see all customers for reporting.
CREATE POLICY "customers_select_global" ON customers FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager')
);
-- Scoped read: Sales rep sees customers in their territory OR
-- customers they personally created (handles territory transfers).
CREATE POLICY "customers_select_rep" ON customers FOR SELECT USING (
  get_user_role() = 'sales_rep' AND (location_id = get_user_location() OR created_by = auth.uid())
);
-- CEO read: Full read-only access across all customers for executive visibility.
CREATE POLICY "customers_select_ceo" ON customers FOR SELECT USING (get_user_role() = 'ceo');
-- Insert: Admin and sales reps can create new customers.
CREATE POLICY "customers_insert_rep" ON customers FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'sales_rep')
);
-- Update: Admin, finance, or the creating user can update customer records.
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'finance_manager') OR created_by = auth.uid()
);

-- ─── INVOICES ───
-- Global read: Admin and finance see all invoices.
CREATE POLICY "invoices_select_global" ON invoices FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager')
);
-- Scoped read: Sales rep sees only their own invoices.
CREATE POLICY "invoices_select_rep" ON invoices FOR SELECT USING (
  get_user_role() = 'sales_rep' AND sales_rep_id = auth.uid()
);
-- CEO read: Full read-only access across all invoices.
CREATE POLICY "invoices_select_ceo" ON invoices FOR SELECT USING (get_user_role() = 'ceo');
-- Insert: Admin and sales reps can create invoices.
CREATE POLICY "invoices_insert_rep" ON invoices FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'sales_rep')
);
-- Scoped update: Sales rep can only edit their own invoices that are
-- still in 'draft' status. Once sent, only admin/finance can modify.
CREATE POLICY "invoices_update_rep" ON invoices FOR UPDATE USING (
  get_user_role() = 'sales_rep' AND sales_rep_id = auth.uid() AND status = 'draft'
);
-- Global update: Admin and finance can update any invoice (e.g. mark as paid).
CREATE POLICY "invoices_update_admin" ON invoices FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'finance_manager')
);

-- ─── INVOICE ITEMS ───
-- Read: Users can only see line items for invoices they have access to.
-- Access mirrors the invoices RLS — admin/finance see all, reps see own, CEO sees all.
CREATE POLICY "invoice_items_select_admin" ON invoice_items FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager', 'ceo')
);
CREATE POLICY "invoice_items_select_rep" ON invoice_items FOR SELECT USING (
  get_user_role() = 'sales_rep' AND EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.sales_rep_id = auth.uid()
  )
);
-- Manage: Admin, sales reps, and finance can create/edit/delete line items.
-- Sales reps are restricted to items on invoices they own (parent-ownership check).
-- This prevents a rep from inserting items into another rep's invoice.
CREATE POLICY "invoice_items_manage" ON invoice_items FOR ALL USING (
  get_user_role() IN ('super_admin', 'finance_manager')
  OR (
    get_user_role() = 'sales_rep'
    AND EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.sales_rep_id = auth.uid()
    )
  )
);

-- ─── PAYMENTS ───
-- Global read: Admin and finance see all payments (verification queue).
CREATE POLICY "payments_select_global" ON payments FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager')
);
-- Scoped read: Sales rep sees only payments they personally recorded.
CREATE POLICY "payments_select_rep" ON payments FOR SELECT USING (
  get_user_role() = 'sales_rep' AND recorded_by = auth.uid()
);
-- CEO read: Full read-only access across all payments.
CREATE POLICY "payments_select_ceo" ON payments FOR SELECT USING (get_user_role() = 'ceo');
-- Insert: Admin and sales reps can record new payments.
CREATE POLICY "payments_insert_rep" ON payments FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'sales_rep')
);
-- Update (approve/reject): Only admin and finance can change payment status.
-- Sales reps cannot approve their own payments — separation of duties.
CREATE POLICY "payments_update_finance" ON payments FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'finance_manager')
);

-- ─── CHAT MESSAGES ───
-- Read: Users can only see messages where they are the sender OR receiver.
-- This ensures private conversations remain private.
CREATE POLICY "chat_select" ON chat_messages FOR SELECT USING (
  sender_id = auth.uid() OR receiver_id = auth.uid()
);
-- Insert: Any authenticated user can send a message, but only as themselves.
-- The CHECK ensures `sender_id` matches the authenticated user's ID,
-- preventing impersonation.
CREATE POLICY "chat_insert" ON chat_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
);
-- Update: Only the receiver can update a message (to mark it as read).
-- The sender cannot un-send or edit message content.
CREATE POLICY "chat_update_read" ON chat_messages FOR UPDATE USING (
  receiver_id = auth.uid()
);

-- ─── STOCK MOVEMENTS ───
-- Read/Write: Only admin and inventory_manager can view and create
-- stock movement records. This is an audit table — no updates or deletes.
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT USING (
  get_user_role() IN ('super_admin', 'inventory_manager')
);
CREATE POLICY "stock_movements_select_ceo" ON stock_movements FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'inventory_manager')
);

-- ─── SUPPLIERS ───
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (
  get_user_role() IN ('super_admin', 'inventory_manager', 'ceo')
);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'inventory_manager')
);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'inventory_manager')
);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (
  get_user_role() = 'super_admin'
);

-- ─── SALARY GRADES ───
CREATE POLICY "salary_grades_select" ON salary_grades FOR SELECT USING (true);
CREATE POLICY "salary_grades_manage" ON salary_grades FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo')
);

-- ─── SALARIES ───
CREATE POLICY "salaries_select_admin" ON salaries FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager', 'ceo')
);
CREATE POLICY "salaries_select_own" ON salaries FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "salaries_manage" ON salaries FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo')
);

-- ─── PAYROLL RUNS ───
CREATE POLICY "payroll_runs_select" ON payroll_runs FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager', 'ceo')
);
CREATE POLICY "payroll_runs_manage" ON payroll_runs FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo')
);

-- ─── PAYSLIPS ───
CREATE POLICY "payslips_select_admin" ON payslips FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager', 'ceo')
);
CREATE POLICY "payslips_select_own" ON payslips FOR SELECT USING (
  user_id = auth.uid()
);

-- ─── LEAVE REQUESTS ───
CREATE POLICY "leave_requests_select_admin" ON leave_requests FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY "leave_requests_select_own" ON leave_requests FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT WITH CHECK (
  user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'ceo') OR (user_id = auth.uid() AND status = 'pending')
);

-- ─── LEAVE BALANCES ───
CREATE POLICY "leave_balances_select_admin" ON leave_balances FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY "leave_balances_select_own" ON leave_balances FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "leave_balances_manage" ON leave_balances FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo')
);

-- ─── ATTENDANCE LOGS ───
CREATE POLICY "attendance_select_admin" ON attendance_logs FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY "attendance_select_own" ON attendance_logs FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "attendance_insert" ON attendance_logs FOR INSERT WITH CHECK (
  user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY "attendance_update" ON attendance_logs FOR UPDATE USING (
  user_id = auth.uid() OR get_user_role() IN ('super_admin', 'ceo')
);

-- ─── EMPLOYEE DOCUMENTS ───
CREATE POLICY "documents_select_admin" ON employee_documents FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY "documents_select_own" ON employee_documents FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "documents_manage" ON employee_documents FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo')
);

-- ─── PERFORMANCE TARGETS ───
CREATE POLICY "targets_select_admin" ON performance_targets FOR SELECT USING (
  get_user_role() IN ('super_admin', 'finance_manager', 'ceo')
);
CREATE POLICY "targets_select_own" ON performance_targets FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "targets_manage" ON performance_targets FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo')
);

-- ─── PERFORMANCE REVIEWS ───
CREATE POLICY "reviews_select_admin" ON performance_reviews FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY "reviews_select_own" ON performance_reviews FOR SELECT USING (
  user_id = auth.uid() OR reviewer_id = auth.uid()
);
CREATE POLICY "reviews_manage" ON performance_reviews FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo')
);

-- ─── PATIENTS ───
-- Read: Admin, CEO, vets, and clinic staff see all; owners see their own pets
CREATE POLICY "patients_select_all" ON patients FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
CREATE POLICY "patients_select_own" ON patients FOR SELECT USING (
  owner_id = auth.uid()
);
-- Insert: Clinic staff and admins can register patients
CREATE POLICY "patients_insert" ON patients FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
-- Update: Clinic staff and admins can update patient records
CREATE POLICY "patients_update" ON patients FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin')
);

-- ─── APPOINTMENTS ───
-- Read: Admin, CEO, and clinic staff see all; owners see their own
CREATE POLICY "appointments_select_all" ON appointments FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
CREATE POLICY "appointments_select_own" ON appointments FOR SELECT USING (
  owner_id = auth.uid()
);
-- Manage: Clinic staff manage appointments
CREATE POLICY "appointments_manage" ON appointments FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'receptionist', 'clinic_admin')
);

-- ─── TREATMENTS ───
-- Read: Admin, CEO, and clinic staff see all; pet owners see their pets' treatments
CREATE POLICY "treatments_select_all" ON treatments FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin')
);
CREATE POLICY "treatments_select_own" ON treatments FOR SELECT USING (
  patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
);
-- Manage: Vets and admins manage treatments
CREATE POLICY "treatments_manage" ON treatments FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'clinic_admin')
);

-- ─── TREATMENT MEDICATIONS ───
CREATE POLICY "tx_meds_select" ON treatment_medications FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin')
);
CREATE POLICY "tx_meds_manage" ON treatment_medications FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'clinic_admin')
);

-- ─── PATIENT QUEUE ───
CREATE POLICY "queue_select" ON patient_queue FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin')
);
CREATE POLICY "queue_manage" ON patient_queue FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'receptionist', 'clinic_admin')
);

-- ─── VET SERVICES ───
CREATE POLICY "vet_services_select" ON vet_services FOR SELECT USING (true);
CREATE POLICY "vet_services_manage" ON vet_services FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo', 'clinic_admin')
);

-- ─── NARCOTIC LOGS ───
ALTER TABLE narcotic_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "narcotic_logs_select" ON narcotic_logs FOR SELECT USING (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'pharmacist', 'clinic_admin')
);
CREATE POLICY "narcotic_logs_insert" ON narcotic_logs FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'ceo', 'vet', 'pharmacist', 'clinic_admin')
);

-- ─── ANNOUNCEMENTS ───
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (
  active = true OR get_user_role() IN ('super_admin', 'ceo', 'clinic_admin')
);
CREATE POLICY "announcements_manage" ON announcements FOR ALL USING (
  get_user_role() IN ('super_admin', 'ceo', 'clinic_admin')
);

-- ─── STAFF REQUESTS ───
ALTER TABLE staff_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_requests_select" ON staff_requests FOR SELECT USING (
  auth.uid() = user_id OR get_user_role() IN ('super_admin', 'ceo', 'clinic_admin', 'inventory_manager', 'finance_manager')
);
CREATE POLICY "staff_requests_insert" ON staff_requests FOR INSERT WITH CHECK (
  auth.uid() = user_id
);
CREATE POLICY "staff_requests_update" ON staff_requests FOR UPDATE USING (
  auth.uid() = user_id OR get_user_role() IN ('super_admin', 'ceo', 'clinic_admin', 'inventory_manager', 'finance_manager')
);


-- ============================================================
-- AUDIT LOG (Immutable Financial Trail)
-- ============================================================
-- Records every sensitive financial action (approve, reject,
-- reconcile) with a snapshot of before/after state.
-- Rows are INSERT-only — never updated or deleted.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  actor_id UUID REFERENCES profiles(id),
  actor_role TEXT,
  details JSONB,
  performed_by UUID REFERENCES profiles(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (true);
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (
  get_user_role() IN ('super_admin', 'finance_manager')
);


-- ============================================================
-- PAYMENT APPROVAL RPC (Server-Side Business Logic)
-- ============================================================
-- Atomically validates and executes payment approval inside a
-- single SECURITY DEFINER transaction. This prevents client-side
-- tampering: balance checks, invoice status transitions, and
-- customer balance deductions all happen on the database server.
-- ============================================================
CREATE OR REPLACE FUNCTION approve_payment(
  p_payment_id UUID,
  p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
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
  -- Lock and fetch the payment row
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment is not pending');
  END IF;

  -- Fetch approver role
  SELECT role INTO v_actor_role FROM profiles WHERE id = p_approver_id;
  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approver not found');
  END IF;

  -- Only finance_manager and super_admin can approve
  IF v_actor_role NOT IN ('finance_manager', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Process linked invoice if present
  IF v_payment.invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Linked invoice not found');
    END IF;

    -- Calculate total approved amount for this invoice
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

    -- Update invoice status
    v_inv_status := CASE WHEN v_new_paid >= v_invoice.total THEN 'paid' ELSE 'partial' END;
    UPDATE invoices SET status = v_inv_status WHERE id = v_payment.invoice_id;

    -- Update customer outstanding balance
    UPDATE customers
    SET outstanding_balance = GREATEST(0, outstanding_balance - v_payment.amount)
    WHERE id = v_payment.customer_id;
  END IF;

  -- Approve the payment
  UPDATE payments
  SET status = 'approved', approved_by = p_approver_id, approved_at = now()
  WHERE id = p_payment_id;

  -- Write immutable audit log
  INSERT INTO audit_log (table_name, record_id, action, actor_id, actor_role, details)
  VALUES (
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

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================================
-- REJECT PAYMENT RPC (Server-Side)
-- ============================================================
CREATE OR REPLACE FUNCTION reject_payment(
  p_payment_id UUID,
  p_approver_id UUID,
  p_reason TEXT DEFAULT 'Rejected by finance'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
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
  IF v_actor_role NOT IN ('finance_manager', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  UPDATE payments
  SET status = 'rejected', approved_by = p_approver_id, notes = p_reason
  WHERE id = p_payment_id;

  INSERT INTO audit_log (table_name, record_id, action, actor_id, actor_role, details)
  VALUES (
    'payments',
    p_payment_id,
    'rejected',
    p_approver_id,
    v_actor_role,
    jsonb_build_object('reason', p_reason, 'method', v_payment.method)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================================
-- SEED DATA (Locations)
-- ============================================================
-- Pre-populate the four core locations that the application
-- expects. These are referenced by seed.sql when creating
-- profiles, customers, and inventory records.
-- ON CONFLICT DO NOTHING ensures idempotency — re-running
-- this migration won't create duplicates.
-- ============================================================
INSERT INTO locations (name, type, region, state, address) VALUES
  ('Onitsha HQ Warehouse', 'warehouse', 'South East', 'Anambra', 'Plot 12, Industrial Layout, Onitsha'),
  ('Lagos Sales Territory', 'territory', 'South West', 'Lagos', 'Victoria Island, Lagos'),
  ('Abuja Sales Territory', 'territory', 'North Central', 'FCT', 'Garki, Abuja'),
  ('Delta Veterinary Clinic', 'clinic', 'South South', 'Delta', 'Asaba Main Road, Delta')
ON CONFLICT DO NOTHING;


-- ============================================================
-- INVOICE SEQUENCE & RPC (Transaction-Safe Numbering)
-- ============================================================
-- Using a database sequence ensures invoice numbers are never
-- duplicated even under concurrent writes. The RPC encapsulates
-- the full invoice + line item insert in a single transaction.
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION create_invoice(
  p_customer_id UUID,
  p_sales_rep_id UUID,
  p_location_id UUID,
  p_due_date DATE,
  p_items JSONB  -- Array of { product_id, product_name, quantity, unit_price, total }
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
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
  -- Compute financials
  SELECT SUM((item->>'total')::NUMERIC) INTO v_subtotal
  FROM jsonb_array_elements(p_items) AS item;

  v_vat := ROUND(v_subtotal * 0.075, 2);
  v_total := v_subtotal + v_vat;

  -- Generate invoice number (transaction-safe via sequence)
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_seq := NEXTVAL('invoice_number_seq');
  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');

  -- Insert invoice header
  INSERT INTO invoices (invoice_number, customer_id, sales_rep_id, location_id, subtotal, vat, total, status, due_date)
  VALUES (v_invoice_number, p_customer_id, p_sales_rep_id, p_location_id, v_subtotal, v_vat, v_total, 'draft', p_due_date)
  RETURNING id INTO v_invoice_id;

  -- Insert line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
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

-- ============================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================
-- A shared trigger function that sets `updated_at = now()` on
-- every UPDATE. Attached to all mutable tables via BEFORE UPDATE
-- triggers. This ensures the `updated_at` column always reflects
-- the last modification time without requiring application-level
-- management.
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_salaries_updated_at BEFORE UPDATE ON salaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payroll_runs_updated_at BEFORE UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leave_balances_updated_at BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attendance_logs_updated_at BEFORE UPDATE ON attendance_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employee_documents_updated_at BEFORE UPDATE ON employee_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_performance_targets_updated_at BEFORE UPDATE ON performance_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_performance_reviews_updated_at BEFORE UPDATE ON performance_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_treatments_updated_at BEFORE UPDATE ON treatments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patient_queue_updated_at BEFORE UPDATE ON patient_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vet_services_updated_at BEFORE UPDATE ON vet_services FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- ENABLE REALTIME (for Chat)
-- ============================================================
-- Adding `chat_messages` to the Supabase realtime publication
-- enables the client to subscribe to INSERT events via
-- `supabase.channel('chat').on('postgres_changes', ...)`.
--
-- This powers real-time message delivery: when User A sends
-- a message, User B's client receives it instantly via the
-- Supabase Realtime WebSocket without polling.
--
-- Only chat_messages is published — other tables use standard
-- REST queries and don't need push-based updates.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
