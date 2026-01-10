-- 00_fix_rls.sql
-- Fixes "infinite recursion" error by simplifying RLS policies on users and profiles.

-- 1. Reset Users Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for auth users" ON public.users;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins/Managers can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Enable update for users" ON public.users;

CREATE POLICY "allow_read_authenticated" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "allow_update_self" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 2. Reset Profiles Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "allow_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "allow_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id);
