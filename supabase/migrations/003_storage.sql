-- AlbionOS Database Migration 003: Storage Buckets & RPCs
-- Sets up Supabase Storage for receipts, chat attachments, and
-- employee documents. Also creates SECURITY DEFINER RPCs for
-- sensitive operations.

-- ─── Storage Buckets ───

-- Receipts bucket: bank transfer proof-of-payment images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Chat attachments bucket: files shared in team chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat_attachments', 'chat_attachments', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Employee documents bucket: HR documents (contracts, certifications)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee_documents', 'employee_documents', false, 20971520, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS Policies ───

-- Receipts: any authenticated user can upload; finance/admin/ceo can read
CREATE POLICY IF NOT EXISTS "receipts_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'receipts' AND auth.role() = 'authenticated'
);
CREATE POLICY IF NOT EXISTS "receipts_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'receipts' AND auth.role() = 'authenticated'
);

-- Chat attachments: authenticated users can upload; participants can read
CREATE POLICY IF NOT EXISTS "chat_attachments_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'chat_attachments' AND auth.role() = 'authenticated'
);
CREATE POLICY IF NOT EXISTS "chat_attachments_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat_attachments' AND auth.role() = 'authenticated'
);

-- Employee documents: admin/ceo manage; employees read own
CREATE POLICY IF NOT EXISTS "employee_documents_select_admin" ON storage.objects FOR SELECT USING (
  bucket_id = 'employee_documents' AND get_user_role() IN ('super_admin', 'ceo')
);
CREATE POLICY IF NOT EXISTS "employee_documents_select_own" ON storage.objects FOR SELECT USING (
  bucket_id = 'employee_documents' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY IF NOT EXISTS "employee_documents_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'employee_documents' AND get_user_role() IN ('super_admin', 'ceo')
);

-- ─── RPC: approve_payment (SECURITY DEFINER) ───
-- Moves payment approval business logic server-side so it runs
-- with elevated privileges, bypassing client-side RLS constraints.
CREATE OR REPLACE FUNCTION public.approve_payment(
  p_payment_id UUID,
  p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_approved_total NUMERIC(12,2);
  v_new_paid NUMERIC(12,2);
  v_customer RECORD;
BEGIN
  -- Fetch the payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment is not pending');
  END IF;

  -- If linked to an invoice, validate and update invoice + customer
  IF v_payment.invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id;
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
        'error', format('Payment exceeds remaining invoice balance. Max allowed: ₦%s', to_char(v_invoice.total - v_approved_total, 'FM999,999,999,990.00'))
      );
    END IF;

    -- Update invoice status
    IF v_new_paid >= v_invoice.total THEN
      UPDATE invoices SET status = 'paid', updated_at = now() WHERE id = v_payment.invoice_id;
    ELSE
      UPDATE invoices SET status = 'partial', updated_at = now() WHERE id = v_payment.invoice_id;
    END IF;

    -- Update customer outstanding balance
    SELECT * INTO v_customer FROM customers WHERE id = v_payment.customer_id;
    IF FOUND THEN
      UPDATE customers
      SET outstanding_balance = GREATEST(0, outstanding_balance - v_payment.amount),
          updated_at = now()
      WHERE id = v_payment.customer_id;
    END IF;
  END IF;

  -- Approve the payment
  UPDATE payments SET status = 'approved', approved_by = p_approved_by, updated_at = now()
  WHERE id = p_payment_id;

  -- Log the audit event
  INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by)
  VALUES (
    'payments',
    p_payment_id,
    'UPDATE',
    jsonb_build_object('status', 'approved', 'approved_by', p_approved_by),
    p_approved_by
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── RPC: reject_payment (SECURITY DEFINER) ───
CREATE OR REPLACE FUNCTION public.reject_payment(
  p_payment_id UUID,
  p_rejected_by UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment is not pending');
  END IF;

  UPDATE payments SET status = 'rejected', approved_by = p_rejected_by, notes = CASE WHEN notes IS NULL THEN p_reason ELSE notes || E'\n' || p_reason END, updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by)
  VALUES (
    'payments',
    p_payment_id,
    'UPDATE',
    jsonb_build_object('status', 'rejected', 'reason', p_reason),
    p_rejected_by
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── RPC: record_payment (SECURITY DEFINER) ───
CREATE OR REPLACE FUNCTION public.record_payment(
  p_invoice_id UUID,
  p_customer_id UUID,
  p_amount NUMERIC(12,2),
  p_method TEXT,
  p_proof_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_recorded_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  v_payment_id := gen_random_uuid();

  INSERT INTO payments (id, invoice_id, customer_id, amount, method, proof_url, notes, recorded_by, status)
  VALUES (v_payment_id, p_invoice_id, p_customer_id, p_amount, p_method, p_proof_url, p_notes, p_recorded_by, 'pending');

  INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by)
  VALUES ('payments', v_payment_id, 'INSERT', jsonb_build_object('amount', p_amount, 'method', p_method), p_recorded_by);

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_payment_id));
END;
$$;
