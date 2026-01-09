-- 1. Technician Areas Table
CREATE TABLE IF NOT EXISTS public.technician_areas (
  id bigint generated always as identity primary key,
  technician_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  area text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(technician_id, area)
);

ALTER TABLE public.technician_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mgr_admin_manage_tech_areas" ON public.technician_areas
FOR ALL TO authenticated
USING ( public.current_role() IN ('manager', 'admin') )
WITH CHECK ( public.current_role() IN ('manager', 'admin') );

-- 2. Add Quality Score to Import Runs
ALTER TABLE public.import_runs ADD COLUMN IF NOT EXISTS quality_score int;

-- 3. Database Function for Safe Customer Merge
CREATE OR REPLACE FUNCTION merge_customers(primary_id bigint, duplicate_id bigint)
RETURNS void AS $$
BEGIN
  -- 1. Repoint locations from duplicate to primary
  UPDATE public.customer_locations
  SET customer_id = primary_id
  WHERE customer_id = duplicate_id;

  -- 2. Delete the duplicate customer
  -- (Contracts are linked to locations, so they are preserved automatically)
  DELETE FROM public.customers
  WHERE id = duplicate_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
