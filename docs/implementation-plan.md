# Feature Completion Ranking

Based on the project's current state and your recent requests, here is the completion status of the major features in **AlbionOS**:

- **Role-Based Dashboards**: 100% ✅ (Fully implemented with 4 distinct views)
- **Core Inventory & Products**: 100% ✅
- **Invoices & Customers (Sales Workflow)**: 100% ✅
- **Payments & Approvals (Finance Workflow)**: 100% ✅
- **Audit Logs**: 100% ✅
- **Frontend AI Integration**: 100% ✅ (Phase 2 complete)
- **Authentication & Roles**: 98% 🟡 (Pending `clinic_admin` UI and role additions)
- **Security & RLS Policies**: 95% 🟡 (Pending strict write restrictions and correction policies)

---

# Implementation Plan: Clinic Roles & Strict RLS

This plan incorporates your latest feedback regarding the Super Admin CEO button, Clinic roles, and strict error correction permissions.

## 1. Single Super Admin Button
- **Fix:** Update the Quick Login menu in `src/lib/auth-context.tsx` to have exactly one button labeled **"Superadmin(CEO)"** mapped to the `super_admin` role. 

## 2. Expanded Clinic Roles & Multi-Role Support
You requested to add `clinic_admin, veterinarian, Vet. assistant, receptionist, Vet. technecian, security, Lab scientist` and allow clinic staff to have **1 or more roles**. 
- **Database Fix:** I will create a new table `clinic_staff_roles` (or update `profiles` to support an array of roles) to allow Super Admins and Clinic Admins to assign multiple roles to a single user.
- **Frontend Fix:** Update the `UserRole` type in `src/lib/types.ts` to include the new roles (`security`, `lab_scientist`, etc.). Add a UI component for Clinic Admins/Super Admins to manage staff roles.

## 3. Strict Clinic Admin Permissions
- **Fix:** Clinic Admins will be granted read access (`SELECT`) to all tables. However, they will be explicitly excluded from write policies (`INSERT/UPDATE/DELETE`) for `invoices`, `payments`, and `inventory` so they cannot issue or resolve invoices, or edit inventory.

## 4. Strict Error Correction (Separation of Duties)
You explicitly stated: *"they need the person that make the error to correct it"*. 
- **Fix:** I will update the `UPDATE` Row Level Security (RLS) policies for `customers`, `invoices`, and `payments`. I will remove `super_admin` and `finance_manager` from these `UPDATE` policies and set them strictly to `USING (created_by = auth.uid())` or equivalent. This ensures **only the creator** of the record can edit or fix it.

## Proposed Changes

### 1. Database Migrations (`004_strict_roles_and_clinic.sql`)
- **Add Roles:** Update the `role` enum/check constraints to include `security` and `lab_scientist`.
- **Multi-Role Support:** Introduce a `clinic_staff_roles` table linking `user_id` to multiple roles.
- **Update RLS for Corrections:** 
  - Modify `customers_update` policy to only allow the creator to update.
  - Modify `invoices_update` policy to only allow the creator to update.
  - Modify `payments_update` policy to only allow the creator to update.
- **Clinic Admin Read-Only:** Ensure `clinic_admin` has `SELECT` on all operational tables but no write access to invoices/inventory.
- **Remove Super Admin Writes:** Remove `super_admin` from `INSERT`/`UPDATE`/`DELETE` on `customers`, `invoices`, `invoice_items`, `payments`, and all clinic tables (`patients`, `appointments`, `treatments`, etc.).

### 2. Frontend Updates
- Modify `src/lib/auth-context.tsx` to clean up the CEO button and add a Clinic Admin demo button.
- Modify `src/lib/types.ts` to add the new roles.

---

## Verification Plan

### Automated Tests
- Run `npx supabase db reset` to apply the migration and test policy compilation.

### Manual Verification
- Verify the login screen shows "Superadmin(CEO)".
- Log in as Super Admin and verify write access to invoices/customers is blocked.
- Log in as a Sales Rep, create an invoice, and verify that ONLY that specific Sales Rep can edit it.
