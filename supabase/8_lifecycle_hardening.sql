-- 8. Lifecycle Hardening

-- Function to safely set contract status with transition validation
CREATE OR REPLACE FUNCTION set_contract_status(p_id bigint, p_status text, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_status text;
  valid_transition boolean := false;
BEGIN
  SELECT status INTO old_status FROM public.amc_contracts WHERE id = p_id;
  
  -- If same status, do nothing (idempotent)
  IF old_status = p_status THEN
    RETURN;
  END IF;

  -- 1. Draft
  IF old_status = 'draft' THEN
    IF p_status IN ('active', 'cancelled') THEN valid_transition := true; END IF;
  
  -- 2. Active
  ELSIF old_status = 'active' THEN
    IF p_status IN ('due_soon', 'overdue', 'expired', 'cancelled', 'renewed') THEN valid_transition := true; END IF;
  
  -- 3. Due Soon
  ELSIF old_status = 'due_soon' THEN
    IF p_status IN ('active', 'overdue', 'expired', 'renewed', 'cancelled') THEN valid_transition := true; END IF; -- Allocating 'active' if manual fix?
  
  -- 4. Overdue
  ELSIF old_status = 'overdue' THEN
    IF p_status IN ('active', 'expired', 'cancelled', 'renewed') THEN valid_transition := true; END IF;
  
  -- 5. Expired
  ELSIF old_status = 'expired' THEN
    IF p_status IN ('renewed', 'cancelled') THEN valid_transition := true; END IF; -- Allow renewal of expired
    
  END IF;

  -- Allow Admin Override? For now, strict.
  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid contract status transition: % -> %', old_status, p_status;
  END IF;

  UPDATE public.amc_contracts
  SET status = p_status,
      terminated_at = CASE WHEN p_status IN ('cancelled', 'expired', 'renewed') THEN now() ELSE terminated_at END
  WHERE id = p_id;

  INSERT INTO public.contract_events (contract_id, event_type, meta)
  VALUES (p_id, p_status, p_meta || jsonb_build_object('from', old_status, 'by', auth.uid()));
END;
$$;

-- Refined Renewal Function to use set_contract_status
CREATE OR REPLACE FUNCTION renew_contract(p_old_id bigint, p_new_start date)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_rec public.amc_contracts;
  new_id bigint;
BEGIN
  SELECT * INTO old_rec FROM public.amc_contracts WHERE id = p_old_id;

  -- Create New Contract (Active)
  INSERT INTO public.amc_contracts (
    customer_location_id,
    start_date,
    end_date,
    status,
    renewal_of_id,
    amount_total,
    amount_police,
    amount_company,
    payment_status,
    cycle_status,
    technician_id,
    next_due_date,
    last_effective_visit_date
  )
  VALUES (
    old_rec.customer_location_id,
    p_new_start,
    p_new_start + INTERVAL '1 year',
    'active',
    old_rec.id,
    old_rec.amount_total,
    old_rec.amount_police,
    old_rec.amount_company,
    'pending',
    'ok',
    old_rec.technician_id,
    p_new_start + INTERVAL '90 days',
    p_new_start
  )
  RETURNING id INTO new_id;

  -- Update Old Contract using safe function
  PERFORM set_contract_status(p_old_id, 'renewed', jsonb_build_object('new_contract_id', new_id));

  INSERT INTO public.contract_events (contract_id, event_type)
  VALUES (new_id, 'created');

  RETURN new_id;
END;
$$;

-- Daily Lifecycle Update (Cron Logic)
CREATE OR REPLACE FUNCTION daily_contract_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r record;
BEGIN
  -- 1. Active -> Expired
  FOR r IN SELECT id FROM public.amc_contracts WHERE status = 'active' AND end_date < CURRENT_DATE LOOP
    PERFORM set_contract_status(r.id, 'expired', '{"reason": "auto_expiry"}'::jsonb);
  END LOOP;

  -- 2. Active -> Overdue
  FOR r IN SELECT id FROM public.amc_contracts WHERE status = 'active' AND next_due_date < CURRENT_DATE LOOP
    PERFORM set_contract_status(r.id, 'overdue', '{"reason": "auto_overdue"}'::jsonb);
  END LOOP;
  
  -- 3. Due Soon -> Overdue
   FOR r IN SELECT id FROM public.amc_contracts WHERE status = 'due_soon' AND next_due_date < CURRENT_DATE LOOP
    PERFORM set_contract_status(r.id, 'overdue', '{"reason": "auto_overdue"}'::jsonb);
  END LOOP;

  -- 4. Active -> Due Soon (NEXT 7 DAYS)
  FOR r IN SELECT id FROM public.amc_contracts WHERE status = 'active' AND next_due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days') LOOP
    PERFORM set_contract_status(r.id, 'due_soon', '{"reason": "auto_due_soon"}'::jsonb);
  END LOOP;
END;
$$;
