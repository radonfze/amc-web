CREATE TABLE IF NOT EXISTS public.import_runs (
  id bigserial PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  run_by uuid REFERENCES auth.users(id), 
  -- Note: referencing auth.users directly or public.users? 
  -- public.users has id that matches auth.users, so referencing public.users is safer for foreign keys if we delete users from public but keep in auth or vice versa. 
  -- But usually auth.users is the source. The user prompt used `users(id)`. I will assume public.users as it is in our schema.
  
  total_rows int NOT NULL,
  valid_rows int NOT NULL,
  invalid_rows int NOT NULL,
  skipped_rows int NOT NULL,
  new_customers int NOT NULL,
  existing_customers int NOT NULL,
  renewed int NOT NULL,
  not_renewed int NOT NULL,

  dry_run boolean NOT NULL,
  skip_invalid boolean NOT NULL
);

-- RLS for import_runs
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mgr_admin_read_import_runs" ON public.import_runs
FOR SELECT TO authenticated
USING ( current_role() IN ('manager', 'admin') );

CREATE POLICY "mgr_admin_insert_import_runs" ON public.import_runs
FOR INSERT TO authenticated
WITH CHECK ( current_role() IN ('manager', 'admin') );
