-- Migration 009: Pharmacy POS Dispensing, Controlled Substances & Narcotics Ledger
-- Provides atomic validation, stock deduction, audit logging, and narcotics register.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS narcotics_pin_hash TEXT;

CREATE TABLE IF NOT EXISTS public.narcotic_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'units',
  authorized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  authorizer_name TEXT NOT NULL,
  witness_name TEXT,
  notes TEXT,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.narcotic_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_narcotic_logs_item ON public.narcotic_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_narcotic_logs_patient ON public.narcotic_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_narcotic_logs_location ON public.narcotic_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_narcotic_logs_created_at ON public.narcotic_logs(created_at DESC);

DO \$\$ BEGIN
  DROP POLICY IF EXISTS "narcotic_logs_select" ON public.narcotic_logs;
  CREATE POLICY "narcotic_logs_select" ON public.narcotic_logs FOR SELECT USING (
    get_user_role() IN ('super_admin', 'ceo', 'clinic_admin', 'vet', 'vet_tech', 'pharmacist')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping narcotic_logs_select';
END \$\$;

DO \$\$ BEGIN
  DROP POLICY IF EXISTS "narcotic_logs_insert" ON public.narcotic_logs;
  CREATE POLICY "narcotic_logs_insert" ON public.narcotic_logs FOR INSERT WITH CHECK (
    get_user_role() IN ('super_admin', 'clinic_admin', 'vet', 'pharmacist')
  );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping narcotic_logs_insert';
END \$\$;

-- Atomic Prescriptions Dispense RPC
CREATE OR REPLACE FUNCTION public.dispense_pharmacy_prescription(
  p_patient_id UUID,
  p_patient_name TEXT,
  p_items JSONB,
  p_payment_method TEXT,
  p_pin TEXT,
  p_user_id UUID,
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
DECLARE
  v_user RECORD;
  v_item_obj JSONB;
  v_prod_id UUID;
  v_qty INT;
  v_unit_price NUMERIC;
  v_prod_name TEXT;
  v_is_controlled BOOLEAN;
  v_has_controlled BOOLEAN := false;
  v_available_qty INT;
  v_to_deduct INT;
  v_batch RECORD;
  v_taken INT;
  v_new_qty INT;
  v_new_status TEXT;
  v_total_amount NUMERIC := 0;
BEGIN
  -- 1. Validate user and role
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispensing user profile not found');
  END IF;

  IF v_user.role NOT IN ('super_admin', 'ceo', 'clinic_admin', 'vet', 'pharmacist', 'receptionist') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to dispense clinical prescriptions');
  END IF;

  -- 2. Inspect items for controlled drugs and stock sufficiency
  FOR v_item_obj IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item_obj->>'product_id')::UUID;
    v_qty := (v_item_obj->>'quantity')::INT;
    v_unit_price := (v_item_obj->>'unit_price')::NUMERIC;
    v_prod_name := v_item_obj->>'product_name';
    v_is_controlled := COALESCE((v_item_obj->>'is_controlled')::BOOLEAN, false);

    IF v_is_controlled THEN
      v_has_controlled := true;
    END IF;

    v_total_amount := v_total_amount + (v_qty * v_unit_price);

    -- Check stock at location
    SELECT COALESCE(SUM(quantity), 0) INTO v_available_qty
    FROM inventory
    WHERE product_id = v_prod_id
      AND location_id = p_location_id
      AND quantity > 0;

    IF v_available_qty < v_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Insufficient stock for %s. Required: %s, Available: %s', v_prod_name, v_qty, v_available_qty)
      );
    END IF;
  END LOOP;

  -- 3. If controlled drugs present, verify authorization PIN
  IF v_has_controlled THEN
    IF v_user.role NOT IN ('super_admin', 'clinic_admin', 'vet', 'pharmacist') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only certified veterinarians or pharmacists can authorize Schedule II controlled substances');
    END IF;

    IF v_user.narcotics_pin_hash IS NOT NULL THEN
      IF v_user.narcotics_pin_hash != crypt(p_pin, v_user.narcotics_pin_hash) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid Narcotics Authorization PIN. Access Denied.');
      END IF;
    ELSIF p_pin IS NULL OR length(trim(p_pin)) < 4 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Narcotics Authorization PIN is required.');
    END IF;
  END IF;

  -- 4. Atomically deduct inventory FIFO and record stock movements
  FOR v_item_obj IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item_obj->>'product_id')::UUID;
    v_qty := (v_item_obj->>'quantity')::INT;
    v_prod_name := v_item_obj->>'product_name';
    v_is_controlled := COALESCE((v_item_obj->>'is_controlled')::BOOLEAN, false);
    v_to_deduct := v_qty;

    FOR v_batch IN
      SELECT id, quantity
      FROM inventory
      WHERE product_id = v_prod_id
        AND location_id = p_location_id
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

    -- Stock movement audit
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
      v_prod_id,
      p_location_id,
      NULL,
      v_qty,
      'dispense',
      p_patient_id,
      format('Pharmacy POS dispense for patient %s', COALESCE(p_patient_name, 'Direct Walk-in')),
      p_user_id
    );

    -- If controlled drug, record immutable custody entry
    IF v_is_controlled THEN
      INSERT INTO narcotic_logs (
        item_id,
        product_name,
        patient_id,
        patient_name,
        quantity,
        authorized_by,
        authorizer_name,
        notes,
        location_id
      )
      VALUES (
        v_prod_id,
        v_prod_name,
        p_patient_id,
        p_patient_name,
        v_qty,
        p_user_id,
        COALESCE(v_user.full_name, 'Authorized Staff'),
        format('Dispensed via POS (%s)', p_payment_method),
        p_location_id
      );
    END IF;
  END LOOP;

  -- 5. Record audit log
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    new_data,
    performed_by
  )
  VALUES (
    'pharmacy_dispense',
    COALESCE(p_patient_id, gen_random_uuid()),
    'DISPENSE',
    jsonb_build_object(
      'total_amount', v_total_amount,
      'payment_method', p_payment_method,
      'patient_id', p_patient_id,
      'location_id', p_location_id,
      'has_controlled', v_has_controlled
    ),
    p_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'total_amount', v_total_amount,
    'has_controlled', v_has_controlled
  );
END;
\$\$;
