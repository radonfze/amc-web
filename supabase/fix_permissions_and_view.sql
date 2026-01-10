-- fix_permissions_and_view.sql

-- 1. Fix RLS Permissions (Ensure permissive read access for authenticated users)
-- This fixes the "Contract Not Found" error on Detail Page.

ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_visits ENABLE ROW LEVEL SECURITY;

-- Drop restrictive policies
DROP POLICY IF EXISTS "Auth users view contracts" ON public.amc_contracts;
DROP POLICY IF EXISTS "Auth users view locations" ON public.customer_locations;
DROP POLICY IF EXISTS "Auth users view customers" ON public.customers;
DROP POLICY IF EXISTS "Auth users view users" ON public.users;
DROP POLICY IF EXISTS "Auth users view visits" ON public.amc_visits;
DROP POLICY IF EXISTS "allow_read_contracts" ON public.amc_contracts; -- cleanup previous attempts
DROP POLICY IF EXISTS "allow_read_locations" ON public.customer_locations;
DROP POLICY IF EXISTS "allow_read_customers" ON public.customers;
DROP POLICY IF EXISTS "allow_read_users_basic" ON public.users;
DROP POLICY IF EXISTS "allow_read_visits" ON public.amc_visits;


-- Create Permissive Policies
CREATE POLICY "allow_read_contracts" ON public.amc_contracts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "allow_read_locations" ON public.customer_locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "allow_read_customers" ON public.customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "allow_read_users_basic" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "allow_read_visits" ON public.amc_visits FOR SELECT USING (auth.role() = 'authenticated');
-- Allow managers/admins to update contracts (needed for Cancel/Renew/Edit)
CREATE POLICY "allow_update_contracts" ON public.amc_contracts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "allow_delete_contracts" ON public.amc_contracts FOR DELETE USING (auth.role() = 'authenticated');


grant select, insert, update, delete on public.amc_contracts to authenticated;
grant select on public.customers to authenticated;
grant select on public.customer_locations to authenticated;


-- 2. Update View to include New Financial Columns (Fine, Paid, Balance)
-- ERROR FIX: We must DROP the view first because we are changing the columns structure.
-- Dropping a view does NOT delete any data (it's just a saved query).
DROP VIEW IF EXISTS amc_contracts_view;

CREATE OR REPLACE VIEW amc_contracts_view AS
SELECT
    ac.id AS id,
    ac.customer_location_id,
    ac.start_date,
    ac.end_date,
    ac.status,
    ac.amount_total,
    ac.amount_police,
    ac.amount_company,
    ac.payment_status,
    ac.last_effective_visit_date,
    ac.next_due_date,
    ac.cycle_status,
    
    -- New Columns
    ac.fine_amount,
    ac.paid_amount,
    ac.balance_amount,

    -- Customer info
    c.id AS customer_id,
    c.name AS customer_name,
    c.gov_license_no,
    c.gra_no,
    c.contact_person,
    c.contact_phone,
    c.area AS customer_area,
    c.city AS customer_city,

    -- Location info
    cl.display_name AS location_name,
    cl.lat,
    cl.lng,
    cl.full_address,
    cl.gov_certificate_date,
    cl.gov_renewal_date

FROM amc_contracts ac
JOIN customer_locations cl ON cl.id = ac.customer_location_id
JOIN customers c ON c.id = cl.customer_id;

-- Force schema reload
NOTIFY pgrst, 'reload config';
