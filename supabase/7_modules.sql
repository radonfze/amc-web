-- 1. Contract Lifecycle Engine
ALTER TABLE public.amc_contracts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS renewal_of_id bigint REFERENCES public.amc_contracts(id),
  ADD COLUMN IF NOT EXISTS terminated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.contract_events (
  id bigserial primary key,
  contract_id bigint REFERENCES public.amc_contracts(id) ON DELETE CASCADE,
  event_type text not null, -- created, activated, due_soon, overdue, renewed, expired, cancelled
  event_at timestamptz not null default now(),
  meta jsonb
);

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mgr_admin_read_events" ON public.contract_events FOR SELECT TO authenticated USING (public.current_role() IN ('manager', 'admin'));

-- Renewal Function
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

  UPDATE public.amc_contracts
  SET status = 'renewed', terminated_at = now()
  WHERE id = p_old_id;

  INSERT INTO public.contract_events (contract_id, event_type, meta)
  VALUES (p_old_id, 'renewed', jsonb_build_object('new_contract_id', new_id));

  INSERT INTO public.contract_events (contract_id, event_type)
  VALUES (new_id, 'created');

  RETURN new_id;
END;
$$;

-- 2. Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial primary key,
  entity_type text not null, -- contract, visit
  entity_id bigint not null,
  action text not null,      -- create, update, delete
  changed_by uuid REFERENCES public.users(id),
  changed_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb,
  meta jsonb
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mgr_admin_read_audit" ON public.audit_log FOR SELECT TO authenticated USING (public.current_role() IN ('manager', 'admin'));


-- Audit Trigger Function
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(entity_type, entity_id, action, changed_by, new_value)
    VALUES (TG_ARGV[0], NEW.id, 'create', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(entity_type, entity_id, action, changed_by, old_value, new_value)
    VALUES (TG_ARGV[0], NEW.id, 'update', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(entity_type, entity_id, action, changed_by, old_value)
    VALUES (TG_ARGV[0], OLD.id, 'delete', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Apply Audit Triggers (Idempotent)
DROP TRIGGER IF EXISTS trg_audit_contracts ON public.amc_contracts;
CREATE TRIGGER trg_audit_contracts
AFTER INSERT OR UPDATE OR DELETE ON public.amc_contracts
FOR EACH ROW EXECUTE FUNCTION log_audit_changes('contract');

DROP TRIGGER IF EXISTS trg_audit_visits ON public.amc_visits;
CREATE TRIGGER trg_audit_visits
AFTER INSERT OR UPDATE OR DELETE ON public.amc_visits
FOR EACH ROW EXECUTE FUNCTION log_audit_changes('visit');

DROP TRIGGER IF EXISTS trg_audit_customers ON public.customers;
CREATE TRIGGER trg_audit_customers
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION log_audit_changes('customer');


-- 3. Notifications Engine
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigserial primary key,
  type text not null, -- contract_due, contract_overdue, contract_expiring
  user_id uuid REFERENCES public.users(id),
  entity_type text not null,
  entity_id bigint not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_read_own_notifs" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mgr_admin_create_notifs" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.current_role() IN ('manager', 'admin')); -- or system function
CREATE POLICY "user_update_own_notifs" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 4. Technician Performance View
CREATE OR REPLACE VIEW public.tech_performance_view AS
SELECT
  v.technician_id,
  date(v.visit_date) AS day,
  COUNT(*) AS visits_count,
  COUNT(*) FILTER (WHERE v.visit_type = 'shop_closed') AS shop_closed_count,
  SUM(COALESCE(v.payment_amount, 0)) AS amount_collected
FROM public.amc_visits v
WHERE v.technician_id IS NOT NULL
GROUP BY v.technician_id, date(v.visit_date);

-- Grant access to view
GRANT SELECT ON public.tech_performance_view TO authenticated;
