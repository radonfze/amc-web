-- RLS Policies

-- --- VISITS ---
DROP POLICY IF EXISTS "tech_insert_visits" ON public.amc_visits;
CREATE POLICY "tech_insert_visits" ON public.amc_visits FOR INSERT TO authenticated WITH CHECK ( current_role() = 'technician' AND technician_id = auth.uid() );

DROP POLICY IF EXISTS "tech_select_own_visits" ON public.amc_visits;
CREATE POLICY "tech_select_own_visits" ON public.amc_visits FOR SELECT TO authenticated USING ( technician_id = auth.uid() OR current_role() IN ('manager', 'admin') );

DROP POLICY IF EXISTS "mgr_admin_all_visits" ON public.amc_visits;
CREATE POLICY "mgr_admin_all_visits" ON public.amc_visits FOR ALL TO authenticated USING ( current_role() IN ('manager', 'admin') ) WITH CHECK ( current_role() IN ('manager', 'admin') );

-- --- CONTRACTS ---
DROP POLICY IF EXISTS "tech_read_contracts" ON public.amc_contracts;
CREATE POLICY "tech_read_contracts" ON public.amc_contracts FOR SELECT TO authenticated USING ( current_role() = 'technician' OR current_role() IN ('manager', 'admin') );

DROP POLICY IF EXISTS "mgr_admin_all_contracts" ON public.amc_contracts;
CREATE POLICY "mgr_admin_all_contracts" ON public.amc_contracts FOR ALL TO authenticated USING ( current_role() IN ('manager', 'admin') ) WITH CHECK ( current_role() IN ('manager', 'admin') );

-- --- PAYMENTS ---
DROP POLICY IF EXISTS "mgr_admin_payments" ON public.payments;
CREATE POLICY "mgr_admin_payments" ON public.payments FOR ALL TO authenticated USING ( current_role() IN ('manager', 'admin') ) WITH CHECK ( current_role() IN ('manager', 'admin') );
