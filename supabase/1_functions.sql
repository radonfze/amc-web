-- Helper to get current user role safely
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;
