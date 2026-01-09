-- 13. Authentication & RLS Policies

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  role text CHECK (role IN ('admin', 'manager', 'technician')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    COALESCE(new.raw_user_meta_data->>'role', 'technician') -- Default to technician if undefined
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. amc_contracts Policies
-- Manager/Admin Select
CREATE POLICY "manager_admin_select_contracts" ON public.amc_contracts FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- Manager/Admin Modify
CREATE POLICY "manager_admin_modify_contracts" ON public.amc_contracts FOR ALL
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- Technician Read Own
CREATE POLICY "technician_read_own_contracts" ON public.amc_contracts FOR SELECT
USING (technician_id = auth.uid());

-- Technician No Modify (Explicitly deny UPDATE/DELETE/INSERT via RLS default deny if no policy matches, but ensuring strictly)
-- RLS denies by default if no policy allows. 

-- 4. amc_visits Policies
-- Manager/Admin Select
CREATE POLICY "manager_admin_select_visits" ON public.amc_visits FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- Manager/Admin Modify
CREATE POLICY "manager_admin_modify_visits" ON public.amc_visits FOR ALL
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- Technician Read Own
CREATE POLICY "technician_read_own_visits" ON public.amc_visits FOR SELECT
USING (technician_id = auth.uid());

-- Technician Insert Own
CREATE POLICY "technician_insert_own_visits" ON public.amc_visits FOR INSERT
WITH CHECK (technician_id = auth.uid());

-- Technician Update Own
CREATE POLICY "technician_update_own_visits" ON public.amc_visits FOR UPDATE
USING (technician_id = auth.uid())
WITH CHECK (technician_id = auth.uid());

-- 5. notifications Policies
-- Clean up existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- User Read Own
CREATE POLICY "user_read_own_notifications" ON public.notifications FOR SELECT
USING (user_id = auth.uid());

-- User Update Own (Mark Read)
CREATE POLICY "user_update_own_notifications" ON public.notifications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Manager/Admin Insert
CREATE POLICY "manager_admin_insert_notifications" ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- 6. import_runs Policies
-- Manager/Admin Select
CREATE POLICY "manager_admin_select_import_runs" ON public.import_runs FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- Manager/Admin Insert
CREATE POLICY "manager_admin_insert_import_runs" ON public.import_runs FOR INSERT
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- Manager/Admin Update
CREATE POLICY "manager_admin_update_import_runs" ON public.import_runs FOR UPDATE
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));

-- 7. audit_log Policies
-- Admin Full Access
CREATE POLICY "admin_full_audit_access" ON public.audit_log FOR ALL
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Manager Read Access
CREATE POLICY "manager_read_audit" ON public.audit_log FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
