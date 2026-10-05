-- Migration 004: Strict Roles and Clinic Updates

-- 1. Update profiles.role constraint to include new roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN (
    'super_admin', 'sales_rep', 'finance_manager', 'inventory_manager', 
    'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 
    'regional_manager', 'ceo', 'security', 'lab_scientist'
  ));

-- 2. Create clinic_staff_roles table for multi-role assignment
CREATE TABLE IF NOT EXISTS public.clinic_staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id uuid not null references public.locations(id) on delete cascade,
  role text not null check (role in ('clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'security', 'lab_scientist')),
  created_at timestamptz not null default now(),
  unique(user_id, clinic_id, role)
);

ALTER TABLE public.clinic_staff_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_staff_select" ON public.clinic_staff_roles;
CREATE POLICY "clinic_staff_select" ON public.clinic_staff_roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "clinic_staff_manage" ON public.clinic_staff_roles;
CREATE POLICY "clinic_staff_manage" ON public.clinic_staff_roles FOR ALL USING (get_user_role() IN ('super_admin', 'clinic_admin'));

-- 3. Clinic Admin Read-Only: Grant SELECT on all operational tables, block writes

DROP POLICY IF EXISTS "invoices_select_clinic_admin" ON public.invoices;
CREATE POLICY "invoices_select_clinic_admin" ON public.invoices FOR SELECT USING (get_user_role() = 'clinic_admin');

DROP POLICY IF EXISTS "payments_select_clinic_admin" ON public.payments;
CREATE POLICY "payments_select_clinic_admin" ON public.payments FOR SELECT USING (get_user_role() = 'clinic_admin');

DROP POLICY IF EXISTS "inventory_select_clinic_admin" ON public.inventory;
CREATE POLICY "inventory_select_clinic_admin" ON public.inventory FOR SELECT USING (get_user_role() = 'clinic_admin');

-- 4. Strict Error Correction: Remove super_admin from writes and restrict UPDATE to creators

-- CUSTOMERS
DROP POLICY IF EXISTS "customers_insert_rep" ON public.customers;
CREATE POLICY "customers_insert_rep" ON public.customers FOR INSERT WITH CHECK (get_user_role() = 'sales_rep');

DROP POLICY IF EXISTS "customers_update" ON public.customers;
-- Allow update by the creator, finance managers (for payment approval balance adjustments), and super admins
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (
  created_by = auth.uid()
  OR get_user_role() IN ('finance_manager', 'super_admin')
);

-- INVOICES
DROP POLICY IF EXISTS "invoices_insert_rep" ON public.invoices;
CREATE POLICY "invoices_insert_rep" ON public.invoices FOR INSERT WITH CHECK (get_user_role() = 'sales_rep');

DROP POLICY IF EXISTS "invoices_update_rep" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_creator" ON public.invoices;
-- Sales reps can only update their own draft invoices
CREATE POLICY "invoices_update_rep" ON public.invoices FOR UPDATE USING (
  get_user_role() = 'sales_rep' AND created_by = auth.uid() AND status = 'draft'
);
-- Finance managers and super admins can update any invoice (e.g. mark as paid)
CREATE POLICY "invoices_update_admin" ON public.invoices FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'finance_manager')
);

-- INVOICE ITEMS
DROP POLICY IF EXISTS "invoice_items_insert" ON public.invoice_items;
CREATE POLICY "invoice_items_insert" ON public.invoice_items FOR INSERT WITH CHECK (
  get_user_role() = 'sales_rep' AND EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.created_by = auth.uid())
);

DROP POLICY IF EXISTS "invoice_items_update" ON public.invoice_items;
CREATE POLICY "invoice_items_update" ON public.invoice_items FOR UPDATE USING (
  get_user_role() = 'sales_rep' AND EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.created_by = auth.uid())
);

DROP POLICY IF EXISTS "invoice_items_delete" ON public.invoice_items;
CREATE POLICY "invoice_items_delete" ON public.invoice_items FOR DELETE USING (
  get_user_role() = 'sales_rep' AND EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.created_by = auth.uid())
);

-- PAYMENTS
DROP POLICY IF EXISTS "payments_insert_rep" ON public.payments;
CREATE POLICY "payments_insert_rep" ON public.payments FOR INSERT WITH CHECK (get_user_role() = 'sales_rep');

DROP POLICY IF EXISTS "payments_update_finance" ON public.payments;
DROP POLICY IF EXISTS "payments_update_creator" ON public.payments;
-- Sales reps can update their own pending payments
CREATE POLICY "payments_update_rep" ON public.payments FOR UPDATE USING (
  get_user_role() = 'sales_rep' AND recorded_by = auth.uid() AND status = 'pending'
);
-- Finance managers and super admins can update any payment (approve/reject)
CREATE POLICY "payments_update_finance" ON public.payments FOR UPDATE USING (
  get_user_role() IN ('super_admin', 'finance_manager')
);

-- 4. Clinic Tables: Remove super_admin from writes (patients, appointments, treatments, etc.)

-- PATIENTS
DROP POLICY IF EXISTS "patients_insert" ON public.patients;
CREATE POLICY "patients_insert" ON public.patients FOR INSERT WITH CHECK (get_user_role() IN ('ceo', 'vet', 'vet_tech', 'vet_assistant', 'receptionist', 'clinic_admin'));

DROP POLICY IF EXISTS "patients_update" ON public.patients;
CREATE POLICY "patients_update" ON public.patients FOR UPDATE USING (get_user_role() IN ('ceo', 'vet', 'vet_tech', 'vet_assistant', 'clinic_admin'));

-- APPOINTMENTS
DROP POLICY IF EXISTS "appointments_manage" ON public.appointments;
CREATE POLICY "appointments_manage" ON public.appointments FOR ALL USING (get_user_role() IN ('ceo', 'vet', 'receptionist', 'clinic_admin'));

-- TREATMENTS
DROP POLICY IF EXISTS "treatments_manage" ON public.treatments;
CREATE POLICY "treatments_manage" ON public.treatments FOR ALL USING (get_user_role() IN ('ceo', 'vet', 'clinic_admin'));

-- TREATMENT MEDICATIONS
DROP POLICY IF EXISTS "treatment_meds_manage" ON public.treatment_medications;
CREATE POLICY "treatment_meds_manage" ON public.treatment_medications FOR ALL USING (get_user_role() IN ('ceo', 'vet', 'clinic_admin'));

-- PATIENT QUEUE
DROP POLICY IF EXISTS "queue_manage" ON public.patient_queue;
CREATE POLICY "queue_manage" ON public.patient_queue FOR ALL USING (get_user_role() IN ('ceo', 'vet', 'vet_tech', 'receptionist', 'clinic_admin'));

-- VET SERVICES
DROP POLICY IF EXISTS "vet_services_manage" ON public.vet_services;
CREATE POLICY "vet_services_manage" ON public.vet_services FOR ALL USING (get_user_role() IN ('ceo', 'clinic_admin'));
