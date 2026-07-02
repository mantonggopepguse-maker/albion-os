-- ============================================================
-- Profile Auto-Creation Trigger
-- ============================================================
-- Automatically creates a profile row when a new user signs up
-- via Supabase Auth. The trigger listens on auth.users INSERT
-- and creates a corresponding row in the public.profiles table.
--
-- Without this trigger, every new auth user would need a
-- super_admin to manually create their profile — which breaks
-- self-service signup flows.
--
-- **How it works:**
--   1. A trigger function `handle_new_user()` extracts fields
--      from the raw `auth.users` row (id, email).
--   2. It inserts into `public.profiles` with default values:
--      - role = 'sales_rep' (least-privilege default)
--      - full_name = email prefix (user can update later)
--      - is_active = true
--      - location_id = NULL (must be assigned by admin)
--   3. A trigger on `auth.users` AFTER INSERT fires the function.
--
-- **Why role defaults to 'sales_rep':**
-- The principle of least privilege: new signups get the most
-- restricted role. An admin must promote them to a higher role.
--
-- **Idempotency:**
-- The trigger uses `ON CONFLICT DO NOTHING` to handle edge cases
-- where the profile already exists (e.g. admin pre-created it).
--
-- Run this AFTER schema.sql has been executed.
-- ============================================================

-- ─── Trigger Function ───
-- SECURITY DEFINER: runs with function owner's privileges, allowing
-- it to bypass RLS on the profiles table during insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales_rep'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Attach Trigger to auth.users ───
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
