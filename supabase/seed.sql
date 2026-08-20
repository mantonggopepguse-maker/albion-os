-- ============================================================
-- AlbionOS Seed Data
-- Run AFTER schema.sql
-- This seeds products, customers, inventory, and sample data
-- NOTE: Users must be created via Supabase Auth first, then
-- their profiles are inserted here with matching UUIDs
-- ============================================================
--
-- USER CREATION WORKFLOW
-- ──────────────────────
-- Supabase separates authentication (auth.users) from application
-- data (public.profiles). The workflow is:
--
--   Step 1: Create users in Supabase Auth (Dashboard → Authentication)
--           This generates UUIDs in the `auth.users` table.
--
--   Step 2: Run this seed script, which:
--           a. Reads the generated UUIDs from `auth.users` by email
--           b. Inserts matching rows into `public.profiles`
--           c. Seeds products, customers, and other reference data
--
-- This two-step approach is necessary because:
--   • Supabase Auth manages password hashing, email verification,
--     and JWT issuance — we can't bypass it with direct SQL INSERTs.
--   • The `profiles.id` column is a FK to `auth.users(id)`, so the
--     auth user MUST exist before the profile can be inserted.
--
-- DO BLOCK PATTERN
-- ────────────────
-- We wrap everything in a PL/pgSQL DO $$ ... $$ block because:
--   1. We need DECLARE variables to hold dynamically-resolved UUIDs
--      (location IDs are looked up by name, not hardcoded).
--   2. We need to SELECT INTO variables before using them in INSERT
--      statements — plain SQL doesn't support this.
--   3. The entire block runs as a single transaction, so if any
--      step fails, all changes are rolled back.
-- ============================================================

-- ─── Step 1: Create users via Supabase Dashboard ───
-- Go to Supabase → Authentication → Users → Add User
-- Create these 4 users with Email/Password:
--   1. admin@albionpharma.com / AlbionTest123!
--   2. chidi@albionpharma.com / AlbionTest123!
--   3. ngozi@albionpharma.com / AlbionTest123!
--   4. tunde@albionpharma.com / AlbionTest123!
--
-- After creating them, note their UUIDs and replace below:
-- ============================================================

-- ─── Step 2: Insert Profiles (replace UUIDs with real auth.users IDs) ───
-- You will need to replace these placeholder UUIDs with the real
-- UUIDs from auth.users after creating the accounts above.

-- First, get the location IDs
DO $$
DECLARE
  -- ──────────────────────────────────────────────────────────
  -- Location UUID variables
  -- We resolve location IDs by name (not hardcoded UUIDs) so
  -- this script works regardless of the UUIDs that were
  -- auto-generated when schema.sql seeded the locations table.
  -- ──────────────────────────────────────────────────────────
  v_loc_hq UUID;      -- Onitsha HQ Warehouse (main distribution center)
  v_loc_lagos UUID;    -- Lagos Sales Territory
  v_loc_abuja UUID;    -- Abuja Sales Territory
  v_loc_delta UUID;    -- Delta Veterinary Clinic
