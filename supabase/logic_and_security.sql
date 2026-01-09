-- ==========================================
-- 1. UTILITY FUNCTIONS
-- ==========================================

-- Helper to get current user role safely
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Ensure RLS is enabled on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- DROP existing policies to ensure clean slate (optional but safer for iterating)
DROP POLICY IF EXISTS "tech_insert_visits" ON public.amc_visits;
DROP POLICY IF EXISTS "tech_select_own_visits" ON public.amc_visits;
DROP POLICY IF EXISTS "mgr_admin_all_visits" ON public.amc_visits;
DROP POLICY IF EXISTS "tech_read_contracts" ON public.amc_contracts;
DROP POLICY IF EXISTS "mgr_admin_all_contracts" ON public.amc_contracts;
DROP POLICY IF EXISTS "mgr_admin_payments" ON public.payments;

-- --- VISITS ---
-- Technicians: insert own, read own
CREATE POLICY "tech_insert_visits" ON public.amc_visits
FOR INSERT TO authenticated
WITH CHECK ( current_role() = 'technician' AND technician_id = auth.uid() );

CREATE POLICY "tech_select_own_visits" ON public.amc_visits
FOR SELECT TO authenticated
USING ( technician_id = auth.uid() OR current_role() IN ('manager', 'admin') );

-- Managers: full access
CREATE POLICY "mgr_admin_all_visits" ON public.amc_visits
FOR ALL TO authenticated
USING ( current_role() IN ('manager', 'admin') )
WITH CHECK ( current_role() IN ('manager', 'admin') );

-- --- CONTRACTS ---
-- Technicians: read only (for due visits list)
CREATE POLICY "tech_read_contracts" ON public.amc_contracts
FOR SELECT TO authenticated
USING ( current_role() = 'technician' OR current_role() IN ('manager', 'admin') );

-- Managers: full access
CREATE POLICY "mgr_admin_all_contracts" ON public.amc_contracts
FOR ALL TO authenticated
USING ( current_role() IN ('manager', 'admin') )
WITH CHECK ( current_role() IN ('manager', 'admin') );

-- --- CUSTOMERS & LOCATIONS ---
-- Technicians: read only
CREATE POLICY "tech_read_customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech_read_locations" ON public.customer_locations FOR SELECT TO authenticated USING (true);

-- Managers: full access
CREATE POLICY "mgr_edit_customers" ON public.customers FOR ALL TO authenticated
USING ( current_role() IN ('manager', 'admin') )
WITH CHECK ( current_role() IN ('manager', 'admin') );

CREATE POLICY "mgr_edit_locations" ON public.customer_locations FOR ALL TO authenticated
USING ( current_role() IN ('manager', 'admin') )
WITH CHECK ( current_role() IN ('manager', 'admin') );


-- --- PAYMENTS ---
-- Technicians: No direct access (they insert via amc_visits side effect, or explicit insert if we allowed it, keeping strictly to visits trigger for now)
-- actually, user Code asked for "Technicians: only create/read visits".
-- Payments table is for reporting.
CREATE POLICY "mgr_admin_payments" ON public.payments
FOR ALL TO authenticated
USING ( current_role() IN ('manager', 'admin') )
WITH CHECK ( current_role() IN ('manager', 'admin') );


-- ==========================================
-- 3. AUTOMATION LOGIC (FUNCTIONS & TRIGGERS)
-- ==========================================

-- Function to recalculate AMC cycle status
CREATE OR REPLACE FUNCTION public.update_amc_cycle(p_contract_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    last_normal_visit date;
    closed_count int;
    last_closed_visit date;
BEGIN
    -- 1. Get last normal visit
    SELECT MAX(visit_date)::date
    INTO last_normal_visit
    FROM amc_visits
    WHERE amc_contract_id = p_contract_id
      AND visit_type = 'normal';

    -- 2. Get shop-closed visits in last 5 days
    SELECT COUNT(*), MAX(visit_date)::date
    INTO closed_count, last_closed_visit
    FROM amc_visits
    WHERE amc_contract_id = p_contract_id
      AND visit_type = 'shop_closed'
      AND visit_date >= CURRENT_DATE - INTERVAL '5 days';

    -- 3. Determine last effective visit
    IF last_normal_visit IS NOT NULL THEN
        UPDATE amc_contracts
        SET last_effective_visit_date = last_normal_visit,
            next_due_date = last_normal_visit + INTERVAL '90 days',
            cycle_status = 'ok'
        WHERE id = p_contract_id;

    ELSIF closed_count >= 3 THEN
        UPDATE amc_contracts
        SET last_effective_visit_date = last_closed_visit,
            next_due_date = last_closed_visit + INTERVAL '90 days',
            cycle_status = 'closed_satisfied'
        WHERE id = p_contract_id;

    ELSE
        -- No effective visit yet → keep cycle_status as is
        NULL;
    END IF;

    -- 4. Overdue check
    UPDATE amc_contracts
    SET cycle_status = 'overdue'
    WHERE id = p_contract_id
      AND next_due_date < CURRENT_DATE;

    -- 5. Due soon check
    UPDATE amc_contracts
    SET cycle_status = 'due'
    WHERE id = p_contract_id
      AND next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';

END;
$$;


-- Trigger: Automatic Cycle Update on Visit
CREATE OR REPLACE FUNCTION public.trigger_update_amc_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.update_amc_cycle(NEW.amc_contract_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_amc_cycle ON public.amc_visits;
CREATE TRIGGER trg_update_amc_cycle
AFTER INSERT ON public.amc_visits
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_amc_cycle();


-- Trigger: Automatic Payment Status Update
CREATE OR REPLACE FUNCTION public.trigger_update_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.payment_collected = true THEN
        -- Update Contract
        UPDATE public.amc_contracts
        SET payment_status = 'collected_onsite'
        WHERE id = NEW.amc_contract_id;
        
        -- Insert into Payments table for reporting (Auto-ledgering)
        INSERT INTO public.payments (amc_contract_id, visit_id, technician_id, amount, method, collected_at)
        VALUES (
            NEW.amc_contract_id, 
            NEW.id, 
            NEW.technician_id, 
            COALESCE(NEW.payment_amount, 0), -- Fallback
            'cash', 
            NEW.visit_date
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_payment_status ON public.amc_visits;
CREATE TRIGGER trg_update_payment_status
AFTER INSERT ON public.amc_visits
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_payment_status();


-- Function for Daily Cron Job
CREATE OR REPLACE FUNCTION public.daily_cycle_refresh()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Mark overdue
    UPDATE amc_contracts
    SET cycle_status = 'overdue'
    WHERE next_due_date < CURRENT_DATE
      AND status = 'active';

    -- Mark due
    UPDATE amc_contracts
    SET cycle_status = 'due'
    WHERE next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      AND status = 'active';

    -- Mark ok (rest)
    UPDATE amc_contracts
    SET cycle_status = 'ok'
    WHERE next_due_date > CURRENT_DATE + INTERVAL '7 days'
      AND status = 'active';
END;
$$;
