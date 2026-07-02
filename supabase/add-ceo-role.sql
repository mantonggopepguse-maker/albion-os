-- ============================================================
-- AlbionOS - Add CEO Role
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Update the role constraint on the profiles table
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'super_admin', 'sales_rep', 'finance_manager', 'inventory_manager',
  'clinic_admin', 'vet', 'vet_tech', 'vet_assistant', 'receptionist',
  'regional_manager', 'ceo'
));

-- 2. Add CEO Read Policies to allow viewing all data
CREATE POLICY "customers_select_ceo" ON customers FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY "invoices_select_ceo" ON invoices FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY "payments_select_ceo" ON payments FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY "inventory_select_ceo" ON inventory FOR SELECT USING (get_user_role() = 'ceo');
CREATE POLICY "stock_movements_select_ceo" ON stock_movements FOR SELECT USING (get_user_role() = 'ceo');

-- 3. Add CEO Write Policies for Staff Management (Profiles)
CREATE POLICY "profiles_insert_ceo" ON profiles FOR INSERT WITH CHECK (get_user_role() = 'ceo');
CREATE POLICY "profiles_update_ceo" ON profiles FOR UPDATE USING (get_user_role() = 'ceo');
CREATE POLICY "profiles_delete_ceo" ON profiles FOR DELETE USING (get_user_role() = 'ceo');

-- Note: CEO is intentionally NOT granted insert/update/delete policies for invoices, payments, or inventory.
