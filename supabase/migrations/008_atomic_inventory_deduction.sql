-- Migration 008: Atomic Invoice Finalization & Inventory Deduction
-- Replaces client-side deduction loops with a server-side transactional RPC.

CREATE OR REPLACE FUNCTION public.finalize_invoice_and_deduct_stock(
  p_invoice_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
DECLARE
  v_invoice RECORD;
  v_user_role TEXT;
  v_item RECORD;
  v_batch RECORD;
  v_available_qty INT;
  v_to_deduct INT;
  v_taken INT;
  v_new_qty INT;
  v_new_status TEXT;
  v_prod_name TEXT;
BEGIN
  -- 1. Fetch user role
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- 2. Lock and retrieve the invoice row
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Invoice cannot be finalized from %s status. Must be draft.', v_invoice.status));
  END IF;

  -- Verify permissions: must be the creator rep, finance manager, super admin, or CEO
  IF v_user_role NOT IN ('super_admin', 'finance_manager', 'ceo') AND v_invoice.created_by != p_user_id AND v_invoice.sales_rep_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to finalize this invoice');
  END IF;

  -- 3. Verify stock availability for ALL items before deducting anything
  FOR v_item IN
    SELECT ii.product_id, ii.quantity, p.name AS product_name
    FROM invoice_items ii
    JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_available_qty
    FROM inventory
    WHERE product_id = v_item.product_id
      AND location_id = v_invoice.location_id
      AND quantity > 0;

    IF v_available_qty < v_item.quantity THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Insufficient stock for %s at this location. Required: %s, Available: %s', v_item.product_name, v_item.quantity, v_available_qty)
      );
    END IF;
  END LOOP;

  -- 4. Deduct stock FIFO (oldest expiry first) with row-level locks
  FOR v_item IN
    SELECT ii.product_id, ii.quantity
    FROM invoice_items ii
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    v_to_deduct := v_item.quantity;

    FOR v_batch IN
      SELECT id, quantity
      FROM inventory
      WHERE product_id = v_item.product_id
        AND location_id = v_invoice.location_id
        AND quantity > 0
      ORDER BY expiry_date ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_to_deduct <= 0;

      v_taken := LEAST(v_batch.quantity, v_to_deduct);
      v_new_qty := v_batch.quantity - v_taken;

      IF v_new_qty = 0 THEN
        v_new_status := 'out_of_stock';
      ELSIF v_new_qty <= 50 THEN
        v_new_status := 'low_stock';
      ELSE
        v_new_status := 'in_stock';
      END IF;

      UPDATE inventory
      SET quantity = v_new_qty,
          status = v_new_status
      WHERE id = v_batch.id;

      v_to_deduct := v_to_deduct - v_taken;
    END LOOP;

    -- Record stock movement audit
    INSERT INTO stock_movements (
      product_id,
      from_location_id,
      to_location_id,
      quantity,
      movement_type,
      reference_id,
      notes,
      created_by
    )
    VALUES (
      v_item.product_id,
      v_invoice.location_id,
      NULL,
      v_item.quantity,
      'sale',
      p_invoice_id,
      format('Invoice %s finalized', v_invoice.invoice_number),
      p_user_id
    );
  END LOOP;

  -- 5. Transition invoice status to 'sent'
  UPDATE invoices
  SET status = 'sent',
      updated_at = now()
  WHERE id = p_invoice_id;

  -- 6. Log audit event
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    new_data,
    performed_by
  )
  VALUES (
    'invoices',
    p_invoice_id,
    'FINALIZE',
    jsonb_build_object(
      'status', 'sent',
      'finalized_by', p_user_id,
      'location_id', v_invoice.location_id
    ),
    p_user_id
  );

  RETURN jsonb_build_object('success', true);
END;
\$\$;
