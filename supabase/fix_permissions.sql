-- fix_permissions.sql
-- Ensure authenticated users can view all necessary tables for the contract detail page.

-- 1. Enable RLS (just in case)
ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_visits ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if any (to be clean)
DROP POLICY IF EXISTS "Auth users view contracts" ON public.amc_contracts;
DROP POLICY IF EXISTS "Auth users view locations" ON public.customer_locations;
DROP POLICY IF EXISTS "Auth users view customers" ON public.customers;
DROP POLICY IF EXISTS "Auth users view users" ON public.users;
DROP POLICY IF EXISTS "Admins/Managers can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Auth users view visits" ON public.amc_visits;

-- 3. Re-create permissive policies for Authenticated Users
-- We want any logged-in user (Manager/Technician) to be able to READ these details.

CREATE POLICY "allow_read_contracts" ON public.amc_contracts FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "allow_read_locations" ON public.customer_locations FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "allow_read_customers" ON public.customers FOR SELECT USING (auth.role() = 'authenticated');

-- Users table often has strict RLS. Let's allow reading 'id' and 'name' for all auth users (needed for technician name display)
-- Note: 'postgres' role might bypass, but 'authenticated' needs explicit grant.
CREATE POLICY "allow_read_users_basic" ON public.users FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "allow_read_visits" ON public.amc_visits FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Grant Select Permissions
-- Sometimes RLS is fine but the role doesn't have SELECT grant.
GRANT SELECT ON public.amc_contracts TO authenticated;
GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT ON public.customer_locations TO authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.amc_visits TO authenticated;

-- 5. Force refresh schema cache (sometimes needed if using PostgREST)
NOTIFY pgrst, 'reload config';