BEGIN
  -- ──────────────────────────────────────────────────────────
  -- Resolve location UUIDs by name
  -- LIMIT 1 is a safety measure in case of duplicate names
  -- (shouldn't happen, but defensive SQL is good SQL).
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_loc_hq FROM locations WHERE name = 'Onitsha HQ Warehouse' LIMIT 1;
  SELECT id INTO v_loc_lagos FROM locations WHERE name = 'Lagos Sales Territory' LIMIT 1;
  SELECT id INTO v_loc_abuja FROM locations WHERE name = 'Abuja Sales Territory' LIMIT 1;
  SELECT id INTO v_loc_delta FROM locations WHERE name = 'Delta Veterinary Clinic' LIMIT 1;

  -- ──────────────────────────────────────────────────────────
  -- Insert user profiles
  -- ──────────────────────────────────────────────────────────
  -- This INSERT joins against `auth.users` to pull the real UUID
  -- for each email address. The CASE expressions map each email
  -- to its corresponding profile data (name, phone, role, location).
  --
  -- Why CASE on email instead of separate INSERTs?
  --   • Single INSERT is atomic — all profiles are created or none.
  --   • Avoids repeating the SELECT-from-auth.users pattern 4 times.
  --   • ON CONFLICT (id) DO NOTHING makes this idempotent: re-running
  --     the seed won't fail or create duplicates.
  --
  -- Role assignments:
  --   • admin@albionpharma.com → super_admin  (Dr. Emeka Moneke, at HQ)
  --   • chidi@albionpharma.com → sales_rep    (Chidi Okafor, at Lagos)
  --   • ngozi@albionpharma.com → finance_manager (Ngozi Eze, at HQ)
--   • tunde@albionpharma.com → inventory_manager (Tunde Adeyemi, at HQ)
--   • ceo@albionpharma.com   → ceo (Chief Executive, read-only view at HQ)
-- ──────────────────────────────────────────────────────────
  INSERT INTO profiles (id, email, full_name, phone, role, location_id)
  SELECT
    au.id,          -- Use the UUID from auth.users as the profile PK (FK constraint)
    au.email,
    CASE au.email
      WHEN 'admin@albionpharma.com' THEN 'Dr. Emeka Moneke'
      WHEN 'chidi@albionpharma.com' THEN 'Chidi Okafor'
      WHEN 'ngozi@albionpharma.com' THEN 'Ngozi Eze'
      WHEN 'tunde@albionpharma.com' THEN 'Tunde Adeyemi'
      WHEN 'ceo@albionpharma.com' THEN 'Chief Executive Officer'
    END,
    CASE au.email
      WHEN 'admin@albionpharma.com' THEN '+234 803 000 0001'
      WHEN 'chidi@albionpharma.com' THEN '+234 803 000 0002'
      WHEN 'ngozi@albionpharma.com' THEN '+234 803 000 0003'
      WHEN 'tunde@albionpharma.com' THEN '+234 803 000 0004'
      WHEN 'ceo@albionpharma.com' THEN '+234 803 000 0005'
    END,
    CASE au.email
      WHEN 'admin@albionpharma.com' THEN 'super_admin'
      WHEN 'chidi@albionpharma.com' THEN 'sales_rep'
      WHEN 'ngozi@albionpharma.com' THEN 'finance_manager'
      WHEN 'tunde@albionpharma.com' THEN 'inventory_manager'
      WHEN 'ceo@albionpharma.com' THEN 'ceo'
    END,
    -- Location assignment: admin, finance, and inventory are at HQ;
    -- the sales rep is assigned to the Lagos territory.
    CASE au.email
      WHEN 'admin@albionpharma.com' THEN v_loc_hq
      WHEN 'chidi@albionpharma.com' THEN v_loc_lagos
      WHEN 'ngozi@albionpharma.com' THEN v_loc_hq
      WHEN 'tunde@albionpharma.com' THEN v_loc_hq
      WHEN 'ceo@albionpharma.com' THEN v_loc_hq
    END
  FROM auth.users au
  WHERE au.email IN ('admin@albionpharma.com', 'chidi@albionpharma.com', 'ngozi@albionpharma.com', 'tunde@albionpharma.com', 'ceo@albionpharma.com')
  ON CONFLICT (id) DO NOTHING;  -- Idempotent: skip if profile already exists

  -- ──────────────────────────────────────────────────────────
  -- Seed products
  -- ──────────────────────────────────────────────────────────
  -- Eight representative Albion veterinary pharmaceutical products.
  -- SKU format: ALB-{3-letter code}-{sequence number}
  -- NAFDAC numbers are placeholder regulatory codes.
  -- Prices are in Nigerian Naira (₦).
  -- ON CONFLICT (sku) DO NOTHING: idempotent, won't duplicate on re-run.
  -- ──────────────────────────────────────────────────────────
  INSERT INTO products (name, sku, nafdac_number, unit_price, category, description) VALUES
    ('Albion Ivermectin 1% Injectable', 'ALB-IVM-001', 'NAFDAC/VET/2024/0001', 4500.00, 'injectable', 'Broad-spectrum antiparasitic for cattle and small ruminants. 50ml vial.'),
    ('Albion Oxytetracycline LA', 'ALB-OXY-002', 'NAFDAC/VET/2024/0002', 3800.00, 'injectable', 'Long-acting oxytetracycline injection. 100ml vial.'),
    ('Albion Multivitamin Premix', 'ALB-MVP-003', 'NAFDAC/VET/2024/0003', 8500.00, 'premix', 'Complete vitamin and mineral premix for poultry and livestock. 25kg bag.'),
    ('Albion Calcium Borogluconate', 'ALB-CAL-004', 'NAFDAC/VET/2024/0004', 2500.00, 'injectable', 'For treatment of hypocalcaemia in dairy cattle. 500ml bottle.'),
    ('Albion Diminazene Aceturate', 'ALB-DIM-005', 'NAFDAC/VET/2024/0005', 5200.00, 'injectable', 'Anti-trypanosomal agent for cattle and dogs. 2.36g sachet.'),
    ('Albion Poultry Vitamin Pack', 'ALB-PVP-006', 'NAFDAC/VET/2024/0006', 6800.00, 'feed_additive', 'Soluble vitamin supplement for poultry drinking water. 1kg pack.'),
    ('Albion Dewormer Bolus', 'ALB-DWB-007', 'NAFDAC/VET/2024/0007', 3200.00, 'bolus', 'Broad-spectrum anthelmintic bolus for cattle. Box of 50.'),
    ('Albion Wound Spray', 'ALB-WDS-008', 'NAFDAC/VET/2024/0008', 2800.00, 'spray', 'Topical antiseptic wound spray with fly repellent. 500ml aerosol.')
  ON CONFLICT (sku) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed customers
  -- ──────────────────────────────────────────────────────────
  -- Six sample customers across different Nigerian states.
  -- Each customer is assigned to a location (territory) and
  -- has a `created_by` reference to the auth user who "created"
  -- them. The `created_by` value is resolved dynamically via:
  --   (SELECT id FROM auth.users WHERE email = '...')
  -- because we don't know the auth user UUIDs at script-write time.
  --
  -- The VALUES clause uses a CTE-like pattern:
  --   INSERT INTO ... SELECT ... FROM (VALUES (...)) AS c(...)
  -- This allows us to use the v_loc_* variables (resolved above)
  -- as column values within the VALUES list, which plain VALUES
  -- syntax inside a direct INSERT wouldn't support.
  -- ──────────────────────────────────────────────────────────
  INSERT INTO customers (name, business_name, phone, email, address, state, credit_limit, outstanding_balance, location_id, created_by)
  SELECT
    c.name, c.business_name, c.phone, c.email, c.address, c.state,
    c.credit_limit, c.outstanding_balance, c.location_id, c.created_by
  FROM (VALUES
    ('Emeka Obi', 'VetZone Pharmacy', '+234 802 111 2222', 'emeka@vetzone.ng', '15 Awolowo Road, Ikeja', 'Lagos', 2000000.00, 450000.00, v_loc_lagos, (SELECT id FROM auth.users WHERE email = 'chidi@albionpharma.com')),
    ('Hauwa Bello', 'FarmKings Agro Dealers', '+234 805 333 4444', 'hauwa@farmkings.ng', '8 Sultan Road, Kaduna', 'Kaduna', 1500000.00, 280000.00, v_loc_abuja, (SELECT id FROM auth.users WHERE email = 'chidi@albionpharma.com')),
    ('Chukwuma Nwosu', 'Ekene Veterinary Pharmacy', '+234 803 555 6666', 'chukwuma@ekenevet.ng', '22 New Market Road, Onitsha', 'Anambra', 1000000.00, 0.00, v_loc_hq, (SELECT id FROM auth.users WHERE email = 'admin@albionpharma.com')),
    ('Adaeze Ike', 'PetHealth Clinic', '+234 809 777 8888', 'adaeze@pethealth.ng', '5 Ademola Adetokunbo, Wuse 2', 'FCT', 3000000.00, 175000.00, v_loc_abuja, (SELECT id FROM auth.users WHERE email = 'chidi@albionpharma.com')),
    ('Musa Abdullahi', 'Great Farmer Supplies', '+234 806 999 0000', 'musa@greatfarmer.ng', '12 Zaria Road, Kano', 'Kano', 800000.00, 120000.00, v_loc_abuja, (SELECT id FROM auth.users WHERE email = 'chidi@albionpharma.com')),
    ('Blessing Okonkwo', 'Delta Vet Centre', '+234 807 222 3333', 'blessing@deltavet.ng', '3 Benin-Asaba Expressway', 'Delta', 500000.00, 0.00, v_loc_delta, (SELECT id FROM auth.users WHERE email = 'admin@albionpharma.com'))
  ) AS c(name, business_name, phone, email, address, state, credit_limit, outstanding_balance, location_id, created_by);

END $$;

-- ============================================================
-- STAFF & SALARY MANAGEMENT SEED DATA
-- Seeds salary grades, salary assignments, payroll runs,
-- payslips, leave requests, leave balances, attendance logs,
-- employee documents, performance targets, and reviews.
-- ============================================================
DO $$
DECLARE
  -- User UUIDs (resolved from auth.users by email)
  v_admin UUID;
  v_chidi UUID;
  v_ngozi UUID;
  v_tunde UUID;
  v_ceo UUID;

  -- Salary grade UUIDs (resolved by grade name)
  v_sg_exec UUID;
  v_sg_grade1 UUID;
  v_sg_grade2 UUID;
  v_sg_grade3 UUID;
  v_sg_intern UUID;

  -- Payroll run UUIDs
  v_pr_apr UUID;
  v_pr_may UUID;
  v_pr_jun UUID;
BEGIN
  -- ──────────────────────────────────────────────────────────
  -- Resolve user UUIDs by email
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_admin FROM auth.users WHERE email = 'admin@albionpharma.com' LIMIT 1;
  SELECT id INTO v_chidi FROM auth.users WHERE email = 'chidi@albionpharma.com' LIMIT 1;
  SELECT id INTO v_ngozi FROM auth.users WHERE email = 'ngozi@albionpharma.com' LIMIT 1;
  SELECT id INTO v_tunde FROM auth.users WHERE email = 'tunde@albionpharma.com' LIMIT 1;
  SELECT id INTO v_ceo FROM auth.users WHERE email = 'ceo@albionpharma.com' LIMIT 1;

  -- ──────────────────────────────────────────────────────────
  -- Seed salary grades (no FK dependencies)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO salary_grades (id, grade, min_salary, max_salary, housing_allowance_pct, transport_allowance_pct, medical_allowance_pct) VALUES
    ('sg-exec-0001-0000-0000-000000000001', 'Executive', 800000.00, 1500000.00, 40.00, 15.00, 10.00),
    ('sg-grd1-0001-0000-0000-000000000001', 'Grade 1',   400000.00,  800000.00, 35.00, 12.00,  8.00),
    ('sg-grd2-0001-0000-0000-000000000001', 'Grade 2',   200000.00,  400000.00, 30.00, 10.00,  7.00),
    ('sg-grd3-0001-0000-0000-000000000001', 'Grade 3',   100000.00,  200000.00, 25.00,  8.00,  5.00),
    ('sg-int-0001-0000-0000-000000000001', 'Intern',     50000.00,   100000.00, 20.00,  5.00,  3.00)
  ON CONFLICT (grade) DO NOTHING;

  -- Resolve salary grade UUIDs by name
  SELECT id INTO v_sg_exec   FROM salary_grades WHERE grade = 'Executive' LIMIT 1;
  SELECT id INTO v_sg_grade1 FROM salary_grades WHERE grade = 'Grade 1' LIMIT 1;
  SELECT id INTO v_sg_grade2 FROM salary_grades WHERE grade = 'Grade 2' LIMIT 1;
  SELECT id INTO v_sg_grade3 FROM salary_grades WHERE grade = 'Grade 3' LIMIT 1;
  SELECT id INTO v_sg_intern FROM salary_grades WHERE grade = 'Intern' LIMIT 1;

  -- ──────────────────────────────────────────────────────────
  -- Seed salaries (one per user)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO salaries (id, user_id, salary_grade_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, total_gross, tax_rate, pension_rate, nhis_rate, total_deductions, net_pay, effective_date)
  SELECT * FROM (VALUES
    ('sal-0001-0000-0000-0000-000000000001', v_admin, v_sg_exec,   1200000.00, 480000.00, 180000.00, 120000.00, 1980000.00, 7.50, 8.00, 2.50, 356400.00,  1623600.00,  '2025-01-15'),
    ('sal-0001-0000-0000-0000-000000000002', v_chidi, v_sg_grade2, 300000.00,  90000.00,  30000.00,  21000.00,  441000.00,  7.50, 8.00, 2.50, 79380.00,   361620.00,   '2025-03-10'),
    ('sal-0001-0000-0000-0000-000000000003', v_ngozi, v_sg_grade1, 600000.00,  210000.00, 72000.00,  48000.00,  930000.00,  7.50, 8.00, 2.50, 167400.00,  762600.00,   '2025-02-20'),
    ('sal-0001-0000-0000-0000-000000000004', v_tunde, v_sg_grade2, 350000.00,  105000.00, 35000.00,  24500.00,  514500.00,  7.50, 8.00, 2.50, 92610.00,   421890.00,   '2025-04-05'),
    ('sal-0001-0000-0000-0000-000000000005', v_ceo,   v_sg_exec,   1500000.00, 600000.00, 225000.00, 150000.00, 2475000.00, 7.50, 8.00, 2.50, 445500.00,  2029500.00,  '2025-01-15')
  ) AS s(id, user_id, salary_grade_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, total_gross, tax_rate, pension_rate, nhis_rate, total_deductions, net_pay, effective_date)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed payroll runs
  -- ──────────────────────────────────────────────────────────
  INSERT INTO payroll_runs (id, period_start, period_end, payment_date, status, total_gross, total_deductions, total_net, employee_count, processed_by)
  SELECT * FROM (VALUES
    ('pr-0001-0000-0000-0000-000000000001', '2026-04-01', '2026-04-30', '2026-04-28', 'completed', 6337500.00, 1141290.00, 5196210.00, 5, v_admin),
    ('pr-0001-0000-0000-0000-000000000002', '2026-05-01', '2026-05-31', '2026-05-28', 'completed', 6337500.00, 1141290.00, 5196210.00, 5, v_admin),
    ('pr-0001-0000-0000-0000-000000000003', '2026-06-01', '2026-06-30', '2026-06-27', 'processing', 6337500.00, 1141290.00, 5196210.00, 5, v_admin)
  ) AS p(id, period_start, period_end, payment_date, status, total_gross, total_deductions, total_net, employee_count, processed_by)
  ON CONFLICT (id) DO NOTHING;

  -- Resolve payroll run UUIDs
  SELECT id INTO v_pr_apr FROM payroll_runs WHERE period_start = '2026-04-01' LIMIT 1;
  SELECT id INTO v_pr_may FROM payroll_runs WHERE period_start = '2026-05-01' LIMIT 1;
  SELECT id INTO v_pr_jun FROM payroll_runs WHERE period_start = '2026-06-01' LIMIT 1;

  -- ──────────────────────────────────────────────────────────
  -- Seed payslips
  -- ──────────────────────────────────────────────────────────
  INSERT INTO payslips (id, payroll_run_id, user_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, gross_pay, paye_tax, pension_deduction, nhis_deduction, total_deductions, net_pay)
  SELECT * FROM (VALUES
    -- April payslips
    ('ps-0001-0000-0000-0000-000000000001', v_pr_apr, v_admin, 1200000.00, 480000.00, 180000.00, 120000.00, 1980000.00, 148500.00, 158400.00, 49500.00, 356400.00,  1623600.00),
    ('ps-0001-0000-0000-0000-000000000002', v_pr_apr, v_chidi, 300000.00,  90000.00,  30000.00,  21000.00,  441000.00,  33075.00,  35280.00,  11025.00, 79380.00,   361620.00),
    ('ps-0001-0000-0000-0000-000000000003', v_pr_apr, v_ngozi, 600000.00,  210000.00, 72000.00,  48000.00,  930000.00,  69750.00,  74400.00,  23250.00, 167400.00,  762600.00),
    ('ps-0001-0000-0000-0000-000000000004', v_pr_apr, v_tunde, 350000.00,  105000.00, 35000.00,  24500.00,  514500.00,  38587.50,  41160.00,  12862.50, 92610.00,   421890.00),
    ('ps-0001-0000-0000-0000-000000000005', v_pr_apr, v_ceo,   1500000.00, 600000.00, 225000.00, 150000.00, 2475000.00, 185625.00, 198000.00, 61875.00, 445500.00,  2029500.00),
    -- May payslips
    ('ps-0001-0000-0000-0000-000000000006', v_pr_may, v_admin, 1200000.00, 480000.00, 180000.00, 120000.00, 1980000.00, 148500.00, 158400.00, 49500.00, 356400.00,  1623600.00),
    ('ps-0001-0000-0000-0000-000000000007', v_pr_may, v_chidi, 300000.00,  90000.00,  30000.00,  21000.00,  441000.00,  33075.00,  35280.00,  11025.00, 79380.00,   361620.00),
    ('ps-0001-0000-0000-0000-000000000008', v_pr_may, v_ngozi, 600000.00,  210000.00, 72000.00,  48000.00,  930000.00,  69750.00,  74400.00,  23250.00, 167400.00,  762600.00),
    ('ps-0001-0000-0000-0000-000000000009', v_pr_may, v_tunde, 350000.00,  105000.00, 35000.00,  24500.00,  514500.00,  38587.50,  41160.00,  12862.50, 92610.00,   421890.00),
    ('ps-0001-0000-0000-0000-000000000010', v_pr_may, v_ceo,   1500000.00, 600000.00, 225000.00, 150000.00, 2475000.00, 185625.00, 198000.00, 61875.00, 445500.00,  2029500.00),
    -- June payslips
    ('ps-0001-0000-0000-0000-000000000011', v_pr_jun, v_admin, 1200000.00, 480000.00, 180000.00, 120000.00, 1980000.00, 148500.00, 158400.00, 49500.00, 356400.00,  1623600.00),
    ('ps-0001-0000-0000-0000-000000000012', v_pr_jun, v_chidi, 300000.00,  90000.00,  30000.00,  21000.00,  441000.00,  33075.00,  35280.00,  11025.00, 79380.00,   361620.00),
    ('ps-0001-0000-0000-0000-000000000013', v_pr_jun, v_ngozi, 600000.00,  210000.00, 72000.00,  48000.00,  930000.00,  69750.00,  74400.00,  23250.00, 167400.00,  762600.00),
    ('ps-0001-0000-0000-0000-000000000014', v_pr_jun, v_tunde, 350000.00,  105000.00, 35000.00,  24500.00,  514500.00,  38587.50,  41160.00,  12862.50, 92610.00,   421890.00),
    ('ps-0001-0000-0000-0000-000000000015', v_pr_jun, v_ceo,   1500000.00, 600000.00, 225000.00, 150000.00, 2475000.00, 185625.00, 198000.00, 61875.00, 445500.00,  2029500.00)
  ) AS ps(id, payroll_run_id, user_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, gross_pay, paye_tax, pension_deduction, nhis_deduction, total_deductions, net_pay)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed leave balances (one per leave type per user per year)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO leave_balances (id, user_id, leave_type, total_days, used_days, year)
  SELECT * FROM (VALUES
    ('lb-0001-0000-0000-0000-000000000001', v_admin, 'annual',   24, 5,  2026),
    ('lb-0001-0000-0000-0000-000000000002', v_admin, 'sick',     10, 2,  2026),
    ('lb-0001-0000-0000-0000-000000000003', v_admin, 'personal',  5, 0,  2026),
    ('lb-0001-0000-0000-0000-000000000004', v_chidi, 'annual',   20, 8,  2026),
    ('lb-0001-0000-0000-0000-000000000005', v_chidi, 'sick',     10, 0,  2026),
    ('lb-0001-0000-0000-0000-000000000006', v_chidi, 'personal',  5, 1,  2026),
    ('lb-0001-0000-0000-0000-000000000007', v_ngozi, 'annual',   22, 5,  2026),
    ('lb-0001-0000-0000-0000-000000000008', v_ngozi, 'sick',     10, 0,  2026),
    ('lb-0001-0000-0000-0000-000000000009', v_tunde, 'annual',   20, 0,  2026),
    ('lb-0001-0000-0000-0000-000000000010', v_tunde, 'sick',     10, 2,  2026),
    ('lb-0001-0000-0000-0000-000000000011', v_ceo,   'annual',   24, 10, 2026),
    ('lb-0001-0000-0000-0000-000000000012', v_ceo,   'sick',     10, 1,  2026)
  ) AS lb(id, user_id, leave_type, total_days, used_days, year)
  ON CONFLICT (user_id, leave_type, year) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed leave requests
  -- ──────────────────────────────────────────────────────────
  INSERT INTO leave_requests (id, user_id, leave_type, start_date, end_date, duration_days, reason, status, approved_by, reviewed_at, reviewer_notes)
  SELECT * FROM (VALUES
    ('lr-0001-0000-0000-0000-000000000001', v_chidi, 'annual',   '2026-07-10', '2026-07-17', 7, 'Family vacation to Enugu',                            'pending',  NULL,       NULL, NULL),
    ('lr-0001-0000-0000-0000-000000000002', v_ngozi, 'annual',   '2026-05-05', '2026-05-09', 5, 'Personal time off',                                      'approved', v_admin,    '2026-04-28 14:00:00+00', 'Approved. Ensure handover of payment queue to deputy.'),
    ('lr-0001-0000-0000-0000-000000000003', v_tunde, 'sick',     '2026-04-20', '2026-04-21', 2, 'Malaria',                                                 'approved', v_admin,    '2026-04-20 10:00:00+00', 'Get well soon.'),
    ('lr-0001-0000-0000-0000-000000000004', v_chidi, 'personal', '2026-04-10', '2026-04-10', 1, 'Personal errand',                                          'approved', v_ngozi,    '2026-04-09 16:00:00+00', 'Noted.'),
    ('lr-0001-0000-0000-0000-000000000005', v_admin, 'annual',   '2026-08-01', '2026-08-14', 14, 'Annual leave — traveling abroad',                          'pending',  NULL,       NULL, NULL)
  ) AS lr(id, user_id, leave_type, start_date, end_date, duration_days, reason, status, approved_by, reviewed_at, reviewer_notes)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed attendance logs (last 2 working days for all users)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO attendance_logs (id, user_id, date, clock_in, clock_out, status, hours_worked, notes)
  SELECT * FROM (VALUES
    ('att-0001-0000-0000-0000-000000000001', v_admin, '2026-06-26', '2026-06-26 08:15:00+00', '2026-06-26 17:30:00+00', 'present', 9.25, NULL),
    ('att-0001-0000-0000-0000-000000000002', v_chidi, '2026-06-26', '2026-06-26 09:05:00+00', '2026-06-26 17:15:00+00', 'late',    8.17, 'Traffic on Lagos-Ibadan expressway'),
    ('att-0001-0000-0000-0000-000000000003', v_ngozi, '2026-06-26', '2026-06-26 08:00:00+00', '2026-06-26 16:45:00+00', 'present', 8.75, NULL),
    ('att-0001-0000-0000-0000-000000000004', v_tunde, '2026-06-26', '2026-06-26 07:50:00+00', '2026-06-26 17:00:00+00', 'present', 9.17, NULL),
    ('att-0001-0000-0000-0000-000000000005', v_ceo,   '2026-06-26', NULL,                      NULL,                       'on_leave', NULL, 'Annual leave'),
    ('att-0001-0000-0000-0000-000000000006', v_admin, '2026-06-25', '2026-06-25 08:00:00+00', '2026-06-25 17:30:00+00', 'present', 9.50, NULL),
    ('att-0001-0000-0000-0000-000000000007', v_chidi, '2026-06-25', '2026-06-25 08:30:00+00', '2026-06-25 17:00:00+00', 'present', 8.50, NULL),
    ('att-0001-0000-0000-0000-000000000008', v_ngozi, '2026-06-25', '2026-06-25 08:15:00+00', '2026-06-25 17:15:00+00', 'present', 9.00, NULL),
    ('att-0001-0000-0000-0000-000000000009', v_tunde, '2026-06-25', '2026-06-25 08:00:00+00', '2026-06-25 17:00:00+00', 'present', 9.00, NULL),
    ('att-0001-0000-0000-0000-000000000010', v_ceo,   '2026-06-25', NULL,                      NULL,                       'on_leave', NULL, 'Annual leave')
  ) AS att(id, user_id, date, clock_in, clock_out, status, hours_worked, notes)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed employee documents
  -- ──────────────────────────────────────────────────────────
  INSERT INTO employee_documents (id, user_id, document_type, document_name, file_url, file_size, expiry_date, is_verified, verified_by, notes)
  SELECT * FROM (VALUES
    ('doc-0001-0000-0000-0000-000000000001', v_admin, 'contract',    'Employment Contract - Dr. Emeka Moneke.pdf', '/uploads/documents/contract_emeka.pdf',   245000,  NULL,       true, v_ceo,  'Signed 15 Jan 2025'),
    ('doc-0001-0000-0000-0000-000000000002', v_admin, 'degree',      'PharmD Certificate - University of Nigeria.pdf', '/uploads/documents/degree_emeka.pdf', 1200000, NULL,       true, v_ceo,  NULL),
    ('doc-0001-0000-0000-0000-000000000003', v_chidi, 'contract',    'Employment Contract - Chidi Okafor.pdf',    '/uploads/documents/contract_chidi.pdf',    234000,  NULL,       true, v_admin, 'Signed 10 Mar 2025'),
    ('doc-0001-0000-0000-0000-000000000004', v_chidi, 'id_card',     'National ID - Chidi Okafor.png',            '/uploads/documents/nin_chidi.png',         89000,   '2030-06-01', true, v_admin, 'NIN verified'),
    ('doc-0001-0000-0000-0000-000000000005', v_ngozi, 'contract',    'Employment Contract - Ngozi Eze.pdf',       '/uploads/documents/contract_ngozi.pdf',    238000,  NULL,       true, v_admin, 'Signed 20 Feb 2025'),
    ('doc-0001-0000-0000-0000-000000000006', v_tunde, 'contract',    'Employment Contract - Tunde Adeyemi.pdf',   '/uploads/documents/contract_tunde.pdf',    232000,  NULL,       true, v_admin, 'Signed 5 Apr 2025'),
    ('doc-0001-0000-0000-0000-000000000007', v_ceo,   'contract',    'CEO Appointment Letter.pdf',               '/uploads/documents/contract_ceo.pdf',      180000,  NULL,       true, v_admin, 'Signed 15 Jan 2025')
  ) AS d(id, user_id, document_type, document_name, file_url, file_size, expiry_date, is_verified, verified_by, notes)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed performance targets (for Chidi — sales rep)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO performance_targets (id, user_id, target_type, period_start, period_end, sales_target, actual_sales, collection_target, actual_collection, new_customers_target, new_customers_actual, status, notes)
  SELECT * FROM (VALUES
    ('pt-0001-0000-0000-0000-000000000001', v_chidi, 'monthly',   '2026-04-01', '2026-04-30', 1500000.00, 1680000.00, 1350000.00, 1450000.00, 3, 4, 'achieved', 'Exceeded all targets for April'),
    ('pt-0001-0000-0000-0000-000000000002', v_chidi, 'monthly',   '2026-05-01', '2026-05-31', 2000000.00, 1820000.00, 1800000.00, 1350000.00, 4, 3, 'missed',   'Missed sales target by 9%'),
    ('pt-0001-0000-0000-0000-000000000003', v_chidi, 'monthly',   '2026-06-01', '2026-06-30', 2000000.00, 1545000.00, 1800000.00, 1200000.00, 5, 2, 'active',   'Below target on collections — follow up on VetZone balance'),
    ('pt-0001-0000-0000-0000-000000000004', v_chidi, 'quarterly', '2026-04-01', '2026-06-30', 6000000.00, 4250000.00, 5400000.00, 3200000.00, 15, 8, 'active',  'Q2 in progress — behind on collections'),
    ('pt-0001-0000-0000-0000-000000000005', v_chidi, 'annual',    '2026-01-01', '2026-12-31', 24000000.00, 7750000.00, 21600000.00, 6000000.00, 40, 12, 'active', 'Annual target — 32% achieved at mid-year')
  ) AS pt(id, user_id, target_type, period_start, period_end, sales_target, actual_sales, collection_target, actual_collection, new_customers_target, new_customers_actual, status, notes)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed performance reviews (Q1 2026)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO performance_reviews (id, user_id, reviewer_id, review_period, sales_achievement, collection_rate, customer_satisfaction, overall_rating, comments)
  SELECT * FROM (VALUES
    ('prv-0001-0000-0000-0000-000000000001', v_chidi, v_admin, 'Q1 2026', 85.50, 72.00, 88.00, 3.5, 'Chidi is performing well in sales but needs to improve collection follow-up. Good customer relationships.'),
    ('prv-0001-0000-0000-0000-000000000002', v_ngozi, v_admin, 'Q1 2026', NULL,   95.00, 92.00, 4.5, 'Ngozi has been excellent in payment processing and financial reporting. No discrepancies found.'),
    ('prv-0001-0000-0000-0000-000000000003', v_tunde, v_admin, 'Q1 2026', NULL,   NULL,  90.00, 4.0, 'Tunde maintains good inventory discipline. Expiry tracking has improved.')
  ) AS prv(id, user_id, reviewer_id, review_period, sales_achievement, collection_rate, customer_satisfaction, overall_rating, comments)
  ON CONFLICT (id) DO NOTHING;

END $$;

-- ============================================================
-- CLINIC MANAGEMENT SEED DATA
-- Seeds patients, appointments, treatments, patient_queue,
-- and vet_services.
-- ============================================================
DO $$
DECLARE
  v_admin UUID;
  v_chidi UUID;
  v_loc_delta UUID;
  v_patient_max UUID;
  v_patient_bella UUID;
  v_treatment UUID;
BEGIN
  SELECT id INTO v_admin FROM auth.users WHERE email = 'admin@albionpharma.com' LIMIT 1;
  SELECT id INTO v_chidi FROM auth.users WHERE email = 'chidi@albionpharma.com' LIMIT 1;
  SELECT id INTO v_loc_delta FROM locations WHERE name = 'Delta Veterinary Clinic' LIMIT 1;

  -- ──────────────────────────────────────────────────────────
  -- Seed patients
  -- ──────────────────────────────────────────────────────────
  INSERT INTO patients (id, owner_id, name, species, breed, gender, date_of_birth, weight_kg, color, spayed_neutered)
  SELECT * FROM (VALUES
    ('pat-0001-0000-0000-0000-000000000001', v_chidi, 'Max',   'Dog', 'German Shepherd', 'Male',   '2022-05-10', 32.5, 'Black & Tan', true),
    ('pat-0001-0000-0000-0000-000000000002', v_admin, 'Bella', 'Cat', 'Persian',         'Female', '2021-08-20', 4.2,  'White',       true)
  ) AS p(id, owner_id, name, species, breed, gender, date_of_birth, weight_kg, color, spayed_neutered)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_patient_max FROM patients WHERE name = 'Max' LIMIT 1;
  SELECT id INTO v_patient_bella FROM patients WHERE name = 'Bella' LIMIT 1;

  -- ──────────────────────────────────────────────────────────
  -- Seed appointments
  -- ──────────────────────────────────────────────────────────
  INSERT INTO appointments (id, patient_id, owner_id, vet_id, location_id, procedure_type, date, time, reason, status)
  SELECT * FROM (VALUES
    ('apt-0001-0000-0000-0000-000000000001', v_patient_max,   v_chidi, v_admin, v_loc_delta, 'Vaccination', '2026-07-10', '09:00:00', 'Annual Booster', 'scheduled'),
    ('apt-0001-0000-0000-0000-000000000002', v_patient_bella, v_admin, v_admin, v_loc_delta, 'Checkup',     '2026-07-11', '14:30:00', 'Lethargy',       'scheduled')
  ) AS a(id, patient_id, owner_id, vet_id, location_id, procedure_type, date, time, reason, status)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Seed vet services
  -- ──────────────────────────────────────────────────────────
  INSERT INTO vet_services (id, name, description, category, species, price)
  SELECT * FROM (VALUES
    ('srv-0001-0000-0000-0000-000000000001', 'General Consultation', 'Standard health checkup', 'Consultation', 'All', 15000.00),
    ('srv-0001-0000-0000-0000-000000000002', 'Rabies Vaccination',   'Annual rabies booster',     'Vaccination',  'Dog/Cat', 5000.00)
  ) AS vs(id, name, description, category, species, price)
  ON CONFLICT (id) DO NOTHING;

END $$;
