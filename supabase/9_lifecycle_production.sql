-- 9. Production Contract Lifecycle Engine

-- 1. set_contract_status
CREATE OR REPLACE FUNCTION set_contract_status(p_id bigint, p_new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_status text;
  allowed boolean := false;
BEGIN
  SELECT status INTO old_status
  FROM public.amc_contracts
  WHERE id = p_id;

  IF old_status IS NULL THEN
    RAISE EXCEPTION 'Contract % not found', p_id;
  END IF;

  --------------------------------------------------------------------
  -- Allowed transitions (canonical)
  --------------------------------------------------------------------

  -- draft
  IF old_status = 'draft' AND p_new_status IN ('active','cancelled') THEN
    allowed := true;
  END IF;

  -- active
  IF old_status = 'active' AND p_new_status IN ('due_soon','overdue','expired','cancelled','renewed') THEN
    allowed := true;
  END IF;

  -- due_soon
  IF old_status = 'due_soon' AND p_new_status IN ('active','overdue','expired','cancelled','renewed') THEN
    allowed := true;
  END IF;

  -- overdue
  IF old_status = 'overdue' AND p_new_status IN ('active','expired','cancelled','renewed') THEN
    allowed := true;
  END IF;

  -- expired
  IF old_status = 'expired' AND p_new_status IN ('renewed') THEN
    allowed := true;
  END IF;

  -- renewed (terminal)
  IF old_status = 'renewed' THEN
    allowed := false;
  END IF;

  -- cancelled (terminal)
  IF old_status = 'cancelled' THEN
    allowed := false;
  END IF;

  --------------------------------------------------------------------
  -- Reject invalid transitions
  --------------------------------------------------------------------
  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid contract status transition: % -> %', old_status, p_new_status;
  END IF;

  --------------------------------------------------------------------
  -- Apply transition
  --------------------------------------------------------------------
  UPDATE public.amc_contracts
  SET status = p_new_status,
      terminated_at = CASE
        WHEN p_new_status IN ('expired','renewed','cancelled') THEN now()
        ELSE terminated_at
      END
  WHERE id = p_id;

  --------------------------------------------------------------------
  -- Log event
  --------------------------------------------------------------------
  INSERT INTO public.contract_events (contract_id, event_type, meta)
  VALUES (
    p_id,
    p_new_status,
    jsonb_build_object('from', old_status, 'by', auth.uid())
  );
END;
$$;

-- 2. renew_contract
CREATE OR REPLACE FUNCTION renew_contract(p_old_id bigint, p_new_start date)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_rec public.amc_contracts;
  new_id bigint;
BEGIN
  SELECT * INTO old_rec
  FROM public.amc_contracts
  WHERE id = p_old_id;

  IF old_rec.id IS NULL THEN
    RAISE EXCEPTION 'Contract % not found', p_old_id;
  END IF;

  --------------------------------------------------------------------
  -- Create new contract
  --------------------------------------------------------------------
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

  --------------------------------------------------------------------
  -- Archive old contract
  --------------------------------------------------------------------
  PERFORM set_contract_status(p_old_id, 'renewed');

  --------------------------------------------------------------------
  -- Log creation event
  --------------------------------------------------------------------
  INSERT INTO public.contract_events (contract_id, event_type)
  VALUES (new_id, 'created');

  RETURN new_id;
END;
$$;

-- 3. daily_contract_lifecycle
CREATE OR REPLACE FUNCTION daily_contract_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
BEGIN
  --------------------------------------------------------------------
  -- Expire contracts
  --------------------------------------------------------------------
  FOR rec IN
    SELECT id FROM public.amc_contracts
    WHERE status IN ('active','due_soon','overdue')
      AND end_date < CURRENT_DATE
  LOOP
    PERFORM set_contract_status(rec.id, 'expired');
  END LOOP;

  --------------------------------------------------------------------
  -- Mark due soon (within 7 days)
  --------------------------------------------------------------------
  FOR rec IN
    SELECT id FROM public.amc_contracts
    WHERE status = 'active'
      AND next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    PERFORM set_contract_status(rec.id, 'due_soon');
  END LOOP;

  --------------------------------------------------------------------
  -- Mark overdue
  --------------------------------------------------------------------
  FOR rec IN
    SELECT id FROM public.amc_contracts
    WHERE status IN ('active','due_soon')
      AND next_due_date < CURRENT_DATE
  LOOP
    PERFORM set_contract_status(rec.id, 'overdue');
  END LOOP;

END;
$$;

-- 4. Contract Events Trigger
CREATE OR REPLACE FUNCTION log_contract_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contract_events(contract_id, event_type, meta)
    VALUES (NEW.id, 'created', to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.contract_events(contract_id, event_type, meta)
    VALUES (NEW.id, 'updated', jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.contract_events(contract_id, event_type, meta)
    VALUES (OLD.id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_events ON public.amc_contracts;
CREATE TRIGGER trg_contract_events
AFTER INSERT OR UPDATE OR DELETE ON public.amc_contracts
FOR EACH ROW EXECUTE FUNCTION log_contract_events();
