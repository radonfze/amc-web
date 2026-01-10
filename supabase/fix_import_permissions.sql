-- Enable RLS (just in case)
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_run_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all access to import_runs" ON public.import_runs;
DROP POLICY IF EXISTS "Allow all access to import_run_items" ON public.import_run_items;

-- Create permissive policies for import logging tables
-- This allows the API route (running as anon) to insert/update logs
CREATE POLICY "Allow all access to import_runs"
ON public.import_runs
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to import_run_items"
ON public.import_run_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Ensure anon/authenticated roles have table permissions
GRANT ALL ON public.import_runs TO anon, authenticated, service_role;
GRANT ALL ON public.import_run_items TO anon, authenticated, service_role;
