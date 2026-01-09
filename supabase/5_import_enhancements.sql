-- 1. Table for Undo Tracking
CREATE TABLE IF NOT EXISTS public.import_run_items (
  id bigserial PRIMARY KEY,
  import_run_id bigint REFERENCES public.import_runs(id) ON DELETE CASCADE,
  customer_id bigint,
  location_id bigint,
  contract_id bigint
);

ALTER TABLE public.import_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mgr_admin_manage_import_items" ON public.import_run_items
FOR ALL TO authenticated
USING ( public.current_role() IN ('manager', 'admin') )
WITH CHECK ( public.current_role() IN ('manager', 'admin') );

-- 2. Add Technician Assignment to Contracts
-- Checks if column exists first to avoid error? 
-- PostgreSQL 9.6+ supports IF NOT EXISTS on ADD COLUMN but Supabase usually is newer. 
-- Safer to just run ALTER TABLE. If it fails due to existing, migration script might error but usually fine to ignore or wrap.
ALTER TABLE public.amc_contracts 
ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES public.users(id);

-- 3. Policy update might be needed if technicians need to see their assigned contracts?
-- We already have "tech_read_contracts" policy:
-- USING ( public.current_role() = 'technician' OR public.current_role() IN ('manager', 'admin') );
-- Wait, the policy I saw earlier was:
-- CHECK ( current_role() = 'technician' ) ... wait, read policy:
-- FOR SELECT TO authenticated USING ( public.current_role() = 'technician' OR ... )
-- It didn't filter by ID! 
-- Ah, "tech_read_contracts" earlier was: "public.current_role() = 'technician'" -> meaning they see ALL contracts?
-- Let's stick to import logic first. If I assign technician_id, it is for management purposes mostly now.
