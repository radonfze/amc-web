-- Fix 1: Modify Trigger to NOT fire on DELETE (prevents FK violation on deleted event log)
DROP TRIGGER IF EXISTS trg_contract_events ON public.amc_contracts;

CREATE TRIGGER trg_contract_events
AFTER INSERT OR UPDATE ON public.amc_contracts
FOR EACH ROW EXECUTE FUNCTION log_contract_events();

-- Fix 2: Ensure Cascade Delete on child tables (in case schema.sql wasn't fully applied)
ALTER TABLE public.amc_visits DROP CONSTRAINT IF EXISTS amc_visits_amc_contract_id_fkey;
-- Note: schema says amc_contract_id, but good to check. We try standard name or provided one.
-- Constraint name in error was NOT provided for visits, but usually standard.
-- Let's just add cascade if possible.
ALTER TABLE public.amc_visits 
  DROP CONSTRAINT IF EXISTS amc_visits_contract_id_fkey, -- invalid name from before
  DROP CONSTRAINT IF EXISTS amc_visits_amc_contract_id_fkey;

ALTER TABLE public.amc_visits
  ADD CONSTRAINT amc_visits_amc_contract_id_fkey
  FOREIGN KEY (amc_contract_id)
  REFERENCES public.amc_contracts(id)
  ON DELETE CASCADE;


-- Fix 3: Payments table
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amc_contract_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amc_contract_id_fkey
  FOREIGN KEY (amc_contract_id)
  REFERENCES public.amc_contracts(id)
  ON DELETE CASCADE;

-- Fix 4: Contract Events Cascade (for existing cleanups)
ALTER TABLE public.contract_events DROP CONSTRAINT IF EXISTS contract_events_contract_id_fkey;
ALTER TABLE public.contract_events
  ADD CONSTRAINT contract_events_contract_id_fkey
  FOREIGN KEY (contract_id)
  REFERENCES public.amc_contracts(id)
  ON DELETE CASCADE;
